// aiAnalysisService.js — FIXED v2.3
// Fixes: model name -> gemini-2.5-flash (current free tier model as of May 2026)
//        robust JSON extraction, fallback structure

const genAI = require('../config/geminiClient');

const getModel = () => {
  if (!genAI) {
    console.log('❌ Gemini client not initialized');
    return null;
  }
  // FIXED: Use gemini-2.5-flash — the only model confirmed working on free tier in 2026
  // gemini-1.5-flash and gemini-1.5-flash-8b are deprecated/removed from free tier
  return genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  });
};

/**
 * Robust JSON extractor — handles markdown blocks, extra text, nested braces
 */
const safeJSONParse = (text) => {
  if (!text) return null;

  // Strategy 1: Extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }

  // Strategy 2: Find first balanced JSON object
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch {}
      }
    }
  }

  // Strategy 3: Greedy fallback
  const greedyMatch = text.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try { return JSON.parse(greedyMatch[0]); } catch {}
  }

  return null;
};

/**
 * Feature 1: AI Opportunity Explanation
 */
exports.generateOpportunityExplanation = async (opportunity, userProfile, scoreResult) => {
  try {
    const model = getModel();
    if (!model) return getFallbackExplanation(opportunity, userProfile, scoreResult);

    const skills = userProfile?.skills?.map(s => s.skill_name || s).join(', ') || 'general skills';
    const hours = userProfile?.time_per_week || 10;
    const experience = userProfile?.experience_level || 'beginner';

    const prompt = `You are a career intelligence analyst for LINKUP, a futuristic career matching platform.

Write a compelling, specific explanation for why this opportunity matches this user. Be data-driven and honest.

OPPORTUNITY: ${opportunity.title}
CATEGORY: ${opportunity.category || 'General'}
REQUIRED SKILLS: ${(opportunity.required_skills || []).join(', ')}
USER SKILLS: ${skills}
EXPERIENCE LEVEL: ${experience}
SKILL MATCH: ${scoreResult.skillMatch}%
DEMAND: ${opportunity.demand_score}/10
COMPETITION: ${opportunity.competition_score}/10
INCOME SPEED: ${opportunity.income_speed}/10
WEEKLY HOURS: ${hours}
MARKET TREND: ${opportunity.market_trend || 'Growing'}

RULES:
- Sentence 1: Explain skill alignment specifically. Mention actual skill names from the user's profile.
- Sentence 2: Give realistic timeline to first income based on hours/week and experience.
- Sentence 3: Mention one market advantage (demand, trend, or competition angle).
- Tone: Professional, encouraging, honest. Never oversell.
- Return ONLY JSON: {"summary": "...", "timeline": "...", "market_edge": "..."}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = safeJSONParse(text);
    if (parsed) {
      const fb = getFallbackExplanation(opportunity, userProfile, scoreResult);
      return {
        summary: parsed.summary || fb.summary,
        timeline: parsed.timeline || fb.timeline,
        market_edge: parsed.market_edge || fb.market_edge,
        source: 'AI'
      };
    }

    return getFallbackExplanation(opportunity, userProfile, scoreResult);

  } catch (error) {
    console.error('AI explanation error:', error.message);
    return getFallbackExplanation(opportunity, userProfile, scoreResult);
  }
};

/**
 * Feature 2: AI 30-Day Execution Plan — FIXED
 */
exports.generateExecutionPlan = async (userProfile, opportunity) => {
  try {
    const model = getModel();
    if (!model) return getFallbackPlan();

    const skills = userProfile?.skills?.map(s => s.skill_name || s).join(', ') || 'beginner';
    const hours = userProfile?.time_per_week || 10;
    const experience = userProfile?.experience_level || 'beginner';

    const prompt = `Create a practical, specific 30-day execution plan for starting ${opportunity.title} services.

USER PROFILE:
- Available: ${hours} hours/week
- Experience: ${experience}
- Current skills: ${skills}
- Target: First paying client within 30-45 days

OPPORTUNITY DETAILS:
- Required skills: ${(opportunity.required_skills || []).join(', ')}
- Income speed: ${opportunity.income_speed}/10
- Barrier to entry: ${opportunity.barrier_to_entry || 'Medium'}

OUTPUT FORMAT (strict JSON):
{
  "weeks": [
    {
      "week": 1,
      "focus": "One-line focus",
      "tasks": ["Specific actionable task 1", "Specific actionable task 2", "Specific actionable task 3"],
      "deliverable": "What you should have by end of week"
    }
  ],
  "milestones": [
    {"day": 7, "milestone": "..."},
    {"day": 14, "milestone": "..."},
    {"day": 30, "milestone": "..."}
  ]
}

RULES:
- Each task MUST be specific (NOT "learn more" or "research")
- Week 1: Environment setup, core concepts, first small deliverable
- Week 2: Hands-on practice, mini project, skill application
- Week 3: Portfolio piece, credibility building, case study
- Week 4: Outreach, pitching, client acquisition, first proposal
- Tasks must fit within ${hours} hours total per week
- Return ONLY valid JSON, no markdown, no code blocks`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = safeJSONParse(text);
    if (!parsed) throw new Error('No JSON in response');

    // Normalize to flat week properties (week_1..week_4) for controller compatibility
    const weeks = parsed.weeks || [];
    return {
      weeks,
      milestones: parsed.milestones || [],
      week_1: weeks[0] || null,
      week_2: weeks[1] || null,
      week_3: weeks[2] || null,
      week_4: weeks[3] || null,
      source: 'AI'
    };

  } catch (error) {
    console.error('AI plan error:', error.message);
    return getFallbackPlan();
  }
};

/**
 * Feature 3: "Why Not This Path?" AI Explanation
 */
exports.generateWhyNotExplanation = async (opportunity, scoreResult, incomeProbability) => {
  try {
    const model = getModel();
    if (!model) return null;

    const prompt = `Explain why this opportunity ranks lower for this user. Be transparent, constructive, and actionable.

OPPORTUNITY: ${opportunity.title}
SCORE: ${scoreResult.total}/100
SKILL MATCH: ${scoreResult.skillMatch}%
COMPETITION: ${opportunity.competition_score}/10
INCOME PROBABILITY: ${incomeProbability.level} (${incomeProbability.range})
DEMAND: ${opportunity.demand_score}/10

Write 2-3 short bullet points explaining why. Be honest but suggest what would improve ranking.
Return JSON: {"reasons": ["reason 1", "reason 2"], "suggestion": "one-line actionable suggestion", "improvement_path": "specific skill or action to take"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = safeJSONParse(text);
    return parsed || null;

  } catch (error) {
    console.error('AI why-not error:', error.message);
    return null;
  }
};

/**
 * Resume skill extraction with error handling
 */
exports.extractSkillsFromResume = async (resumeText) => {
  if (!resumeText || resumeText.length < 50) {
    return { skills: [], error: 'Resume text too short or empty' };
  }

  try {
    const model = getModel();
    if (!model) {
      return { 
        skills: extractBasicSkills(resumeText), 
        fallback: true,
        error: 'AI unavailable, used basic extraction'
      };
    }

    const prompt = `Extract technical and professional skills from this resume. Return ONLY JSON array of strings.

Resume: ${resumeText.substring(0, 3000)}

Format: ["Skill 1", "Skill 2", "Skill 3"]
Rules:
- Extract 5-15 most relevant skills
- Use industry-standard names
- No soft skills (communication, teamwork)
- Return ONLY the JSON array, no other text`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = safeJSONParse(text);
    if (parsed && Array.isArray(parsed)) {
      return { skills: parsed.filter(s => s.length > 0 && s.length < 40), source: 'AI' };
    }

    return { 
      skills: extractBasicSkills(resumeText), 
      fallback: true 
    };

  } catch (error) {
    console.error('Resume extraction error:', error.message);
    return { 
      skills: extractBasicSkills(resumeText), 
      fallback: true,
      error: 'AI extraction failed, used fallback'
    };
  }
};

/**
 * Income explanation with fallback
 */
exports.generateIncomeExplanation = async (opportunity, incomePotential) => {
  try {
    const model = getModel();
    if (!model) {
      return `High demand in ${opportunity.title} drives $${incomePotential.toLocaleString()} monthly potential.`;
    }

    const prompt = `In one sentence, explain why ${opportunity.title} has $${incomePotential.toLocaleString()} monthly income potential. Mention demand score ${opportunity.demand_score}/10 and competition ${opportunity.competition_score}/10. Be concise and data-driven.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    return `High demand (${opportunity.demand_score}/10) and manageable competition make ${opportunity.title} lucrative at $${incomePotential.toLocaleString()}/month.`;
  }
};

// ─── FALLBACK HELPERS ───

function getFallbackExplanation(opportunity, userProfile, scoreResult) {
  const hours = userProfile?.time_per_week || 10;
  const matchLevel = scoreResult.skillMatch >= 70 ? 'strong' : scoreResult.skillMatch >= 40 ? 'moderate' : 'limited';

  return {
    summary: `${opportunity.title} shows ${matchLevel} alignment with your profile at ${scoreResult.skillMatch}% skill match. Market demand is ${opportunity.demand_score > 7 ? 'strong' : 'moderate'} with ${opportunity.competition_score > 7 ? 'high' : 'manageable'} competition.`,
    timeline: `With ${hours} hours/week dedication, expect to land your first client within ${hours > 15 ? '30-45' : '45-60'} days.`,
    market_edge: opportunity.market_trend || 'Growing market segment',
    fallback: true
  };
}

function getFallbackPlan() {
  const weeks = [
    { week: 1, focus: 'Foundation & Setup', tasks: ['Set up your workspace and tools', 'Complete one beginner tutorial', 'Define your target client profile'], deliverable: 'Ready workspace + client profile' },
    { week: 2, focus: 'Skill Practice', tasks: ['Build a small practice project', 'Document your process', 'Get feedback from one peer'], deliverable: 'Practice project completed' },
    { week: 3, focus: 'Portfolio Building', tasks: ['Create 2 portfolio pieces', 'Write case studies for each', 'Set up a simple portfolio page'], deliverable: '2 portfolio pieces + case studies' },
    { week: 4, focus: 'Client Acquisition', tasks: ['Reach out to 10 potential clients', 'Send 5 personalized proposals', 'Follow up on all responses'], deliverable: '5 proposals sent + first conversations' }
  ];

  return {
    weeks,
    milestones: [
      { day: 7, milestone: 'Tools and workspace ready' },
      { day: 14, milestone: 'First practice project complete' },
      { day: 30, milestone: 'First client conversation scheduled' }
    ],
    week_1: weeks[0],
    week_2: weeks[1],
    week_3: weeks[2],
    week_4: weeks[3],
    source: 'fallback'
  };
}

function extractBasicSkills(resumeText) {
  const commonSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'HTML', 'CSS', 'SQL', 'MongoDB',
    'AWS', 'Docker', 'Git', 'TypeScript', 'Java', 'C++', 'PHP', 'Ruby',
    'Marketing', 'SEO', 'Content Writing', 'Social Media', 'Analytics',
    'Design', 'Figma', 'Photoshop', 'Illustrator', 'UI/UX',
    'Excel', 'Data Analysis', 'Project Management', 'Agile', 'Scrum',
    'Sales', 'CRM', 'Customer Support', 'Email Marketing', 'Copywriting'
  ];

  const text = resumeText.toLowerCase();
  return commonSkills.filter(skill => text.includes(skill.toLowerCase())).slice(0, 10);
}

module.exports = exports;