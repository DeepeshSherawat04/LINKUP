// aiOpportunityGenerator.js — Gemini 2.5 Flash Lite powered opportunity generation
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate personalized opportunities based on user skills
 * Uses Gemini 2.5 Flash Lite for fast, cheap generation
 */
exports.generateOpportunities = async (userSkills, userProfile) => {
  const skillsStr = userSkills.join(', ');
  const hours = userProfile?.time_per_week || 15;
  const goalType = userProfile?.goal_type || 'freelance';

  const prompt = `You are an expert career strategist and market analyst. Generate 3 high-quality, realistic freelance/creator opportunities based on the user's skills.

USER PROFILE:
- Skills: ${skillsStr}
- Hours per week: ${hours}
- Goal type: ${goalType}

INSTRUCTIONS:
1. Generate exactly 3 opportunities that MATCH the user's skills
2. Each opportunity must be a real, in-demand role in 2026
3. Return ONLY valid JSON — no markdown, no explanations

JSON FORMAT:
[
  {
    "title": "Specific job title",
    "description": "2-3 sentence description of what the role does",
    "category": "Relevant category",
    "required_skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
    "demand_score": 1-10,
    "competition_score": 1-10,
    "income_speed": 1-10,
    "future_proof_rating": 1-10,
    "barrier_to_entry": "Low|Medium|High",
    "time_to_first_income": "X-Y weeks",
    "income_potential_usd": monthly estimate number,
    "market_trend": "One-line trend description with emoji",
    "tags": ["tag1", "tag2"]
  }
]

RULES:
- demand_score: 8-10 for hot markets, 5-7 for steady, 1-4 for niche
- competition_score: 1-4 for blue ocean, 5-7 for moderate, 8-10 for saturated
- income_speed: 8-10 if can earn in 1-2 weeks, 5-7 for 3-4 weeks, 1-4 for 2+ months
- future_proof_rating: 8-10 for AI-resilient/growing, 5-7 for stable, 1-4 for declining
- barrier_to_entry: "Low" if beginner-friendly, "Medium" if some experience needed, "High" if expert-level
- required_skills MUST include at least 2 of the user's actual skills
- income_potential_usd: realistic monthly earning in USD (e.g., 4000, 7500, 12000)`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown wrappers)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Gemini response');
    }

    const opportunities = JSON.parse(jsonMatch[0]);

    // Validate and sanitize
    return opportunities.map((opp, index) => ({
      id: `ai-gen-${Date.now()}-${index}`,
      title: opp.title,
      description: opp.description,
      category: opp.category,
      required_skills: opp.required_skills,
      demand_score: Math.min(10, Math.max(1, opp.demand_score)),
      competition_score: Math.min(10, Math.max(1, opp.competition_score)),
      income_speed: Math.min(10, Math.max(1, opp.income_speed)),
      future_proof_rating: Math.min(10, Math.max(1, opp.future_proof_rating)),
      barrier_to_entry: opp.barrier_to_entry,
      time_to_first_income: opp.time_to_first_income,
      income_potential: opp.income_potential_usd,
      market_trend: opp.market_trend,
      tags: opp.tags,
      is_ai_generated: true,
      generated_at: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Gemini opportunity generation failed:', error.message);
    // Return fallback opportunities if AI fails
    return generateFallbackOpportunities(userSkills);
  }
};

/**
 * Fallback opportunities if Gemini API fails
 */
function generateFallbackOpportunities(userSkills) {
  const skillStr = userSkills.join(', ');
  return [{
    id: `fallback-${Date.now()}`,
    title: `${skillStr} Specialist`,
    description: `Offer specialized services leveraging your expertise in ${skillStr}.`,
    category: 'Freelance Services',
    required_skills: userSkills,
    demand_score: 7,
    competition_score: 5,
    income_speed: 6,
    future_proof_rating: 7,
    barrier_to_entry: 'Medium',
    time_to_first_income: '3-4 weeks',
    income_potential: 5000,
    market_trend: '📈 Rising — Specialized skills always in demand',
    tags: ['Freelance', 'Specialist'],
    is_ai_generated: true,
    generated_at: new Date().toISOString()
  }];
}