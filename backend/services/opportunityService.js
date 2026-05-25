// opportunityService.js — UPGRADED v2.0
// Priority 1: Dataset Quality | Priority 4: Error resilience

const opportunityModel = require('../models/opportunityModel');
const { client: redisClient } = require('../config/redisClient');

const CACHE_KEY = 'opportunities:all';
const CACHE_TTL = 300; // 5 minutes

/**
 * Get all opportunities with caching and quality enforcement
 * Priority 1: Ensures high-quality, future-focused dataset
 */
exports.getAllWithCache = async () => {
  // Try Redis first
  try {
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate quality — if cached data is old/generic, invalidate
      if (isLowQualityData(parsed)) {
        console.log('⚠️ Cached data is low quality, fetching fresh');
        await redisClient.del(CACHE_KEY);
      } else {
        return parsed;
      }
    }
  } catch (e) {
    console.log('⚠️ Redis unavailable, proceeding to DB');
  }

  // Fetch from database
  let opportunities;
  try {
    opportunities = await opportunityModel.getAll();
  } catch (dbError) {
    console.error('Database fetch error:', dbError.message);
  }

  // If DB is empty, seed with high-quality data
  if (!opportunities?.length) {
    console.log('📭 DB empty — seeding high-quality opportunities');
    try {
      const { seedOpportunities } = require('../utils/opportunitySeedData');
      const { supabase } = require('../config/supabaseClient');
      await seedOpportunities(supabase);
      opportunities = await opportunityModel.getAll();
    } catch (seedError) {
      console.error('Seed failed:', seedError.message);
    }
  }

  // Quality check — if existing data is generic, enrich it
  const enriched = opportunities.map(opp => enrichOpportunityQuality(opp));

  // Save to Redis (ignore errors)
  try {
    await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(enriched));
  } catch (e) {
    console.log('⚠️ Redis cache save failed');
  }

  return enriched;
};

/**
 * Check if data is low quality (generic titles)
 * Priority 1 enforcement
 */
function isLowQualityData(opportunities) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) return true;

  const genericTitles = [
    'frontend developer', 'ui designer', 'content creator', 'web developer',
    'graphic designer', 'social media manager', 'data entry', 'virtual assistant'
  ];

  const lowQualityCount = opportunities.filter(opp => 
    genericTitles.some(generic => 
      opp.title?.toLowerCase().includes(generic)
    )
  ).length;

  // If more than 30% are generic, consider low quality
  return (lowQualityCount / opportunities.length) > 0.3;
}

/**
 * Enrich opportunity with quality metadata
 * Priority 1: Future-focused positioning
 */
function enrichOpportunityQuality(opp) {
  // If opportunity already has rich data, return as-is
  if (opp.future_proof_rating && opp.market_trend && opp.barrier_to_entry) {
    return opp;
  }

  // Otherwise, add default quality fields
  return {
    ...opp,
    future_proof_rating: opp.future_proof_rating || estimateFutureProof(opp.title),
    market_trend: opp.market_trend || estimateMarketTrend(opp.category),
    barrier_to_entry: opp.barrier_to_entry || estimateBarrier(opp.required_skills),
    time_to_first_income: opp.time_to_first_income || '4-8 weeks',
    tags: opp.tags || generateTags(opp.title, opp.category),
    quality_enriched: true
  };
}

function estimateFutureProof(title) {
  const highFuture = ['ai', 'automation', 'no-code', 'agent', 'llm', 'machine learning'];
  const medFuture = ['content', 'saas', 'consultant', 'strategist', 'growth'];

  const t = title.toLowerCase();
  if (highFuture.some(k => t.includes(k))) return 9;
  if (medFuture.some(k => t.includes(k))) return 7;
  return 6;
}

function estimateMarketTrend(category) {
  const trends = {
    'AI & Automation': '🔥 Exploding — Enterprise AI adoption accelerating',
    'Content & Education': '📈 Rising — Edutainment and micro-learning booming',
    'Finance & Content': '📈 Rising — Financial literacy gap driving demand',
    'Product & No-Code': '🔥 Exploding — No-code platforms democratizing SaaS',
    'Creator Economy': '📈 Rising — Creator economy worth $250B globally',
    'Growth & Local': '📈 Stable — Local business digital transformation ongoing'
  };
  return trends[category] || '📈 Growing — Market demand increasing';
}

function estimateBarrier(skills) {
  if (!skills?.length) return 'Medium';
  if (skills.length <= 3) return 'Low';
  if (skills.length <= 5) return 'Medium';
  return 'High';
}

function generateTags(title, category) {
  const baseTags = [category?.split(' & ')[0], category?.split(' & ')[1]].filter(Boolean);
  if (title.toLowerCase().includes('ai')) baseTags.push('AI');
  if (title.toLowerCase().includes('remote')) baseTags.push('Remote');
  if (title.toLowerCase().includes('local')) baseTags.push('Local');
  return [...new Set(baseTags)];
}

/**
 * Clear cache
 */
exports.clearCache = async () => {
  try {
    await redisClient.del(CACHE_KEY);
    console.log('🗑️ Opportunity cache cleared');
  } catch (e) {
    console.log('⚠️ Cache clear failed:', e.message);
  }
};

/**
 * Force refresh with high-quality data
 */
exports.refreshWithQualityData = async () => {
  try {
    await redisClient.del(CACHE_KEY);
    const { seedOpportunities } = require('../utils/opportunitySeedData');
    const { supabase } = require('../config/supabaseClient');
    await seedOpportunities(supabase);
    return await exports.getAllWithCache();
  } catch (e) {
    console.error('Quality refresh failed:', e.message);
    throw new Error('Unable to refresh opportunity data. Please try again.');
  }
};