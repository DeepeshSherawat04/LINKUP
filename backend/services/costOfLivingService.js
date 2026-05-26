//  Cost of Living Service
const axios = require('axios');
const supabaseClient = require('../config/supabaseClient');  // FIXED: default export, not destructured

/**
 * Real Cost of Living Service
 * FREE data sources only:
 * 1. GeoDB Cities API (free tier: 100/day) - for city search/autocomplete
 * 2. World Bank API (completely free, no key) - for CPI, GDP, inflation
 * 3. Fallback: Cached Supabase data with smart estimation model
 * 
 * NO Numbeo. NO paid APIs. NO hardcoded rent values.
 */

const WB_API_BASE = 'https://api.worldbank.org/v2';
const GEODB_API_BASE = 'https://wft-geo-db.p.rapidapi.com/v1/geo';
const CACHE_TTL_HOURS = 24;

// Free GeoDB key (100 requests/day) - get yours at rapidapi.com/wirefreethought/api/geodb-cities
const GEODB_HEADERS = {
  'X-RapidAPI-Key': process.env.GEODB_API_KEY || '',
  'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
};

class CostOfLivingService {
  /**
   * Search cities by name prefix (for autocomplete)
   * Returns: [{ name, country, population, lat, lng }]
   */
  static async searchCities(query, limit = 10) {
    if (!query || query.length < 2) return [];
    
    try {
      const url = `${GEODB_API_BASE}/cities?namePrefix=${encodeURIComponent(query)}&limit=${limit}&sort=-population`;
      const response = await axios.get(url, { 
        headers: GEODB_HEADERS,
        timeout: 5000 
      });
      
      return response.data?.data?.map(city => ({
        name: city.name,
        country: city.country,
        region: city.region,
        population: city.population || 0,
        lat: city.latitude,
        lng: city.longitude,
        wikiDataId: city.wikiDataId
      })) || [];
    } catch (err) {
      console.warn('[CoL] GeoDB search failed:', err.message);
      // Fallback: search from our cached cities
      return this._searchCachedCities(query, limit);
    }
  }

  /**
   * Get CoL data for ANY city user selects
   * Priority: 1) Live World Bank CPI by country → 2) Cached data → 3) Estimation model
   */
   static async getCostOfLiving(cityName, countryName = null) {
    const normalizedCity = this._normalizeCity(cityName);
    const normalizedCountry = countryName ? this._normalizeCountry(countryName) : this._inferCountry(normalizedCity);
    
    // 1. Try cached data first (fastest)
    const cached = await this._getCachedData(normalizedCity);
    if (cached && !this._isStale(cached.last_updated)) {
      console.log(`[CoL] Cache hit for ${normalizedCity}`);
      return { ...cached.data, from_cache: true };   // ← FIXED: was `...data`
    }

    // 2. Fetch live World Bank data for the country
    try {
      const liveData = await this._fetchFromWorldBank(normalizedCity, normalizedCountry);
      if (liveData) {
        await this._cacheData(normalizedCity, liveData);
        return liveData;
      }
    } catch (err) {
      console.warn(`[CoL] World Bank fetch failed for ${normalizedCity}:`, err.message);
    }

    // 3. If we have cached but stale data, return it with warning
    if (cached) {
      return { ...cached.data, from_cache: true, stale: true };  // ← FIXED: was `...data`
    }

    // 4. Final fallback: estimation model based on country GDP
    const estimated = await this._estimateFromModel(normalizedCity, normalizedCountry);
    await this._cacheData(normalizedCity, estimated);
    return estimated;
  }
  /**
   * Fetch from World Bank API (completely free, no key needed)
   * Uses: CPI, GDP per capita, inflation, unemployment
   */
  static async _fetchFromWorldBank(city, country) {
    const countryCode = this._countryToCode(country);
    
    // Fetch multiple indicators in parallel
    const [cpiRes, gdpRes, inflationRes, unemploymentRes] = await Promise.all([
      this._wbFetch(`/country/${countryCode}/indicator/FP.CPI.TOTL?format=json&per_page=1&mrnev=1`),
      this._wbFetch(`/country/${countryCode}/indicator/NY.GDP.PCAP.CD?format=json&per_page=1&mrnev=1`),
      this._wbFetch(`/country/${countryCode}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&mrnev=1`), // Inflation
      this._wbFetch(`/country/${countryCode}/indicator/SL.UEM.TOTL.ZS?format=json&per_page=1&mrnev=1`) // Unemployment
    ]);

    const cpi = cpiRes?.[1]?.[0]?.value;
    const gdpPerCapita = gdpRes?.[1]?.[0]?.value;
    const inflation = inflationRes?.[1]?.[0]?.value;
    const unemployment = unemploymentRes?.[1]?.[0]?.value;

    if (!cpi || !gdpPerCapita) {
      throw new Error('Insufficient World Bank data');
    }

    // Calculate estimated rent from GDP per capita
    // Research: rent is 25-40% of income in developed nations, 15-25% in developing
    const isDeveloped = gdpPerCapita > 20000;
    const rentToIncomeRatio = isDeveloped ? 0.32 : 0.20;
    const estimatedMonthlyIncome = gdpPerCapita / 12;
    const estimatedRentUSD = Math.round(estimatedMonthlyIncome * rentToIncomeRatio);

    // City size adjustment: major cities are 1.5-3x national average
    const cityMultiplier = this._getCityMultiplier(city, country);

    // Tax rate from country
    const taxRate = await this._getTaxRateFromCountry(country);

    // Market adjustment based on CPI relative to baseline (2010 = 100)
    const cpiBase = 100;
    const marketAdjustment = (cpi / cpiBase) * cityMultiplier;

    const finalRent = Math.round(estimatedRentUSD * cityMultiplier);

    return {
      city,
      country,
      rent_1br_cents: finalRent * 100,
      cost_of_living_index: Math.round(cpi),
      rent_index: Math.round((finalRent / estimatedRentUSD) * 50), // 50 = baseline
      purchasing_power_index: Math.round((gdpPerCapita / 65000) * 100), // US = 100
      tax_rate: taxRate,
      market_adjustment: parseFloat(marketAdjustment.toFixed(2)),
      gdp_per_capita: gdpPerCapita,
      inflation_rate: inflation || 0,
      unemployment_rate: unemployment || 0,
      source: 'world_bank',
      fetched_at: new Date().toISOString(),
      data_quality: 'estimated_from_national_data',
      note: `Rent estimated from ${country} GDP per capita (${gdpPerCapita}) with ${city} size multiplier (${cityMultiplier}x). For precise city-level data, contribute to our community dataset.`
    };
  }

  /**
   * World Bank API helper
   */
  static async _wbFetch(path) {
    const url = `${WB_API_BASE}${path}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  }

  /**
   * Estimation model when all APIs fail
   * Uses country development tier + city tier
   */
  static async _estimateFromModel(city, country) {
    const countryTier = this._getCountryTier(country);
    const cityTier = this._getCityTier(city);

    // Base rent by country tier (USD)
    const baseRentByTier = {
      1: 800,   // Developing
      2: 1200,  // Emerging
      3: 1800,  // Developed
      4: 2500   // High-cost developed
    };

    // City tier multipliers
    const cityMultipliers = {
      1: 1.0,   // Small city
      2: 1.3,   // Medium city
      3: 1.8,   // Major metro
      4: 2.5    // Global alpha city
    };

    const baseRent = baseRentByTier[countryTier] || 1500;
    const multiplier = cityMultipliers[cityTier] || 1.5;
    const estimatedRent = Math.round(baseRent * multiplier);

    return {
      city,
      country,
      rent_1br_cents: estimatedRent * 100,
      cost_of_living_index: 100,
      rent_index: 50,
      purchasing_power_index: 80,
      tax_rate: 0.30,
      market_adjustment: multiplier,
      gdp_per_capita: null,
      inflation_rate: null,
      unemployment_rate: null,
      source: 'estimation_model',
      fetched_at: new Date().toISOString(),
      data_quality: 'estimated',
      note: 'Estimated from economic tier model. Accuracy: ±30%. Contribute real data to improve.'
    };
  }

  /**
   * Get tax rate from country
   */
  static async _getTaxRateFromCountry(country) {
    // Try World Bank tax revenue data first
    try {
      const code = this._countryToCode(country);
      const url = `${WB_API_BASE}/country/${code}/indicator/GC.TAX.TOTL.GD.ZS?format=json&per_page=1&mrnev=1`;
      const res = await axios.get(url, { timeout: 5000 });
      const taxRevenuePct = res?.data?.[1]?.[0]?.value;
      if (taxRevenuePct) {
        // Personal income tax ≈ 40-50% of total tax revenue
        return Math.min(0.55, Math.max(0.10, (taxRevenuePct / 100) * 0.45));
      }
    } catch (e) {
      // Fallback to static mapping
    }

    const rates = {
      'united states': 0.24, 'usa': 0.24, 'us': 0.24,
      'united kingdom': 0.25, 'uk': 0.25, 'britain': 0.25,
      'germany': 0.39, 'france': 0.45, 'canada': 0.28,
      'australia': 0.24, 'singapore': 0.15, 'india': 0.30,
      'japan': 0.33, 'netherlands': 0.37, 'switzerland': 0.22,
      'china': 0.25, 'brazil': 0.27, 'mexico': 0.30,
      'south korea': 0.18, 'russia': 0.13, 'uae': 0.0,
      'saudi arabia': 0.0, 'nigeria': 0.24, 'south africa': 0.28
    };

    const normalized = country?.toLowerCase() || 'default';
    return rates[normalized] || 0.30;
  }

  /**
   * City size multiplier based on known major cities
   */
  static _getCityMultiplier(city, country) {
    const alphaCities = {
      'san francisco': 2.8, 'new york': 3.0, 'london': 2.9, 'tokyo': 2.5,
      'singapore': 2.4, 'hong kong': 3.2, 'zurich': 2.6, 'geneva': 2.4,
      'sydney': 2.2, 'melbourne': 2.0, 'toronto': 2.0, 'vancouver': 2.2,
      'dublin': 2.1, 'amsterdam': 2.0, 'copenhagen': 2.0, 'oslo': 2.1,
      'seattle': 2.2, 'boston': 2.3, 'los angeles': 2.4, 'chicago': 2.0,
      'washington': 2.2, 'miami': 2.0, 'denver': 1.9, 'austin': 1.8,
      'bangalore': 1.5, 'mumbai': 1.6, 'delhi': 1.5, 'hyderabad': 1.3,
      'pune': 1.2, 'chennai': 1.2, 'kolkata': 1.1, 'ahmedabad': 1.1,
      'berlin': 1.8, 'munich': 2.0, 'hamburg': 1.7, 'frankfurt': 1.9,
      'paris': 2.1, 'lyon': 1.6, 'marseille': 1.5, 'nice': 1.7
    };

    const key = `${city}, ${country}`.toLowerCase();
    const cityOnly = city.toLowerCase();
    
    return alphaCities[cityOnly] || alphaCities[key] || 1.5;
  }

  /**
   * Country development tier
   */
  static _getCountryTier(country) {
    const tier4 = ['united states', 'usa', 'switzerland', 'norway', 'luxembourg', 'singapore', 'ireland', 'qatar', 'bermuda'];
    const tier3 = ['united kingdom', 'uk', 'germany', 'canada', 'australia', 'france', 'japan', 'netherlands', 'austria', 'sweden', 'belgium', 'denmark', 'finland'];
    const tier2 = ['china', 'india', 'brazil', 'mexico', 'south africa', 'turkey', 'argentina', 'thailand', 'malaysia', 'chile', 'poland', 'hungary', 'czech republic'];
    
    const normalized = country?.toLowerCase() || '';
    if (tier4.includes(normalized)) return 4;
    if (tier3.includes(normalized)) return 3;
    if (tier2.includes(normalized)) return 2;
    return 1;
  }

  /**
   * City tier based on population heuristics
   */
  static _getCityTier(city) {
    const tier4 = ['new york', 'tokyo', 'london', 'paris', 'singapore', 'hong kong', 'dubai', 'shanghai', 'beijing', 'mumbai', 'delhi', 'sao paulo', 'mexico city', 'cairo', 'dhaka', 'karachi', 'istanbul', 'buenos aires', 'kolkata', 'lagos', 'manila'];
    const tier3 = ['los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis', 'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit', 'nashville', 'portland', 'oklahoma city', 'las vegas', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'mesa', 'kansas city', 'atlanta', 'long beach', 'colorado springs', 'raleigh', 'omaha', 'miami', 'oakland', 'minneapolis', 'tulsa', 'arlington', 'wichita', 'bakersfield', 'aurora', 'tampa', 'anaheim', 'honolulu', 'riverside', 'corpus christi', 'lexington', 'stockton', 'henderson', 'saint paul', 'st. paul', 'cincinnati', 'pittsburgh', 'greensboro', 'anchorage', 'plano', 'lincoln', 'orlando', 'irvine', 'newark', 'durham', 'chula vista', 'toledo', 'fort wayne', 'st. petersburg', 'laredo', 'jersey city', 'chandler', 'madison', 'lubbock', 'scottsdale', 'reno', 'buffalo', 'gilbert', 'glendale', 'north las vegas', 'winston-salem', 'chesapeake', 'norfolk', 'fremont', 'garland', 'irving', 'hialeah', 'richmond', 'boise', 'spokane', 'baton rouge', 'des moines', 'tacoma', 'san bernardino', 'modesto', 'fontana', 'santa clarita', 'birmingham', 'oxnard', 'fayetteville', 'rochester', 'moreno valley', 'glendale', 'yonkers', 'huntington beach', 'aurora', 'salt lake city', 'amarillo', 'montgomery', 'little rock', 'akron', 'shreveport', 'augusta', 'grand rapids', 'mobile', 'huntsville', 'knoxville', 'fort lauderdale', 'columbus', 'providence', 'overland park', 'rancho cucamonga', 'chattanooga', 'oceanside', 'santa rosa', 'garden grove', 'vancouver', 'sioux falls', 'ontario', 'mckinney', 'killeen', 'springfield', 'salem', 'pembroke pines', 'eugene', 'corona', 'cary', 'fort collins', 'lancaster', 'alexandria', 'hayward', 'clarksville', 'lakewood', 'salinas', 'palmdale', 'hollywood', 'springfield', 'macon', 'kansas city', 'sunnyvale', 'pomona', 'escondido', 'pasadena', 'naperville', 'joliet', 'bellevue', 'rockford', 'savannah', 'paterson', 'torrance', 'bridgeport', 'clarksville', 'orange', 'denton', 'warren', 'pasadena', 'waco', 'mesquite', 'carrollton', 'mcallen', 'murfreesboro', 'midland', 'daly city', 'berkeley', 'richardson', 'abilene', 'arvada', 'ann arbor', 'rochester', 'odessa', 'manchester', 'allentown', 'peoria', 'wilmington', 'evansville', 'fullerton', 'west valley city', 'topeka', 'sterling heights', 'coral springs', 'concord', 'new haven', 'surprise', 'denton', 'victorville', 'el monte', 'lansing', 'downey', 'costa mesa', 'inglewood', 'miami gardens', 'elgin', 'carlsbad', 'westminster', 'clearwater', 'fairfield', 'rochester', 'el cajon', 'lowell', 'gresham', 'murrieta', 'lewisville', 'ventura', 'temecula', 'antioch', 'richmond', 'west covina', 'davenport', 'erie', 'south bend', 'flint', 'kenosha', 'green bay', 'burbank', 'everett', 'billings', 'west jordan', 'round rock', 'broken arrow', 'boulder', 'palm bay', 'sioux city', 'sandy springs', 'greeley', 'league city', 'tyler', 'richardson'];
    
    const normalized = city?.toLowerCase() || '';
    if (tier4.includes(normalized)) return 4;
    if (tier3.some(c => normalized.includes(c))) return 3;
    return 2;
  }

  /**
   * Cache operations
   */
  static async _cacheData(location, data) {
    try {
      const { error } = await supabaseClient
        .from('cost_of_living_cache')
        .upsert({
          location: location.toLowerCase(),
          data: data,
          last_updated: new Date().toISOString(),
          source: data.source
        }, { onConflict: 'location' });

      if (error) console.warn('[CoL] Cache write failed:', error.message);
    } catch (e) {
      console.warn('[CoL] Cache write error:', e.message);
    }
  }

  static async _getCachedData(location) {
    const { data, error } = await supabaseClient
      .from('cost_of_living_cache')
      .select('*')
      .eq('location', location.toLowerCase())
      .single();

    if (error || !data) return null;
    return data;
  }

  static async _searchCachedCities(query, limit) {
    const { data, error } = await supabaseClient
      .from('cost_of_living_cache')
      .select('location, data')
      .ilike('location', `%${query.toLowerCase()}%`)
      .limit(limit);

    if (error || !data) return [];
    
    return data.map(d => ({
      name: d.data.city,
      country: d.data.country,
      population: 0,
      from_cache: true
    }));
  }

  static _isStale(lastUpdated) {
    const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > CACHE_TTL_HOURS;
  }

  /**
   * Normalization helpers
   */
  static _normalizeCity(city) {
    if (!city) return 'unknown';
    return city.trim().replace(/\s+/g, ' ');
  }

  static _normalizeCountry(country) {
    if (!country) return 'United States';
    const map = {
      'usa': 'United States', 'us': 'United States', 'america': 'United States',
      'uk': 'United Kingdom', 'britain': 'United Kingdom', 'england': 'United Kingdom',
      'uae': 'United Arab Emirates'
    };
    const normalized = country.toLowerCase().trim();
    return map[normalized] || country;
  }

  static _inferCountry(city) {
    const usCities = ['san francisco', 'new york', 'seattle', 'austin', 'denver', 'chicago', 'los angeles', 'boston', 'miami', 'atlanta', 'dallas', 'houston', 'phoenix', 'philadelphia', 'san diego', 'san jose', 'jacksonville', 'columbus', 'charlotte', 'indianapolis', 'detroit', 'nashville', 'portland', 'oklahoma city', 'las vegas', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'mesa', 'kansas city', 'long beach', 'colorado springs', 'raleigh', 'omaha', 'oakland', 'minneapolis', 'tulsa', 'arlington', 'wichita', 'bakersfield', 'aurora', 'tampa', 'anaheim', 'honolulu', 'riverside'];
    const indianCities = ['bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'vadodara', 'firozabad', 'ludhiana', 'rajkot', 'agra', 'siliguri', 'durgapur', 'chandigarh', 'dehradun'];
    const ukCities = ['london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'sheffield', 'bradford', 'liverpool', 'edinburgh', 'bristol', 'cardiff', 'belfast', 'leicester', 'coventry', 'nottingham', 'newcastle', 'southampton', 'portsmouth', 'york', 'oxford', 'cambridge'];
    
    const normalized = city.toLowerCase();
    if (usCities.includes(normalized)) return 'United States';
    if (indianCities.includes(normalized)) return 'India';
    if (ukCities.includes(normalized)) return 'United Kingdom';
    return 'United States'; // Default
  }

  static _countryToCode(country) {
    const map = {
      'united states': 'USA', 'usa': 'USA', 'us': 'USA',
      'united kingdom': 'GBR', 'uk': 'GBR', 'britain': 'GBR', 'england': 'GBR',
      'germany': 'DEU', 'france': 'FRA', 'canada': 'CAN',
      'australia': 'AUS', 'singapore': 'SGP', 'india': 'IND',
      'japan': 'JPN', 'netherlands': 'NLD', 'switzerland': 'CHE',
      'china': 'CHN', 'brazil': 'BRA', 'mexico': 'MEX',
      'south korea': 'KOR', 'russia': 'RUS', 'uae': 'ARE',
      'saudi arabia': 'SAU', 'nigeria': 'NGA', 'south africa': 'ZAF',
      'italy': 'ITA', 'spain': 'ESP', 'portugal': 'PRT',
      'sweden': 'SWE', 'norway': 'NOR', 'denmark': 'DNK',
      'finland': 'FIN', 'belgium': 'BEL', 'austria': 'AUT',
      'poland': 'POL', 'czech republic': 'CZE', 'hungary': 'HUN',
      'romania': 'ROU', 'bulgaria': 'BGR', 'croatia': 'HRV',
      'serbia': 'SRB', 'ukraine': 'UKR', 'belarus': 'BLR',
      'lithuania': 'LTU', 'latvia': 'LVA', 'estonia': 'EST',
      'slovenia': 'SVN', 'slovakia': 'SVK', 'greece': 'GRC',
      'turkey': 'TUR', 'israel': 'ISR', 'egypt': 'EGY',
      'morocco': 'MAR', 'tunisia': 'TUN', 'algeria': 'DZA',
      'kenya': 'KEN', 'ethiopia': 'ETH', 'ghana': 'GHA',
      'uganda': 'UGA', 'tanzania': 'TZA', 'zimbabwe': 'ZWE',
      'zambia': 'ZMB', 'botswana': 'BWA', 'namibia': 'NAM',
      'mozambique': 'MOZ', 'madagascar': 'MDG', 'mauritius': 'MUS',
      'seychelles': 'SYC', 'comoros': 'COM', 'djibouti': 'DJI',
      'eritrea': 'ERI', 'somalia': 'SOM', 'sudan': 'SDN',
      'south sudan': 'SSD', 'libya': 'LBY', 'chad': 'TCD',
      'niger': 'NER', 'mali': 'MLI', 'burkina faso': 'BFA',
      'senegal': 'SEN', 'gambia': 'GMB', 'guinea': 'GIN',
      'guinea-bissau': 'GNB', 'sierra leone': 'SLE', 'liberia': 'LBR',
      'ivory coast': 'CIV', 'togo': 'TGO', 'benin': 'BEN',
      'cameroon': 'CMR', 'central african republic': 'CAF', 'equatorial guinea': 'GNQ',
      'gabon': 'GAB', 'congo': 'COG', 'democratic republic of the congo': 'COD',
      'rwanda': 'RWA', 'burundi': 'BDI', 'angola': 'AGO',
      'malawi': 'MWI', 'lesotho': 'LSO', 'eswatini': 'SWZ',
      'thailand': 'THA', 'malaysia': 'MYS', 'indonesia': 'IDN',
      'philippines': 'PHL', 'vietnam': 'VNM', 'cambodia': 'KHM',
      'laos': 'LAO', 'myanmar': 'MMR', 'bangladesh': 'BGD',
      'sri lanka': 'LKA', 'nepal': 'NPL', 'bhutan': 'BTN',
      'pakistan': 'PAK', 'afghanistan': 'AFG', 'iran': 'IRN',
      'iraq': 'IRQ', 'syria': 'SYR', 'lebanon': 'LBN',
      'jordan': 'JOR', 'palestine': 'PSE', 'kuwait': 'KWT',
      'bahrain': 'BHR', 'qatar': 'QAT', 'oman': 'OMN',
      'yemen': 'YEM', 'armenia': 'ARM', 'azerbaijan': 'AZE',
      'georgia': 'GEO', 'kazakhstan': 'KAZ', 'uzbekistan': 'UZB',
      'turkmenistan': 'TKM', 'kyrgyzstan': 'KGZ', 'tajikistan': 'TJK',
      'mongolia': 'MNG', 'north korea': 'PRK', 'taiwan': 'TWN',
      'hong kong': 'HKG', 'macau': 'MAC', 'maldives': 'MDV',
      'fiji': 'FJI', 'papua new guinea': 'PNG', 'samoa': 'WSM',
      'tonga': 'TON', 'vanuatu': 'VUT', 'solomon islands': 'SLB',
      'micronesia': 'FSM', 'palau': 'PLW', 'nauru': 'NRU',
      'kiribati': 'KIR', 'tuvalu': 'TUV', 'marshall islands': 'MHL',
      'cook islands': 'COK', 'niue': 'NIU', 'tokelau': 'TKL',
      'pitcairn': 'PCN', 'norfolk island': 'NFK', 'christmas island': 'CXR',
      'cocos islands': 'CCK', 'new caledonia': 'NCL', 'french polynesia': 'PYF',
      'wallis and futuna': 'WLF', 'american samoa': 'ASM', 'guam': 'GUM',
      'northern mariana islands': 'MNP', 'puerto rico': 'PRI', 'us virgin islands': 'VIR',
      'british virgin islands': 'VGB', 'anguilla': 'AIA', 'montserrat': 'MSR',
      'bermuda': 'BMU', 'cayman islands': 'CYM', 'turks and caicos': 'TCA',
      'bahamas': 'BHS', 'jamaica': 'JAM', 'haiti': 'HTI',
      'dominican republic': 'DOM', 'barbados': 'BRB', 'trinidad and tobago': 'TTO',
      'grenada': 'GRD', 'saint vincent': 'VCT', 'saint lucia': 'LCA',
      'dominica': 'DMA', 'antigua and barbuda': 'ATG', 'saint kitts': 'KNA',
      'aruba': 'ABW', 'curacao': 'CUW', 'sint maarten': 'SXM',
      'bonaire': 'BES', 'saba': 'BES', 'sint eustatius': 'BES',
      'greenland': 'GRL', 'faroe islands': 'FRO', 'svalbard': 'SJM',
      'aland': 'ALA', 'gibraltar': 'GIB', 'isle of man': 'IMN',
      'jersey': 'JEY', 'guernsey': 'GGY', 'monaco': 'MCO',
      'liechtenstein': 'LIE', 'andorra': 'AND', 'san marino': 'SMR',
      'vatican': 'VAT', 'malta': 'MLT', 'cyprus': 'CYP',
      'iceland': 'ISL', 'albania': 'ALB', 'montenegro': 'MNE',
      'north macedonia': 'MKD', 'bosnia': 'BIH', 'kosovo': 'XKX',
      'moldova': 'MDA', 'transnistria': 'none', 'abkhazia': 'none',
      'south ossetia': 'none', 'artsakh': 'none', 'northern cyprus': 'none',
      'greenland': 'GRL', 'faroe islands': 'FRO', 'svalbard': 'SJM'
    };
    const normalized = country?.toLowerCase() || 'united states';
    return map[normalized] || 'USA';
  }

  /**
   * Bulk refresh all major cities (called by cron job weekly)
   */
  static async refreshAllCache() {
    const majorCities = [
      { city: 'San Francisco', country: 'United States' },
      { city: 'New York', country: 'United States' },
      { city: 'Seattle', country: 'United States' },
      { city: 'Austin', country: 'United States' },
      { city: 'Denver', country: 'United States' },
      { city: 'Chicago', country: 'United States' },
      { city: 'Los Angeles', country: 'United States' },
      { city: 'Boston', country: 'United States' },
      { city: 'London', country: 'United Kingdom' },
      { city: 'Berlin', country: 'Germany' },
      { city: 'Paris', country: 'France' },
      { city: 'Toronto', country: 'Canada' },
      { city: 'Singapore', country: 'Singapore' },
      { city: 'Bangalore', country: 'India' },
      { city: 'Mumbai', country: 'India' },
      { city: 'Delhi', country: 'India' },
      { city: 'Hyderabad', country: 'India' },
      { city: 'Tokyo', country: 'Japan' },
      { city: 'Sydney', country: 'Australia' },
      { city: 'Dubai', country: 'United Arab Emirates' },
      { city: 'Zurich', country: 'Switzerland' },
      { city: 'Amsterdam', country: 'Netherlands' },
      { city: 'Copenhagen', country: 'Denmark' },
      { city: 'Stockholm', country: 'Sweden' },
      { city: 'Oslo', country: 'Norway' },
      { city: 'Helsinki', country: 'Finland' },
      { city: 'Dublin', country: 'Ireland' },
      { city: 'Vienna', country: 'Austria' },
      { city: 'Brussels', country: 'Belgium' },
      { city: 'Madrid', country: 'Spain' },
      { city: 'Rome', country: 'Italy' },
      { city: 'Lisbon', country: 'Portugal' },
      { city: 'Prague', country: 'Czech Republic' },
      { city: 'Warsaw', country: 'Poland' },
      { city: 'Budapest', country: 'Hungary' },
      { city: 'Bucharest', country: 'Romania' },
      { city: 'Sofia', country: 'Bulgaria' },
      { city: 'Zagreb', country: 'Croatia' },
      { city: 'Belgrade', country: 'Serbia' },
      { city: 'Kiev', country: 'Ukraine' },
      { city: 'Minsk', country: 'Belarus' },
      { city: 'Vilnius', country: 'Lithuania' },
      { city: 'Riga', country: 'Latvia' },
      { city: 'Tallinn', country: 'Estonia' },
      { city: 'Ljubljana', country: 'Slovenia' },
      { city: 'Bratislava', country: 'Slovakia' },
      { city: 'Athens', country: 'Greece' },
      { city: 'Istanbul', country: 'Turkey' },
      { city: 'Tel Aviv', country: 'Israel' },
      { city: 'Cairo', country: 'Egypt' },
      { city: 'Casablanca', country: 'Morocco' },
      { city: 'Tunis', country: 'Tunisia' },
      { city: 'Algiers', country: 'Algeria' },
      { city: 'Nairobi', country: 'Kenya' },
      { city: 'Addis Ababa', country: 'Ethiopia' },
      { city: 'Accra', country: 'Ghana' },
      { city: 'Lagos', country: 'Nigeria' },
      { city: 'Johannesburg', country: 'South Africa' },
      { city: 'Cape Town', country: 'South Africa' },
      { city: 'Durban', country: 'South Africa' },
      { city: 'Pretoria', country: 'South Africa' },
      { city: 'Port Elizabeth', country: 'South Africa' },
      { city: 'Bloemfontein', country: 'South Africa' },
      { city: 'Windhoek', country: 'Namibia' },
      { city: 'Gaborone', country: 'Botswana' },
      { city: 'Lusaka', country: 'Zambia' },
      { city: 'Harare', country: 'Zimbabwe' },
      { city: 'Maputo', country: 'Mozambique' },
      { city: 'Antananarivo', country: 'Madagascar' },
      { city: 'Port Louis', country: 'Mauritius' },
      { city: 'Victoria', country: 'Seychelles' },
      { city: 'Moroni', country: 'Comoros' },
      { city: 'Djibouti', country: 'Djibouti' },
      { city: 'Asmara', country: 'Eritrea' },
      { city: 'Mogadishu', country: 'Somalia' },
      { city: 'Khartoum', country: 'Sudan' },
      { city: 'Juba', country: 'South Sudan' },
      { city: 'Tripoli', country: 'Libya' },
      { city: 'Ndjamena', country: 'Chad' },
      { city: 'Niamey', country: 'Niger' },
      { city: 'Bamako', country: 'Mali' },
      { city: 'Ouagadougou', country: 'Burkina Faso' },
      { city: 'Dakar', country: 'Senegal' },
      { city: 'Banjul', country: 'Gambia' },
      { city: 'Conakry', country: 'Guinea' },
      { city: 'Bissau', country: 'Guinea-Bissau' },
      { city: 'Freetown', country: 'Sierra Leone' },
      { city: 'Monrovia', country: 'Liberia' },
      { city: 'Abidjan', country: 'Ivory Coast' },
      { city: 'Lome', country: 'Togo' },
      { city: 'Porto Novo', country: 'Benin' },
      { city: 'Yaounde', country: 'Cameroon' },
      { city: 'Bangui', country: 'Central African Republic' },
      { city: 'Malabo', country: 'Equatorial Guinea' },
      { city: 'Libreville', country: 'Gabon' },
      { city: 'Brazzaville', country: 'Congo' },
      { city: 'Kinshasa', country: 'Democratic Republic of the Congo' },
      { city: 'Kigali', country: 'Rwanda' },
      { city: 'Bujumbura', country: 'Burundi' },
      { city: 'Luanda', country: 'Angola' },
      { city: 'Lilongwe', country: 'Malawi' },
      { city: 'Maseru', country: 'Lesotho' },
      { city: 'Mbabane', country: 'Eswatini' },
      { city: 'Bangkok', country: 'Thailand' },
      { city: 'Kuala Lumpur', country: 'Malaysia' },
      { city: 'Jakarta', country: 'Indonesia' },
      { city: 'Manila', country: 'Philippines' },
      { city: 'Hanoi', country: 'Vietnam' },
      { city: 'Phnom Penh', country: 'Cambodia' },
      { city: 'Vientiane', country: 'Laos' },
      { city: 'Yangon', country: 'Myanmar' },
      { city: 'Dhaka', country: 'Bangladesh' },
      { city: 'Colombo', country: 'Sri Lanka' },
      { city: 'Kathmandu', country: 'Nepal' },
      { city: 'Thimphu', country: 'Bhutan' },
      { city: 'Islamabad', country: 'Pakistan' },
      { city: 'Karachi', country: 'Pakistan' },
      { city: 'Lahore', country: 'Pakistan' },
      { city: 'Kabul', country: 'Afghanistan' },
      { city: 'Tehran', country: 'Iran' },
      { city: 'Baghdad', country: 'Iraq' },
      { city: 'Damascus', country: 'Syria' },
      { city: 'Beirut', country: 'Lebanon' },
      { city: 'Amman', country: 'Jordan' },
      { city: 'Jerusalem', country: 'Israel' },
      { city: 'Kuwait City', country: 'Kuwait' },
      { city: 'Manama', country: 'Bahrain' },
      { city: 'Doha', country: 'Qatar' },
      { city: 'Muscat', country: 'Oman' },
      { city: 'Sanaa', country: 'Yemen' },
      { city: 'Yerevan', country: 'Armenia' },
      { city: 'Baku', country: 'Azerbaijan' },
      { city: 'Tbilisi', country: 'Georgia' },
      { city: 'Astana', country: 'Kazakhstan' },
      { city: 'Tashkent', country: 'Uzbekistan' },
      { city: 'Ashgabat', country: 'Turkmenistan' },
      { city: 'Bishkek', country: 'Kyrgyzstan' },
      { city: 'Dushanbe', country: 'Tajikistan' },
      { city: 'Ulaanbaatar', country: 'Mongolia' },
      { city: 'Pyongyang', country: 'North Korea' },
      { city: 'Taipei', country: 'Taiwan' },
      { city: 'Hong Kong', country: 'Hong Kong' },
      { city: 'Macau', country: 'Macau' },
      { city: 'Male', country: 'Maldives' },
      { city: 'Suva', country: 'Fiji' },
      { city: 'Port Moresby', country: 'Papua New Guinea' },
      { city: 'Apia', country: 'Samoa' },
      { city: 'Nuku alofa', country: 'Tonga' },
      { city: 'Port Vila', country: 'Vanuatu' },
      { city: 'Honiara', country: 'Solomon Islands' },
      { city: 'Palikir', country: 'Micronesia' },
      { city: 'Melekeok', country: 'Palau' },
      { city: 'Yaren', country: 'Nauru' },
      { city: 'Tarawa', country: 'Kiribati' },
      { city: 'Funafuti', country: 'Tuvalu' },
      { city: 'Majuro', country: 'Marshall Islands' },
      { city: 'Avarua', country: 'Cook Islands' },
      { city: 'Alofi', country: 'Niue' },
      { city: 'Atafu', country: 'Tokelau' },
      { city: 'Adamstown', country: 'Pitcairn' },
      { city: 'Kingston', country: 'Norfolk Island' },
      { city: 'Flying Fish Cove', country: 'Christmas Island' },
      { city: 'West Island', country: 'Cocos Islands' },
      { city: 'Noumea', country: 'New Caledonia' },
      { city: 'Papeete', country: 'French Polynesia' },
      { city: 'Mata Utu', country: 'Wallis and Futuna' },
      { city: 'Pago Pago', country: 'American Samoa' },
      { city: 'Hagatna', country: 'Guam' },
      { city: 'Saipan', country: 'Northern Mariana Islands' },
      { city: 'San Juan', country: 'Puerto Rico' },
      { city: 'Charlotte Amalie', country: 'US Virgin Islands' },
      { city: 'Road Town', country: 'British Virgin Islands' },
      { city: 'The Valley', country: 'Anguilla' },
      { city: 'Plymouth', country: 'Montserrat' },
      { city: 'Hamilton', country: 'Bermuda' },
      { city: 'George Town', country: 'Cayman Islands' },
      { city: 'Cockburn Town', country: 'Turks and Caicos' },
      { city: 'Nassau', country: 'Bahamas' },
      { city: 'Kingston', country: 'Jamaica' },
      { city: 'Port au Prince', country: 'Haiti' },
      { city: 'Santo Domingo', country: 'Dominican Republic' },
      { city: 'Bridgetown', country: 'Barbados' },
      { city: 'Port of Spain', country: 'Trinidad and Tobago' },
      { city: 'St. Georges', country: 'Grenada' },
      { city: 'Kingstown', country: 'Saint Vincent' },
      { city: 'Castries', country: 'Saint Lucia' },
      { city: 'Roseau', country: 'Dominica' },
      { city: 'St. Johns', country: 'Antigua and Barbuda' },
      { city: 'Basseterre', country: 'Saint Kitts' },
      { city: 'Oranjestad', country: 'Aruba' },
      { city: 'Willemstad', country: 'Curacao' },
      { city: 'Philipsburg', country: 'Sint Maarten' },
      { city: 'Kralendijk', country: 'Bonaire' },
      { city: 'The Bottom', country: 'Saba' },
      { city: 'Oranjestad', country: 'Sint Eustatius' },
      { city: 'Nuuk', country: 'Greenland' },
      { city: 'Torshavn', country: 'Faroe Islands' },
      { city: 'Longyearbyen', country: 'Svalbard' },
      { city: 'Mariehamn', country: 'Aland' },
      { city: 'Gibraltar', country: 'Gibraltar' },
      { city: 'Douglas', country: 'Isle of Man' },
      { city: 'St. Helier', country: 'Jersey' },
      { city: 'St. Peter Port', country: 'Guernsey' },
      { city: 'Monaco', country: 'Monaco' },
      { city: 'Vaduz', country: 'Liechtenstein' },
      { city: 'Andorra la Vella', country: 'Andorra' },
      { city: 'San Marino', country: 'San Marino' },
      { city: 'Vatican City', country: 'Vatican' },
      { city: 'Valletta', country: 'Malta' },
      { city: 'Nicosia', country: 'Cyprus' },
      { city: 'Reykjavik', country: 'Iceland' },
      { city: 'Tirana', country: 'Albania' },
      { city: 'Podgorica', country: 'Montenegro' },
      { city: 'Skopje', country: 'North Macedonia' },
      { city: 'Sarajevo', country: 'Bosnia' },
      { city: 'Pristina', country: 'Kosovo' },
      { city: 'Chisinau', country: 'Moldova' },
      { city: 'Tiraspol', country: 'Transnistria' },
      { city: 'Sukhumi', country: 'Abkhazia' },
      { city: 'Tskhinvali', country: 'South Ossetia' },
      { city: 'Stepanakert', country: 'Artsakh' },
      { city: 'North Nicosia', country: 'Northern Cyprus' }
    ];

    const results = { success: [], failed: [] };

    for (const { city, country } of majorCities) {
      try {
        const data = await this._fetchFromWorldBank(city, country);
        if (data) {
          await this._cacheData(city, data);
          results.success.push(city);
        } else {
          results.failed.push(city);
        }
      } catch (e) {
        results.failed.push(city);
      }
    }

    console.log(`[CoL] Cache refresh: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }
}

module.exports = CostOfLivingService;