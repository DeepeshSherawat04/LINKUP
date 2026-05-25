/**
 * careerSingularityScore.js — The "Secret Sauce" Algorithm
 * Career Singularity Index (CSI): 0-100 across 4 proprietary dimensions
 * 
 * Dimension Weights:
 * - Skill-Market Fit (SMF): 35%
 * - Temporal Advantage (TOP): 25%  
 * - Anti-Fragile Career Index (AFCI): 25%
 * - Arbitrage Potential (SAM): 15%
 */

const scoreCalculator = require('../../utils/scoreCalculator');

// ─── PROPRIETARY SKILL RISK DATABASE ───
const AI_VULNERABLE_SKILLS = [
  'data entry', 'basic translation', 'simple copywriting', 'transcription',
  'basic graphic design', 'routine coding', 'manual testing', 'data labeling',
  'form processing', 'basic customer support', 'schedule management',
  'expense reporting', 'invoice processing', 'email filtering'
];

const AI_RESISTANT_SKILLS = [
  'strategic planning', 'client relations', 'complex architecture',
  'creative direction', 'emotional intelligence', 'negotiation',
  'cross-functional leadership', 'novel problem solving', 'stakeholder management',
  'crisis management', 'vision setting', 'team building', 'mentorship',
  'ethical judgment', 'systems thinking', 'product intuition'
];

const HYBRID_SKILLS = [
  'data analysis', 'prompt engineering', 'ai workflow design',
  'human-in-the-loop oversight', 'model evaluation', 'ai integration'
];

/**
 * MASTER SCORE: Career Singularity Index (CSI)
 */
exports.calculateSingularityScore = (opportunity, userSkills, userProfile, marketContext = {}) => {
  try {
    // Dimension 1: Skill-Market Fit (existing logic, weighted by trend velocity)
    const smf = scoreCalculator.calculateOpportunityScore?.(opportunity, userSkills) || { total: 65 };

    // Dimension 2: Temporal Advantage (0-1 normalized)
    const temporalBoost = calculateTemporalAdvantage(marketContext, opportunity);

    // Dimension 3: Anti-Fragility (0-100)
    const afci = calculateAntiFragileIndex(opportunity, userSkills);

    // Dimension 4: Arbitrage Potential (0-100)
    const arbitrage = calculateArbitragePotential(opportunity, userProfile);

    // Weighted fusion — sums to 100 max
    const rawScore = (
      (smf.total || 0) * 0.35 +
      (temporalBoost * 100) * 0.25 +
      (afci.score || 0) * 0.25 +
      (arbitrage.index || 0) * 0.15
    );

    const total = Math.min(100, Math.max(0, Math.round(rawScore)));

    return {
      total,
      breakdown: {
        skillMarketFit: Math.round(smf.total || 0),
        temporalAdvantage: Math.round(temporalBoost * 100),
        antiFragileIndex: afci.score,
        arbitragePotential: arbitrage.index
      },
      insights: {
        temporal: temporalBoost > 0.7 
          ? '🔥 Emerging — demand rising faster than supply' 
          : temporalBoost > 0.4 
          ? '⚡ Growing — early mover advantage available'
          : '📊 Steady — established market',
        antiFragile: afci.riskLevel,
        arbitrage: arbitrage.recommendation,
        moatSkills: afci.moatSkills,
        automationTimeline: afci.automationTimeline,
        skillGap: smf.skillGap || []
      },
      meta: {
        calculatedAt: new Date().toISOString(),
        version: '2.0-singularity'
      }
    };
  } catch (error) {
    console.error('[CSI] Calculation error:', error);
    // Fail-safe: return neutral score so UI never breaks
    return {
      total: 50,
      breakdown: { skillMarketFit: 50, temporalAdvantage: 50, antiFragileIndex: 50, arbitragePotential: 50 },
      insights: { temporal: 'Analysis pending', antiFragile: 'Mixed', arbitrage: 'Local market', moatSkills: [] },
      meta: { error: true, calculatedAt: new Date().toISOString() }
    };
  }
};

// ─── DIMENSION 2: Temporal Advantage ───
function calculateTemporalAdvantage(marketContext, opportunity) {
  if (!marketContext?.trendVelocity) return 0.5;
  
  const category = opportunity.category || opportunity.industry || 'general';
  const velocity = marketContext.trendVelocity[category] || 0;
  const saturation = marketContext.competitionGrowth?.[category] || 0;
  const salaryGrowth = marketContext.salaryGrowth?.[category] || 0;
  
  // Early market = high velocity, low saturation, high salary growth
  const score = (
    (velocity * 0.5) + 
    (salaryGrowth * 0.3) - 
    (saturation * 0.2) + 
    0.5
  );
  
  return Math.max(0, Math.min(1, score));
}

// ─── DIMENSION 3: Anti-Fragile Career Index ───
function calculateAntiFragileIndex(opportunity, userSkills) {
  const oppSkills = (opportunity.required_skills || []).map(s => s.toLowerCase());
  const userSkillNames = (userSkills || []).map(s => 
    (typeof s === 'string' ? s : (s.skill_name || s.name || '')).toLowerCase()
  );

  let vulnerabilityScore = 0;
  let resistanceScore = 0;
  let hybridScore = 0;

  // Score opportunity skills
  oppSkills.forEach(skill => {
    if (AI_VULNERABLE_SKILLS.some(v => skill.includes(v))) vulnerabilityScore += 2;
    if (AI_RESISTANT_SKILLS.some(r => skill.includes(r))) resistanceScore += 3;
    if (HYBRID_SKILLS.some(h => skill.includes(h))) hybridScore += 1;
  });

  // Score user skills (personal moat analysis)
  userSkillNames.forEach(skill => {
    if (AI_VULNERABLE_SKILLS.some(v => skill.includes(v))) vulnerabilityScore += 1.5;
    if (AI_RESISTANT_SKILLS.some(r => skill.includes(r))) resistanceScore += 2;
    if (HYBRID_SKILLS.some(h => skill.includes(h))) hybridScore += 1.5;
  });

  const total = vulnerabilityScore + resistanceScore + hybridScore || 1;
  const afci = (resistanceScore / total) * 100;
  const hybridRatio = (hybridScore / total);

  // Hybrid skills boost resilience because they co-opt AI rather than fight it
  const adjustedAfci = Math.min(100, afci + (hybridRatio * 15));

  return {
    score: Math.round(adjustedAfci),
    riskLevel: adjustedAfci > 75 ? 'Resilient' : adjustedAfci > 50 ? 'Mixed' : adjustedAfci > 25 ? 'Vulnerable' : 'High Risk',
    moatSkills: userSkillNames.filter(s => 
      AI_RESISTANT_SKILLS.some(r => s.includes(r))
    ).slice(0, 3),
    automationTimeline: adjustedAfci > 75 ? '5+ years' : adjustedAfci > 50 ? '3-5 years' : adjustedAfci > 25 ? '1-3 years' : '< 1 year',
    hybridAdvantage: hybridRatio > 0.3
  };
}

// ─── DIMENSION 4: Skill Arbitrage Matrix ───
function calculateArbitragePotential(opportunity, userProfile) {
  const userLocation = userProfile?.location || userProfile?.city || 'Global';
  const localSalary = opportunity.local_salary_estimate || opportunity.income_potential * 0.6;
  const globalSalary = opportunity.income_potential || opportunity.salary_max || 5000;
  
  const arbitrageRatio = globalSalary / (localSalary || 1);
  // Normalize: ratio of 1.0 = 0 index, ratio of 3.0 = 100 index
  const index = Math.min(100, Math.max(0, ((arbitrageRatio - 1) / 2) * 100));

  let recommendation;
  if (arbitrageRatio > 2.0) {
    recommendation = `💰 Major geographic arbitrage: Remote roles pay ${arbitrageRatio.toFixed(1)}x your local market. Prioritize remote-first companies.`;
  } else if (arbitrageRatio > 1.5) {
    recommendation = `💡 Strong arbitrage available. Target ${opportunity.category || 'remote'} roles in tier-1 markets while living in ${userLocation}.`;
  } else if (arbitrageRatio > 1.2) {
    recommendation = '⚖️ Moderate arbitrage via remote work. Negotiate location-agnostic compensation.';
  } else {
    recommendation = '🏠 Local market is competitively priced for this role. Focus on skill premium instead.';
  }

  return {
    index: Math.round(index),
    ratio: arbitrageRatio.toFixed(1),
    localEstimate: Math.round(localSalary),
    globalEstimate: Math.round(globalSalary),
    recommendation,
    location: userLocation
  };
}

// Batch scoring for dashboard radar
exports.batchScore = (opportunities, userSkills, userProfile, marketContext) => {
  return opportunities.map(opp => ({
    ...opp,
    singularity_score: exports.calculateSingularityScore(opp, userSkills, userProfile, marketContext)
  })).sort((a, b) => (b.singularity_score?.total || 0) - (a.singularity_score?.total || 0));
};