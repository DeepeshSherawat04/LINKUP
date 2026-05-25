// services/incomeSimulationService.js
const FinancialMath = require('../utils/financialMath');
const CostOfLivingService = require('./costOfLivingService');

class IncomeSimulationService {
  static async buildScenarios(offerDetails, personalFinances) {
    // 1. Sanitize instead of throwing — handles both opportunity & offer shapes
    const inputs = this._sanitizeInputs(offerDetails, personalFinances);

    // 2. Safe CoL fetch with fallback defaults
    let col = null;
    try {
      col = await CostOfLivingService.getCostOfLiving(inputs.location, inputs.locationCountry);
    } catch (e) {
      console.warn('[IncomeSimulation] CoL fetch failed, using defaults:', e.message);
    }

    const monthlyFixed = this._calculateMonthlyFixed(inputs, col);
    const taxRate = (col && typeof col.tax_rate === 'number') ? col.tax_rate : 0.30;
    const marketRate = this._getMarketRate(inputs.location, col);

    // 3. Build canonical scenarios (same shape the frontend expects)
    const startup = this._buildStartupScenario(inputs, monthlyFixed, taxRate, marketRate, col);
    const bigTech = this._buildBigTechScenario(inputs, monthlyFixed, taxRate, marketRate, col);
    const remote = this._buildRemoteScenario(inputs, monthlyFixed, taxRate, marketRate, col);

    return [startup, bigTech, remote];
  }

  /* =====================================================================
     INPUT SANITIZATION — replaces the old _validateInputs that threw 500s
     ===================================================================== */
static _sanitizeInputs(offer, finances) {
  // Helper: coerce any value to a clean number, fallback if NaN
  const safeNum = (val, fallback = 0) => {
    if (val === null || val === undefined || val === '') return fallback;
    const cleaned = typeof val === 'string' ? val.replace(/[^0-9.-]/g, '') : val;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? fallback : n;
  };

  // Income: opportunity shape vs job-offer shape
  const rawBase = safeNum(
    offer?.base_salary ??
    offer?.incomePotential?.min ??
    offer?.incomePotential?.max,
    60000
  );
  const rawMax = safeNum(offer?.incomePotential?.max, rawBase * 1.5);

  return {
    baseAnnual: Math.max(FinancialMath.toCents(rawBase), 100000),
    maxAnnual:  Math.max(FinancialMath.toCents(rawMax),  100000),

    equityPct:       safeNum(offer?.equity_percentage, 0),
    equityValuation: FinancialMath.toCents(safeNum(offer?.equity_valuation, 0)),
    bonusTarget:     FinancialMath.toCents(safeNum(offer?.bonus_target_annual, 0)),

    location:        (offer?.location || 'Remote').toString(),
    locationCountry: offer?.location_country || null,
    companyType:     (offer?.company_type || 'startup').toString(),
    companyName:     (offer?.company_name || offer?.title || 'Unknown Opportunity').toString(),

    // Personal finances — the most common crash site
    rent:     FinancialMath.toCents(safeNum(finances?.monthly_rent, 0)),
    loans:    FinancialMath.toCents(safeNum(finances?.monthly_loans, 0)),
    expenses: FinancialMath.toCents(safeNum(finances?.monthly_expenses, 0)),
    savings:  FinancialMath.toCents(safeNum(finances?.savings, 0)),

    hasRelocation: !!(finances?.relocation_bonus || offer?.relocation_bonus),
    relocationClawbackMonths: parseInt(finances?.relocation_clawback_months || offer?.relocation_clawback_months) || 0,
    hasSeverance: !!(finances?.severance_months || offer?.severance_months),
  };
}

  static _calculateMonthlyFixed(inputs, col) {
    const liveRent = col && typeof col.rent_1br_cents === 'number' ? col.rent_1br_cents : 0;
    const effectiveRent = inputs.rent > 0 ? inputs.rent : (liveRent || FinancialMath.toCents(1000));
    return effectiveRent + inputs.loans + inputs.expenses;
  }

  /* =====================================================================
     SCENARIO BUILDERS (kept identical schema so the frontend doesn't break)
     ===================================================================== */
  static _buildStartupScenario(inputs, monthlyFixed, taxRate, marketRate, col) {
    const monthlyBase = FinancialMath.monthlyFromAnnual(inputs.baseAnnual);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(inputs.bonusTarget * 0.5);
    const equityAnnual = FinancialMath.percentOf(inputs.equityValuation, inputs.equityPct / 100);
    const equityWorth = FinancialMath.percentOf(equityAnnual, 0.10);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityWorth);

    const projection = [];
    let currentSavings = inputs.savings;
    let breakEvenMonth = null;
    const LAYOFF_MONTH = 18;
    const SEVERANCE_MONTHS = inputs.hasSeverance ? 2 : 0;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      if (month === LAYOFF_MONTH) income += monthlyBase * SEVERANCE_MONTHS;
      if (month > LAYOFF_MONTH) income = 0;

      let clawback = 0;
      if (inputs.hasRelocation && month < inputs.relocationClawbackMonths && month === LAYOFF_MONTH) {
        clawback = FinancialMath.toCents(10000);
      }

      const tax = FinancialMath.percentOf(income, taxRate);
      const disposable = income - tax - monthlyFixed - clawback;
      currentSavings = FinancialMath.add(currentSavings, disposable);

      if (breakEvenMonth === null && currentSavings > inputs.savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: monthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === LAYOFF_MONTH ? 'LAYOFF_RISK' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'startup',
      equityPct: inputs.equityPct,
      equityIlliquid: true,
      hasRelocation: inputs.hasRelocation,
      relocationClawbackMonths: inputs.relocationClawbackMonths,
      hasSeverance: inputs.hasSeverance,
      baseAnnual: inputs.baseAnnual,
      marketRate,
      monthlyFixed,
      monthlyBase
    });

    return {
      name: `${inputs.companyName} (Startup Scenario)`,
      type: 'startup',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: col ? {
        source: col.source,
        city: col.city,
        country: col.country,
        fetched_at: col.fetched_at,
        data_quality: col.data_quality || 'live',
        note: col.note
      } : {
        source: 'fallback',
        note: 'Cost-of-living service unavailable. Using conservative defaults.'
      },
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _buildBigTechScenario(inputs, monthlyFixed, taxRate, marketRate, col) {
    const monthlyBase = FinancialMath.monthlyFromAnnual(inputs.baseAnnual);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(inputs.bonusTarget * 0.85);
    const equityAnnual = FinancialMath.percentOf(inputs.equityValuation, inputs.equityPct / 100);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityAnnual);

    const projection = [];
    let currentSavings = inputs.savings;
    let breakEvenMonth = null;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      if (month >= 18) income = Math.round(income * 1.08);

      const tax = FinancialMath.percentOf(income, taxRate);
      const disposable = income - tax - monthlyFixed;
      currentSavings = FinancialMath.add(currentSavings, disposable);

      if (breakEvenMonth === null && currentSavings > inputs.savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: monthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === 18 ? 'PROMOTION' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'big_tech',
      equityPct: inputs.equityPct,
      equityIlliquid: false,
      hasRelocation: inputs.hasRelocation,
      relocationClawbackMonths: inputs.relocationClawbackMonths,
      hasSeverance: inputs.hasSeverance,
      baseAnnual: inputs.baseAnnual,
      marketRate,
      monthlyFixed,
      monthlyBase
    });

    return {
      name: `${inputs.companyName} (Big Tech Scenario)`,
      type: 'big_tech',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: col ? {
        source: col.source,
        city: col.city,
        country: col.country,
        fetched_at: col.fetched_at,
        data_quality: col.data_quality || 'live',
        note: col.note
      } : {
        source: 'fallback',
        note: 'Cost-of-living service unavailable. Using conservative defaults.'
      },
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _buildRemoteScenario(inputs, monthlyFixed, taxRate, marketRate, col) {
    const adjustedBase = FinancialMath.percentOf(inputs.baseAnnual, 0.85);
    const monthlyBase = FinancialMath.monthlyFromAnnual(adjustedBase);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(inputs.bonusTarget * 0.60);
    const equityAnnual = FinancialMath.percentOf(inputs.equityValuation, inputs.equityPct / 100);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityAnnual);

    const remoteRent = col && typeof col.rent_1br_cents === 'number'
      ? Math.round(col.rent_1br_cents * 0.60)
      : FinancialMath.toCents(1400);
    const remoteMonthlyFixed = remoteRent + (monthlyFixed * 0.4);

    const projection = [];
    let currentSavings = inputs.savings;
    let breakEvenMonth = null;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      if (month >= 21) income = Math.round(income * 1.04);

      const remoteTaxRate = taxRate * 0.90;
      const tax = FinancialMath.percentOf(income, remoteTaxRate);
      const disposable = income - tax - remoteMonthlyFixed;
      currentSavings = FinancialMath.add(currentSavings, disposable);

      if (breakEvenMonth === null && currentSavings > inputs.savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: remoteMonthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === 21 ? 'SLOW_PROMOTION' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'remote',
      equityPct: inputs.equityPct,
      equityIlliquid: false,
      hasRelocation: inputs.hasRelocation,
      relocationClawbackMonths: inputs.relocationClawbackMonths,
      hasSeverance: inputs.hasSeverance,
      baseAnnual: adjustedBase,
      marketRate: this._getMarketRate('Remote', col),
      monthlyFixed: remoteMonthlyFixed,
      monthlyBase
    });

    return {
      name: `${inputs.companyName} (Remote Scenario)`,
      type: 'remote',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: col ? {
        source: col.source,
        city: col.city,
        country: col.country,
        fetched_at: col.fetched_at,
        data_quality: col.data_quality || 'live',
        note: col.note
      } : {
        source: 'fallback',
        note: 'Cost-of-living service unavailable. Using conservative defaults.'
      },
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _calculateTrapRisk({ companyType, equityPct, equityIlliquid, hasRelocation, relocationClawbackMonths, hasSeverance, baseAnnual, marketRate, monthlyFixed, monthlyBase }) {
    let score = 0;

    if (equityIlliquid && equityPct > 1.0) score += 30;
    else if (equityIlliquid && equityPct > 0.5) score += 25;
    else if (equityIlliquid) score += 20;
    else if (companyType === 'startup') score += 15;
    else score += 5;

    if (hasRelocation && relocationClawbackMonths >= 24) score += 25;
    else if (hasRelocation && relocationClawbackMonths >= 12) score += 20;
    else if (hasRelocation) score += 15;

    if (!hasSeverance) score += 15;
    else score += 5;

    if (marketRate > 0) {
      if (baseAnnual < marketRate * 0.85) score += 15;
      else if (baseAnnual < marketRate * 0.95) score += 10;
      else if (baseAnnual < marketRate) score += 5;
    }

    const runwayMonths = (monthlyBase > 0 && monthlyFixed > 0)
      ? Math.floor((monthlyBase * 3) / monthlyFixed)
      : 6;

    if (runwayMonths < 3) score += 15;
    else if (runwayMonths < 6) score += 10;
    else if (runwayMonths < 9) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  static _getRiskBreakdown(score) {
    if (score >= 70) return { level: 'HIGH', color: '#ef4444', label: 'High Trap Risk' };
    if (score >= 40) return { level: 'MEDIUM', color: '#f59e0b', label: 'Moderate Risk' };
    return { level: 'LOW', color: '#22c55e', label: 'Low Risk' };
  }

  static _getMarketRate(location, colData) {
    const baseRates = {
      'San Francisco': 18000000, 'New York': 17500000, 'Seattle': 16000000,
      'Austin': 13000000, 'Remote': 12000000, 'Default': 14000000
    };

    if (!location || typeof location !== 'string') return baseRates.Default;

    const key = Object.keys(baseRates).find(k => location.toLowerCase().includes(k.toLowerCase()));
    let baseRate = key ? baseRates[key] : baseRates.Default;

    if (colData && typeof colData.market_adjustment === 'number') {
      baseRate = Math.round(baseRate * colData.market_adjustment);
    }

    return baseRate;
  }
}

module.exports = IncomeSimulationService;