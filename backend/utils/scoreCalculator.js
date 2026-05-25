// utils/scoreCalculator.js
const calculateSkillMatch = (opportunity, userSkills) => {
  if (!opportunity.required_skills || !userSkills?.length) return 0;
  
  let required = opportunity.required_skills;
  if (typeof required === 'string') {
    try {
      required = JSON.parse(required);
    } catch {
      required = required.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(required) || required.length === 0) return 0;
  
  // 🛡️ FIX: Handle both string arrays and object arrays
  const userSkillNames = userSkills.map(s => {
    if (typeof s === 'string') return s.toLowerCase();
    return s.skill_name?.toLowerCase() || '';
  }).filter(Boolean); // Remove empty strings
  
  const matched = required.filter(req => {
    const reqLower = req.toLowerCase();
    return userSkillNames.some(us => 
      us.includes(reqLower) || reqLower.includes(us) || us === reqLower
    );
  }).length;
  
  return Math.round((matched / required.length) * 100);
};

const calculateOpportunityScore = (opportunity, userSkills) => {
  const demand = Number(opportunity.demand_score) || 5;
  const competition = Number(opportunity.competition_score) || 5;
  const incomeSpeed = Number(opportunity.income_speed) || 5;
  const skillMatch = calculateSkillMatch(opportunity, userSkills);
  
  const demandContribution = demand * 3;
  const incomeContribution = incomeSpeed * 2;
  const competitionPenalty = competition * 2;
  const skillContribution = skillMatch * 0.3;
  
  const rawScore = demandContribution + incomeContribution - competitionPenalty + skillContribution;
  const normalized = Math.max(0, Math.min(100, Math.round(rawScore + 20)));
  
  return {
    total: normalized,
    breakdown: {
      demand: { value: demand, weight: 30, contribution: Math.round(demandContribution), label: 'Demand Score' },
      competition: { value: competition, weight: 20, contribution: Math.round(competitionPenalty), label: 'Competition Index', isPenalty: true },
      incomeSpeed: { value: incomeSpeed, weight: 20, contribution: Math.round(incomeContribution), label: 'Income Speed' },
      skillMatch: { value: skillMatch, weight: 30, contribution: Math.round(skillContribution), label: 'Skill Match %' }
    },
    skillMatch
  };
};

const calculateIncomePotential = (opportunity) => {
  return (Number(opportunity.income_speed) || 5) * 1000;
};

const getIncomeProbability = (skillMatch, incomeSpeed, hoursPerWeek) => {
  if (skillMatch > 70 && incomeSpeed > 6 && hoursPerWeek > 15) {
    return { level: 'High', range: '65-80%', color: 'green', percentage: 75 };
  }
  if (skillMatch > 50 && incomeSpeed > 4 && hoursPerWeek > 10) {
    return { level: 'Medium', range: '40-60%', color: 'yellow', percentage: 50 };
  }
  return { level: 'Low', range: '15-35%', color: 'red', percentage: 25 };
};

module.exports = {
  calculateOpportunityScore,
  calculateIncomePotential,
  calculateSkillMatch,
  getIncomeProbability
};