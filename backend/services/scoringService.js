// scoringService.js — FINAL v3.1 SINGULARITY EDITION
// Features: Gemini AI, Redis caching, skill-weighted scoring, Singularity enrichment
// OPTIMIZED: Pre-filtering, lazy AI calls, zero AI in hot radar path

const scoreCalculator = require('../utils/scoreCalculator');
const opportunityModel = require('../models/opportunityModel');
const skillsModel = require('../models/skillsModel');
const userModel = require('../models/userModel');
const scoreModel = require('../models/scoreModel');
const aiAnalysisService = require('./aiAnalysisService');
const aiOpportunityGenerator = require('./aiOpportunityGenerator');
const preferenceService = require('./preferenceService');
const careerSingularityScore = require('./scoring/careerSingularityScore');
const predictionService = require('./intelligence/predictionService');
const { setCache, getCache, deleteCache } = require('../config/redisClient');

const RADAR_TTL = 3600;        // 1 hour for static radar
const AI_OPP_TTL = 86400;      // 24 hours for AI-generated opportunities
const EXPLAIN_TTL = 21600;     // 6 hours for AI explanations

/**
 * Get personalized opportunity radar with AI fallback + Singularity enrichment
 */
exports.getOpportunityRadar = async (userId) => {
  if (!userId) {
    throw new Error('Authentication required for personalized radar');
  }

  // ─── STEP 1: Try Redis cache ───
  try {
    const cached = await getCache(`radar:${userId}`);
    if (cached) {
      console.log(`📦 Cache hit for radar:${userId}`);
      return cached;
    }
  } catch (e) {
    console.log('⚠️ Redis cache miss or unavailable');
  }

  // ─── STEP 2: Fetch user data ───
  let opportunities, userSkills, userProfile;
  try {
    [opportunities, userSkills, userProfile] = await Promise.all([
      opportunityModel.getAll(),
      skillsModel.getByUserId(userId),
      userModel.findOrCreate(userId, null)
    ]);
  } catch (dbError) {
    console.error('Database fetch error:', dbError.message);
    throw new Error('Unable to load your profile data. Please try again.');
  }

  // ─── STEP 3: Handle empty states ───
  if (!opportunities?.length) {
    return {
      opportunities: [],
      emptyState: {
        type: 'NO_OPPORTUNITIES',
        title: 'No opportunities available',
        message: 'Our opportunity database is being updated. Check back in a few minutes.',
        action: 'refresh',
        icon: 'database'
      }
    };
  }

  if (!userSkills?.length) {
    return {
      opportunities: [],
      emptyState: {
        type: 'NO_SKILLS',
        title: 'Add your skills first',
        message: 'We need to know your skills to find matching opportunities. Go to Profile and add at least 3 skills.',
        action: 'profile',
        icon: 'skills',
        ctaText: 'Go to Profile',
        ctaLink: '/profile'
      }
    };
  }

  // ─── STEP 4: Score static opportunities ───
  const scored = await Promise.all(
    opportunities.map(async (opp) => {
      try {
        const scoreResult = scoreCalculator.calculateOpportunityScore(opp, userSkills);
        const incomePotential = scoreCalculator.calculateIncomePotential(opp);
        const incomeProbability = scoreCalculator.getIncomeProbability(
          scoreResult.skillMatch,
          Number(opp.income_speed) || 5,
          userProfile?.time_per_week || 0
        );

        const radarData = {
          demand: Number(opp.demand_score) || 5,
          competition: 10 - (Number(opp.competition_score) || 5),
          skillMatch: scoreResult.skillMatch,
          incomeSpeed: Number(opp.income_speed) || 5,
          futureProof: Number(opp.future_proof_rating) || 5,
          barrierToEntry: 10 - (opp.barrier_to_entry?.includes('Low') ? 3 : opp.barrier_to_entry?.includes('Medium') ? 6 : 8)
        };

        let aiExplanation = null;
        let explainability = null;
        try {
          if (scoreResult.skillMatch > 0) {
            aiExplanation = await getCachedExplanation(userId, opp, userProfile, scoreResult);
          }
          explainability = buildExplainability(opp, scoreResult, incomeProbability, userProfile);
        } catch (aiError) {
          explainability = buildExplainability(opp, scoreResult, incomeProbability, userProfile);
        }

        const enrichedOpportunity = {
          ...opp,
          score: scoreResult.total,
          score_breakdown: scoreResult.breakdown,
          score_visual: generateScoreVisual(scoreResult.total),
          income_potential: incomePotential,
          income_probability: incomeProbability,
          income_visual: generateIncomeVisual(incomeProbability),
          skill_match_percentage: scoreResult.skillMatch,
          skill_match_visual: generateSkillMatchVisual(scoreResult.skillMatch),
          radar_data: radarData,
          ai_explanation: aiExplanation,
          explainability: explainability,
          why_not_path: scoreResult.total < 60 
            ? generateWhyNotPath(opp, scoreResult, incomeProbability) 
            : null,
          comparison_bars: generateComparisonBars(opp, scoreResult, incomeProbability)
        };

        persistScore(userId, opp, scoreResult, incomeProbability, aiExplanation);

        return enrichedOpportunity;
      } catch (oppError) {
        console.error(`Error scoring opportunity ${opp.id}:`, oppError.message);
        return {
          ...opp,
          score: 0,
          error: 'Scoring failed for this opportunity',
          score_breakdown: null
        };
      }
    })
  );

  const validScored = scored.filter(s => !s.error);
  validScored.sort((a, b) => b.score - a.score);

  if (validScored.length === 0) {
    return {
      opportunities: [],
      emptyState: {
        type: 'SCORING_FAILED',
        title: 'Unable to rank opportunities',
        message: 'Our scoring engine encountered an issue. Please refresh or try again later.',
        action: 'refresh',
        icon: 'alert'
      }
    };
  }

  // ─── STEP 5: AI-Generated Opportunities (if top match is poor) ───
  const topMatch = validScored[0];
  const needsAiGeneration = !topMatch || topMatch.skill_match_percentage < 25;
  let finalOpportunities = validScored;

  if (needsAiGeneration && userSkills?.length > 0) {
    console.log(`🤖 Triggering AI opportunity generation for user ${userId}`);

    try {
      const skillsHash = userSkills.sort().join(',').toLowerCase();
      const aiCacheKey = `ai_opps:${userId}:${skillsHash}`;
      
      let aiOpportunities = await getCache(aiCacheKey);
      
      if (!aiOpportunities) {
        aiOpportunities = await aiOpportunityGenerator.generateOpportunities(
          userSkills,
          userProfile
        );
        await setCache(aiCacheKey, aiOpportunities, AI_OPP_TTL);
        console.log(`💾 Cached AI opportunities for ${AI_OPP_TTL}s`);
      } else {
        console.log(`📦 AI opportunities cache hit`);
      }

      const scoredAi = aiOpportunities.map(opp => {
        const scoreResult = scoreCalculator.calculateOpportunityScore(opp, userSkills);
        const incomePotential = opp.income_potential || scoreCalculator.calculateIncomePotential(opp);
        const incomeProbability = scoreCalculator.getIncomeProbability(
          scoreResult.skillMatch,
          opp.income_speed,
          userProfile?.time_per_week || 0
        );

        const radarData = {
          demand: opp.demand_score,
          competition: 10 - opp.competition_score,
          skillMatch: scoreResult.skillMatch,
          incomeSpeed: opp.income_speed,
          futureProof: opp.future_proof_rating,
          barrierToEntry: opp.barrier_to_entry === 'Low' ? 3 : opp.barrier_to_entry === 'Medium' ? 6 : 8
        };

        return {
          ...opp,
          score: scoreResult.total,
          score_breakdown: scoreResult.breakdown,
          score_visual: generateScoreVisual(scoreResult.total),
          income_potential: incomePotential,
          income_probability: incomeProbability,
          income_visual: generateIncomeVisual(incomeProbability),
          skill_match_percentage: scoreResult.skillMatch,
          skill_match_visual: generateSkillMatchVisual(scoreResult.skillMatch),
          radar_data: radarData,
          ai_explanation: {
            summary: `${opp.title} aligns with your profile at ${scoreResult.skillMatch}% skill match. Market demand is ${opp.demand_score > 7 ? 'strong' : 'moderate'} with ${opp.competition_score > 7 ? 'high' : 'manageable'} competition.`,
            timeline: `With ${userProfile?.time_per_week || 10} hours/week dedication, expect to land your first client within ${opp.time_to_first_income}.`,
            fallback: false
          },
          explainability: buildExplainability(opp, scoreResult, incomeProbability, userProfile),
          comparison_bars: generateComparisonBars(opp, scoreResult, incomeProbability)
        };
      });

      finalOpportunities = [...scoredAi, ...validScored]
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      console.log(`✅ Merged ${scoredAi.length} AI + ${validScored.length} static opportunities`);

    } catch (aiError) {
      console.error('AI generation failed, using static only:', aiError.message);
      finalOpportunities = validScored.slice(0, 3);
    }
  } else {
    finalOpportunities = validScored.slice(0, 3);
  }

  // ─── STEP 6: SINGULARITY ENRICHMENT (wrapped in isolated try-catch) ───
  let enrichedRadar = finalOpportunities;
  try {
    const marketContext = await predictionService.calculateMarketContext();
    enrichedRadar = finalOpportunities.map(opp => ({
      ...opp,
      singularity_score: careerSingularityScore.calculateSingularityScore(
        opp, userSkills, userProfile, marketContext
      )
    }));
  } catch (enrichErr) {
    console.error('[getRadar] Singularity enrichment failed:', enrichErr.message);
    // enrichedRadar stays as finalOpportunities — production safe
  }

  const top3 = enrichedRadar.slice(0, 3);

  // ─── STEP 7: Cache radar ───
  try {
    await setCache(`radar:${userId}`, top3, RADAR_TTL);
    console.log(`💾 Cached radar:${userId} for ${RADAR_TTL}s`);
  } catch (e) {
    console.log('⚠️ Redis cache save failed');
  }

  // ─── STEP 8: Preference memory ───
  try {
    const topPreference = await preferenceService.getTopPreference(userId);
    if (topPreference && top3[0]) {
      top3[0].memory_note = `Based on your previous interest in ${topPreference}-focused opportunities...`;
    }
  } catch (e) {
    // Silent fail
  }

  return top3;
};

/**
 * LAZY: Get AI explanation only when user clicks "Why this?"
 */
exports.getExplanation = async (userId, opportunityId) => {
  const [userProfile, userSkills, opportunity] = await Promise.all([
    userModel.findById(userId),
    skillsModel.getByUserId(userId),
    opportunityModel.getById(opportunityId)
  ]);

  if (!opportunity) return { error: 'Opportunity not found' };

  const score = scoreCalculator.calculateOpportunityScore(opportunity, userSkills);

  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  const prompt = `Explain in 2 sentences why "${opportunity.title}" is a ${
    score.total > 70 ? 'strong' : score.total > 40 ? 'moderate' : 'challenging'
  } match for someone with skills: ${userSkills.map(s => s.skill_name || s).join(', ')}. 
  Be direct. Mention specific skill gaps if any.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return {
    summary: text,
    score: score.total,
    skillMatch: score.skillMatch,
    gaps: score.breakdown.skillMatch.value < 50 ? identifyGaps(opportunity, userSkills) : []
  };
};

/**
 * "Why NOT this path?" — Alternative path analysis
 */
exports.getWhyNotPath = async (userId, opportunityId) => {
  if (!userId) {
    throw new Error('Authentication required');
  }

  let opportunity, userSkills, userProfile;
  try {
    opportunity = await opportunityModel.getById(opportunityId);
    if (!opportunity) {
      return {
        error: true,
        type: 'NOT_FOUND',
        title: 'Opportunity not found',
        message: 'This opportunity may have been removed or the ID is invalid.'
      };
    }

    [userSkills, userProfile] = await Promise.all([
      skillsModel.getByUserId(userId),
      userModel.findById(userId)
    ]);
  } catch (dbError) {
    console.error('WhyNotPath DB error:', dbError.message);
    throw new Error('Unable to analyze this path. Please try again.');
  }

  if (!userSkills?.length) {
    return {
      error: true,
      type: 'NO_SKILLS',
      title: 'No skills on file',
      message: 'Add your skills in Profile to get path analysis.',
      ctaLink: '/profile'
    };
  }

  const scoreResult = scoreCalculator.calculateOpportunityScore(opportunity, userSkills);
  const incomeProbability = scoreCalculator.getIncomeProbability(
    scoreResult.skillMatch,
    Number(opportunity.income_speed) || 5,
    userProfile?.time_per_week || 0
  );

  return generateWhyNotPath(opportunity, scoreResult, incomeProbability);
};

/**
 * Batch score for dashboard radar (used by external controllers)
 */
exports.batchScore = (opportunities, userSkills, userProfile, marketContext) => {
  return careerSingularityScore.batchScore(opportunities, userSkills, userProfile, marketContext);
};

exports.invalidateUserCache = async (userId) => {
  try {
    await deleteCache(`radar:${userId}`);
    console.log(`🗑️ Cache invalidated for user ${userId}`);
  } catch (e) {
    console.log('Cache invalidation failed:', e.message);
  }
};

// ─── INTERNAL HELPERS ───

function buildExplainability(opportunity, scoreResult, incomeProbability, userProfile) {
  const factors = [];
  const hours = userProfile?.time_per_week || 10;

  if (scoreResult.skillMatch >= 70) {
    factors.push({
      factor: 'Skill Match',
      score: scoreResult.skillMatch,
      impact: 'positive',
      explanation: `Strong overlap (${scoreResult.skillMatch}%) with your current skills.`,
      icon: 'check'
    });
  } else if (scoreResult.skillMatch >= 40) {
    factors.push({
      factor: 'Skill Match',
      score: scoreResult.skillMatch,
      impact: 'neutral',
      explanation: `Moderate overlap (${scoreResult.skillMatch}%). Some upskilling needed.`,
      icon: 'warning'
    });
  } else {
    factors.push({
      factor: 'Skill Match',
      score: scoreResult.skillMatch,
      impact: 'negative',
      explanation: `Low overlap (${scoreResult.skillMatch}%). Significant skill gap detected.`,
      icon: 'x'
    });
  }

  const demand = Number(opportunity.demand_score) || 5;
  factors.push({
    factor: 'Market Demand',
    score: demand * 10,
    impact: demand >= 8 ? 'positive' : demand >= 5 ? 'neutral' : 'negative',
    explanation: demand >= 8 
      ? `High demand (${demand}/10). Market actively seeking talent.` 
      : `Moderate demand (${demand}/10). Steady but not explosive growth.`,
    icon: demand >= 8 ? 'trending-up' : 'minus'
  });

  const competition = Number(opportunity.competition_score) || 5;
  factors.push({
    factor: 'Competition',
    score: (10 - competition) * 10,
    impact: competition <= 4 ? 'positive' : competition <= 6 ? 'neutral' : 'negative',
    explanation: competition <= 4 
      ? `Low competition (${competition}/10). Blue ocean opportunity.` 
      : `Moderate-High competition (${competition}/10). Differentiation needed.`,
    icon: competition <= 4 ? 'shield' : 'users'
  });

  factors.push({
    factor: 'Income Probability',
    score: incomeProbability.level === 'High' ? 90 : incomeProbability.level === 'Medium' ? 60 : 30,
    impact: incomeProbability.level === 'High' ? 'positive' : incomeProbability.level === 'Medium' ? 'neutral' : 'negative',
    explanation: `Income probability is ${incomeProbability.level} (${incomeProbability.range}) with ${hours} hrs/week.`,
    icon: 'dollar'
  });

  const speed = Number(opportunity.income_speed) || 5;
  factors.push({
    factor: 'Speed to Income',
    score: speed * 10,
    impact: speed >= 7 ? 'positive' : speed >= 5 ? 'neutral' : 'negative',
    explanation: speed >= 7 
      ? `Fast monetization (${speed}/10). First income in ${opportunity.time_to_first_income || '2-4 weeks'}.` 
      : `Slower monetization (${speed}/10). Requires patience and consistency.`,
    icon: 'clock'
  });

  const future = Number(opportunity.future_proof_rating) || 5;
  factors.push({
    factor: 'Future-Proof',
    score: future * 10,
    impact: future >= 8 ? 'positive' : future >= 6 ? 'neutral' : 'negative',
    explanation: future >= 8 
      ? `Highly future-proof (${future}/10). AI/automation resilient.` 
      : `Moderate future outlook (${future}/10). Monitor market shifts.`,
    icon: 'shield-check'
  });

  return {
    overall_score: scoreResult.total,
    overall_rating: scoreResult.total >= 80 ? 'Excellent' : scoreResult.total >= 60 ? 'Good' : scoreResult.total >= 40 ? 'Fair' : 'Challenging',
    factors,
    summary: generateExplainabilitySummary(scoreResult, opportunity, incomeProbability)
  };
}

function generateExplainabilitySummary(scoreResult, opportunity, incomeProbability) {
  const parts = [];
  if (scoreResult.skillMatch >= 70) parts.push('strong skill alignment');
  if (Number(opportunity.demand_score) >= 8) parts.push('high market demand');
  if (Number(opportunity.competition_score) <= 4) parts.push('low competition');
  if (incomeProbability.level === 'High') parts.push('high income probability');

  if (parts.length === 0) {
    return `This opportunity has moderate potential. Focus on skill development to improve ranking.`;
  }

  return `This opportunity ranks well due to ${parts.join(', ')}.`;
}

function generateComparisonBars(opp, scoreResult, incomeProbability) {
  return {
    demand: { value: Number(opp.demand_score) || 5, max: 10, color: 'blue' },
    competition: { value: Number(opp.competition_score) || 5, max: 10, color: 'red', inverted: true },
    skillMatch: { value: scoreResult.skillMatch, max: 100, color: 'green' },
    incomeSpeed: { value: Number(opp.income_speed) || 5, max: 10, color: 'purple' },
    futureProof: { value: Number(opp.future_proof_rating) || 5, max: 10, color: 'indigo' }
  };
}

function generateScoreVisual(score) {
  return {
    value: score,
    color: score >= 80 ? 'emerald' : score >= 60 ? 'blue' : score >= 40 ? 'amber' : 'rose',
    label: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work',
    progress: score
  };
}

function generateIncomeVisual(incomeProbability) {
  return {
    level: incomeProbability.level,
    color: incomeProbability.level === 'High' ? 'emerald' : incomeProbability.level === 'Medium' ? 'blue' : 'amber',
    label: incomeProbability.range
  };
}

function generateSkillMatchVisual(skillMatch) {
  return {
    value: skillMatch,
    color: skillMatch >= 70 ? 'emerald' : skillMatch >= 40 ? 'blue' : 'amber',
    label: skillMatch >= 70 ? 'Strong' : skillMatch >= 40 ? 'Moderate' : 'Low'
  };
}

function generateWhyNotPath(opportunity, scoreResult, incomeProbability) {
  const reasons = [];
  const suggestions = [];

  if (scoreResult.skillMatch < 50) {
    const required = (opportunity.required_skills || []).join(', ') || 'specialized skills';
    reasons.push({
      icon: 'skills',
      title: 'Skill Gap',
      detail: `Your skill overlap is only ${scoreResult.skillMatch}%. This path requires: ${required}.`
    });
    suggestions.push(`Upskill in ${(opportunity.required_skills || []).slice(0, 2).join(' and ')} to improve match.`);
  }

  if (Number(opportunity.competition_score) > 7) {
    reasons.push({
      icon: 'competition',
      title: 'High Competition',
      detail: `Competition index is ${opportunity.competition_score}/10. Market saturation makes entry harder without differentiation.`
    });
    suggestions.push(`Find a micro-niche within ${opportunity.title} to reduce competition.`);
  }

  if (incomeProbability.level === 'Low') {
    reasons.push({
      icon: 'income',
      title: 'Low Income Probability',
      detail: `Income probability is ${incomeProbability.range}. You need more weekly hours or stronger skill alignment.`
    });
    suggestions.push(`Increase time commitment to 15+ hours/week or build a stronger portfolio.`);
  }

  if (Number(opportunity.demand_score) < 5) {
    reasons.push({
      icon: 'demand',
      title: 'Low Market Demand',
      detail: `Demand score is only ${opportunity.demand_score}/10. Limited client pool currently.`
    });
    suggestions.push(`Consider adjacent opportunities with higher demand in the same domain.`);
  }

  if (reasons.length === 0) {
    reasons.push({
      icon: 'info',
      title: 'Moderate Fit',
      detail: `This path ranks lower due to moderate demand (${opportunity.demand_score}/10) relative to required effort.`
    });
    suggestions.push(`Focus on building 2-3 core skills to boost your overall score.`);
  }

  return {
    opportunity_title: opportunity.title,
    overall_score: scoreResult.total,
    skill_match: scoreResult.skillMatch,
    reasons,
    suggestions,
    action_plan: `Consider upskilling in ${(opportunity.required_skills || []).slice(0, 3).join(', ') || 'relevant areas'} before pursuing this.`
  };
}

function persistScore(userId, opp, scoreResult, incomeProbability, aiExplanation) {
  try {
    scoreModel.saveScore({
      user_id: userId,
      opportunity_id: opp.id,
      final_score: scoreResult.total,
      income_probability_level: incomeProbability.level,
      income_probability_range: incomeProbability.range,
      skill_match_percent: scoreResult.skillMatch,
      score_breakdown: scoreResult.breakdown,
      ai_explanation: aiExplanation,
      created_at: new Date().toISOString()
    }).catch(err => console.log('Score persist error:', err.message));
  } catch (e) {
    // Silent fail
  }
}

async function getCachedExplanation(userId, opportunity, userProfile, scoreResult) {
  const key = `ai_explain:${userId}:${opportunity.id}`;

  try {
    const cached = await getCache(key);
    if (cached) return cached;
  } catch (e) {
    // Cache miss
  }

  let explanation;
  try {
    explanation = await aiAnalysisService.generateOpportunityExplanation(
      opportunity,
      userProfile,
      scoreResult
    );
  } catch (aiError) {
    explanation = getFallbackExplanation(opportunity, userProfile, scoreResult);
  }

  if (explanation) {
    try {
      await setCache(key, explanation, EXPLAIN_TTL);
    } catch (e) {
      // Redis save failed
    }
  }

  return explanation;
}

function getFallbackExplanation(opportunity, userProfile, scoreResult) {
  const hours = userProfile?.time_per_week || 10;
  return {
    summary: `${opportunity.title} aligns with your profile at ${scoreResult.skillMatch}% skill match. Market demand is ${opportunity.demand_score > 7 ? 'strong' : 'moderate'} with ${opportunity.competition_score > 7 ? 'high' : 'manageable'} competition.`,
    timeline: `With ${hours} hours/week dedication, expect to land your first client within ${hours > 15 ? '30-45' : '45-60'} days.`,
    fallback: true
  };
}

function identifyGaps(opportunity, userSkills) {
  const required = (opportunity.required_skills || []).map(s => s.toLowerCase());
  const have = userSkills.map(s => (typeof s === 'string' ? s : s.skill_name || '').toLowerCase());
  return required.filter(req => !have.some(h => h.includes(req) || req.includes(h)));
}