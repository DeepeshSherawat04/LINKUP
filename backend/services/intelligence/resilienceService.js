/**
 * resilienceService.js — Anti-Fragile Career Index (AFCI)
 * Calculates exactly how "AI-proof" any skill stack is + generates immunization plans
 */

const AI_VULNERABLE_SKILLS = [
  'data entry', 'basic translation', 'simple copywriting', 'transcription',
  'basic graphic design', 'routine coding', 'manual testing', 'data labeling',
  'form processing', 'expense reporting', 'invoice processing', 'email filtering',
  'appointment scheduling', 'basic customer support', 'social media posting',
  'basic photo editing', 'template-based writing', 'simple data analysis'
];

const AI_RESISTANT_SKILLS = [
  'strategic planning', 'client relations', 'complex architecture',
  'creative direction', 'emotional intelligence', 'negotiation',
  'cross-functional leadership', 'novel problem solving', 'stakeholder management',
  'crisis management', 'vision setting', 'team building', 'mentorship',
  'ethical judgment', 'systems thinking', 'product intuition', 'org design',
  'change management', 'executive communication', 'board relations'
];

const HYBRID_SKILLS = [
  'data analysis', 'prompt engineering', 'ai workflow design',
  'human-in-the-loop oversight', 'model evaluation', 'ai integration',
  'llm orchestration', 'rag architecture', 'ai product management'
];

const SKILL_AUTOMATION_TIMELINE = {
  'data entry': { months: 6, confidence: 'high' },
  'basic translation': { months: 12, confidence: 'high' },
  'simple copywriting': { months: 18, confidence: 'medium' },
  'transcription': { months: 6, confidence: 'high' },
  'basic graphic design': { months: 24, confidence: 'medium' },
  'routine coding': { months: 36, confidence: 'medium' },
  'manual testing': { months: 24, confidence: 'high' },
  'strategic planning': { months: 120, confidence: 'low' },
  'creative direction': { months: 96, confidence: 'low' },
  'emotional intelligence': { months: 240, confidence: 'low' },
  'negotiation': { months: 180, confidence: 'low' },
  'cross-functional leadership': { months: 144, confidence: 'low' },
  'prompt engineering': { months: 48, confidence: 'medium' },
  'ai workflow design': { months: 60, confidence: 'medium' }
};

class ResilienceService {
  /**
   * Calculate AFCI for a single opportunity + user skill stack
   */
  calculateResilience(opportunity, userSkills) {
    const oppSkills = (opportunity.required_skills || []).map(s => s.toLowerCase());
    const userSkillNames = (userSkills || []).map(s => 
      (typeof s === 'string' ? s : (s.skill_name || s.name || '')).toLowerCase()
    ).filter(Boolean);

    let vulnerabilityScore = 0;
    let resistanceScore = 0;
    let hybridScore = 0;
    let atRiskSkills = [];
    let protectedSkills = [];

    // Score opportunity skills
    oppSkills.forEach(skill => {
      if (AI_VULNERABLE_SKILLS.some(v => skill.includes(v))) {
        vulnerabilityScore += 2;
        atRiskSkills.push(skill);
      }
      if (AI_RESISTANT_SKILLS.some(r => skill.includes(r))) {
        resistanceScore += 3;
        protectedSkills.push(skill);
      }
      if (HYBRID_SKILLS.some(h => skill.includes(h))) hybridScore += 1;
    });

    // Score user skills (personal moat analysis)
    userSkillNames.forEach(skill => {
      if (AI_VULNERABLE_SKILLS.some(v => skill.includes(v))) {
        vulnerabilityScore += 1.5;
        if (!atRiskSkills.includes(skill)) atRiskSkills.push(skill);
      }
      if (AI_RESISTANT_SKILLS.some(r => skill.includes(r))) {
        resistanceScore += 2;
        if (!protectedSkills.includes(skill)) protectedSkills.push(skill);
      }
      if (HYBRID_SKILLS.some(h => skill.includes(h))) hybridScore += 1.5;
    });

    const total = vulnerabilityScore + resistanceScore + hybridScore || 1;
    const afci = (resistanceScore / total) * 100;
    const hybridRatio = hybridScore / total;

    // Hybrid skills boost resilience because they co-opt AI rather than fight it
    const adjustedAfci = Math.min(100, afci + (hybridRatio * 15));

    // Calculate automation timeline for this specific role
    const timeline = this.calculateAutomationTimeline(oppSkills, userSkillNames);

    return {
      score: Math.round(adjustedAfci),
      rawScore: Math.round(afci),
      riskLevel: adjustedAfci > 75 ? 'Resilient' : adjustedAfci > 50 ? 'Mixed' : adjustedAfci > 25 ? 'Vulnerable' : 'High Risk',
      moatSkills: userSkillNames.filter(s => AI_RESISTANT_SKILLS.some(r => s.includes(r))).slice(0, 5),
      atRiskSkills: atRiskSkills.slice(0, 5),
      hybridAdvantage: hybridRatio > 0.3,
      automationTimeline: timeline.estimatedMonths,
      timelineConfidence: timeline.confidence,
      breakdown: {
        vulnerability: Math.round((vulnerabilityScore / total) * 100),
        resistance: Math.round((resistanceScore / total) * 100),
        hybrid: Math.round((hybridScore / total) * 100)
      },
      insights: {
        shortTerm: timeline.estimatedMonths < 24 ? '⚠️ This role faces significant automation pressure within 2 years' : null,
        longTerm: timeline.estimatedMonths > 60 ? '✅ This career path has strong long-term durability' : null,
        actionRequired: adjustedAfci < 50 ? '🚨 Urgent: Build AI-resistant skills immediately' : adjustedAfci < 75 ? '⚡ Recommended: Strengthen strategic and creative capabilities' : null
      }
    };
  }

  /**
   * Generate a 30-day skill immunization plan
   */
  generateImmunizationPlan(vulnerableSkill, userSkills, targetLevel = 'resistant') {
    const skill = vulnerableSkill.toLowerCase();
    const isHybrid = HYBRID_SKILLS.some(h => skill.includes(h));
    
    const phases = [
      {
        week: 1,
        focus: 'Deconstruct the "human layer"',
        tasks: [
          `Identify 3 decisions in ${skill} that require judgment, not just execution`,
          'Document your decision framework in a Notion doc',
          'Find 1 senior practitioner and interview them about edge cases'
        ],
        deliverable: 'Decision Framework Document'
      },
      {
        week: 2,
        focus: 'Build a portfolio piece with judgment',
        tasks: [
          `Create a project where ${skill} is applied to an ambiguous problem`,
          'Write 3 "what if" scenarios showing how you\'d handle exceptions',
          'Get feedback from a domain expert on your approach'
        ],
        deliverable: 'Judgment-Heavy Portfolio Project'
      },
      {
        week: 3,
        focus: 'Cross-train with an AI-resistant adjacent skill',
        tasks: [
          `Map ${skill} to a strategic skill (e.g., ${skill} + stakeholder communication)`,
          'Practice explaining your ${skill} work to non-technical executives',
          'Shadow a senior person in a role that combines both skills'
        ],
        deliverable: 'Cross-Skill Competency Proof'
      },
      {
        week: 4,
        focus: 'Publish and teach your methodology',
        tasks: [
          'Write a LinkedIn post or blog about your unique approach',
          'Offer to mentor someone junior in this skill',
          'Create a "when to use AI vs human judgment" decision tree'
        ],
        deliverable: 'Published Thought Leadership + Mentorship Proof'
      }
    ];

    const immunizedName = isHybrid 
      ? `Strategic ${vulnerableSkill} Architecture`
      : `Advanced ${vulnerableSkill} Strategy`;

    return {
      vulnerableSkill,
      targetLevel,
      duration: '30 days',
      immunizedSkillName: immunizedName,
      estimatedAutomationRisk: this.getAutomationRisk(skill),
      phases,
      exitCriteria: [
        `Can explain when NOT to use AI for ${skill}`,
        'Has a documented decision framework',
        'Has cross-trained with a strategic adjacent skill',
        'Has published or taught the skill to others'
      ],
      maintenancePlan: 'Re-evaluate every 6 months. AI capabilities shift rapidly.'
    };
  }

  /**
   * Batch resilience analysis for dashboard
   */
  batchAnalyze(opportunities, userSkills) {
    return opportunities.map(opp => ({
      ...opp,
      resilience: this.calculateResilience(opp, userSkills)
    }));
  }

  calculateAutomationTimeline(oppSkills, userSkills) {
    const allSkills = [...new Set([...oppSkills, ...userSkills])];
    let totalMonths = 0;
    let count = 0;
    let confidence = 'medium';

    allSkills.forEach(skill => {
      const match = Object.entries(SKILL_AUTOMATION_TIMELINE).find(([k]) => skill.includes(k));
      if (match) {
        totalMonths += match[1].months;
        count++;
        if (match[1].confidence === 'low') confidence = 'low';
      }
    });

    if (count === 0) return { estimatedMonths: 60, confidence: 'low' };
    
    const avg = totalMonths / count;
    return {
      estimatedMonths: Math.round(avg),
      confidence
    };
  }

  getAutomationRisk(skill) {
    const match = Object.entries(SKILL_AUTOMATION_TIMELINE).find(([k]) => skill.includes(k));
    if (!match) return { level: 'unknown', months: null };
    return {
      level: match[1].months < 24 ? 'High' : match[1].months < 60 ? 'Medium' : 'Low',
      months: match[1].months,
      confidence: match[1].confidence
    };
  }
}

module.exports = new ResilienceService();