// opportunityController.js — UPGRADED v2.0
// Priority 4: Proper Empty/Error States | Priority 2: Analytical responses

const opportunityModel = require('../models/opportunityModel');
const opportunityService = require('../services/opportunityService');
const scoringService = require('../services/scoringService');
const incomeSimulationService = require('../services/incomeSimulationService');
const skillsModel = require('../models/skillsModel');
const userModel = require('../models/userModel');
const careerSingularityScore = require('../services/scoring/careerSingularityScore');
const predictionService = require('../services/intelligence/predictionService');
const arbitrageService = require('../services/intelligence/arbitrageService');
const CareerTwin = require('../services/intelligence/careerTwinService');

// ─── HEALTH CHECK ───
exports.getHealth = async (req, res) => {
  const health = {
    status: 'OK',
    service: 'linkup-opportunities',
    version: '2.0',
    timestamp: new Date().toISOString(),
    features: [
      'smart-scoring',
      'skill-match',
      'income-probability',
      'ai-explanations',
      'redis-cache',
      'auth-required-radar',
      'explainable-paths',
      'analytical-dashboard',
      'future-proof-opportunities'
    ]
  };
  res.json({ success: true, data: health });
};

// ─── GET ALL OPPORTUNITIES ───
exports.getOpportunities = async (req, res, next) => {
  try {
    const opportunities = await opportunityService.getAllWithCache();

    if (!opportunities?.length) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          count: 0,
          emptyState: {
            type: 'NO_DATA',
            title: 'No opportunities available',
            message: 'Our opportunity database is being updated. Please check back shortly.',
            action: 'refresh'
          }
        }
      });
    }

    res.json({
      success: true,
      data: opportunities,
      meta: {
        count: opportunities.length,
        categories: [...new Set(opportunities.map(o => o.category).filter(Boolean))],
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('getOpportunities error:', err.message);
    res.status(503).json({
      success: false,
      error: {
        type: 'SERVICE_UNAVAILABLE',
        title: 'Unable to load opportunities',
        message: 'Our service is temporarily unavailable. Please try again in a moment.',
        action: 'retry'
      }
    });
  }
};

// ─── GET SINGLE OPPORTUNITY ───
exports.getOpportunityById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_ID',
          title: 'Invalid opportunity ID',
          message: 'Please provide a valid opportunity ID.',
          action: 'correct'
        }
      });
    }

    const opportunity = await opportunityModel.getById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          title: 'Opportunity not found',
          message: `We couldn't find an opportunity with ID "${id}". It may have been removed or the ID is incorrect.`,
          action: 'browse'
        }
      });
    }

    res.json({
      success: true,
      data: opportunity
    });
  } catch (err) {
    console.error('getOpportunityById error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        title: 'Unable to load opportunity',
        message: 'A database error occurred. Please try again.',
        action: 'retry'
      }
    });
  }
};

// ─── RADAR — Top 3 personalized opportunities ───
exports.getRadar = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTH_REQUIRED',
          title: 'Login required',
          message: 'Please sign in to see your personalized opportunity radar.',
          action: 'login',
          ctaText: 'Sign In',
          ctaLink: '/login'
        }
      });
    }

    const radar = await scoringService.getOpportunityRadar(userId);

    // Handle empty state object from service
    if (radar.emptyState) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          emptyState: radar.emptyState,
          generatedAt: new Date().toISOString()
        }
      });
    }

    // Validate radar data integrity
    if (!Array.isArray(radar) || radar.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          emptyState: {
            type: 'NO_MATCHES',
            title: 'No matching opportunities',
            message: "We couldn't find opportunities matching your current skills. Try adding more skills or broadening your profile.",
            action: 'profile',
            ctaText: 'Update Profile',
            ctaLink: '/profile'
          },
          generatedAt: new Date().toISOString()
        }
      });
    }

    // ─── NEW: Singularity Score Enrichment (wrapped in isolated try-catch) ───
    let enrichedRadar = radar;
    try {
      const [userProfile, userSkills] = await Promise.all([
        userModel.findById(userId),
        skillsModel.getByUserId(userId)
      ]);
      const marketContext = await predictionService.calculateMarketContext();

      enrichedRadar = radar.map(opp => ({
        ...opp,
        singularity_score: careerSingularityScore.calculateSingularityScore(
          opp, userSkills, userProfile, marketContext
        )
      }));
    } catch (enrichErr) {
      console.error('[getRadar] Enrichment failed, returning base radar:', enrichErr.message);
      // enrichedRadar stays as original radar — production safe
    }

    res.json({
      success: true,
      data: enrichedRadar,
      meta: {
        count: radar.length,
        topScore: radar[0]?.score || 0,
        generatedAt: new Date().toISOString(),
        hasExplanations: radar.some(r => r.ai_explanation),
        hasRadarData: radar.some(r => r.radar_data),
        hasSingularityScore: enrichedRadar !== radar
      }
    });
  } catch (err) {
    console.error('getRadar error:', err.message);

    if (err.message.includes('Authentication required')) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTH_REQUIRED',
          title: 'Authentication required',
          message: 'Please sign in to access your personalized radar.',
          action: 'login'
        }
      });
    }

    if (err.message.includes('Unable to load')) {
      return res.status(503).json({
        success: false,
        error: {
          type: 'SERVICE_ERROR',
          title: 'Service temporarily unavailable',
          message: err.message,
          action: 'retry'
        }
      });
    }

    if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
      return res.status(504).json({
        success: false,
        error: {
          type: 'AI_TIMEOUT',
          title: 'AI analysis timed out',
          message: "Our AI analysis took too long. We've queued your request — please refresh in 30 seconds.",
          action: 'refresh'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        title: 'Something went wrong',
        message: 'Unable to generate your opportunity radar. Please try again.',
        action: 'retry'
      }
    });
  }
};

exports.parseResume = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 3) {  // <-- CHANGED from 20 to 3
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_INPUT',
          title: 'Text too short',
          message: 'Please enter at least 3 characters.',
          action: 'correct'
        }
      });
    }

    // Keyword-based extraction (MVP — swap for OpenAI/Claude later)
    const commonSkills = [
      'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python',
      'Django', 'Flask', 'Java', 'Spring', 'C++', 'C#', '.NET', 'Go', 'Rust',
      'Ruby', 'Rails', 'PHP', 'Laravel', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB',
      'Redis', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
      'Linux', 'Git', 'CI/CD', 'GraphQL', 'REST', 'Microservices', 'SEO',
      'Marketing', 'Figma', 'UI/UX', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
      'Data Science', 'Machine Learning', 'Deep Learning', 'Blockchain', 'Solidity',
      'Web3', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Firebase', 'Supabase',
      'Prisma', 'Express', 'Fastify', 'NestJS', 'Next.js', 'Tailwind', 'Sass',
      'Three.js', 'D3.js', 'Tableau', 'Power BI', 'Excel', 'WordPress', 'Shopify',
      'Blender', 'Unity', 'Unreal', 'NLP', 'LLM', 'OpenCV', 'Scikit-learn'
    ];

    const foundSkills = commonSkills.filter(skill =>
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
    );

    res.json({
      success: true,
      data: {
        skills: foundSkills.slice(0, 20),
        extractedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('parseResume error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'EXTRACTION_ERROR',
        title: 'Resume parsing failed',
        message: 'Unable to extract skills from resume.',
        action: 'retry'
      }
    });
  }
};

// ─── INCOME SIMULATION ───
exports.simulateIncome = async (req, res, next) => {
  try {
    const { opportunityId } = req.params;
    const userId = req.user?.id;

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'MISSING_PARAM',
          title: 'Missing opportunity ID',
          message: 'Please provide an opportunity ID to simulate income.',
          action: 'correct'
        }
      });
    }

    const opportunity = await opportunityModel.getById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          title: 'Opportunity not found',
          message: "The opportunity you're trying to simulate doesn't exist.",
          action: 'browse'
        }
      });
    }

    const [currentSkills, userProfile] = await Promise.all([
      userId ? skillsModel.getByUserId(userId) : [],
      userId ? userModel.findById(userId) : null
    ]);

    const simulation = await incomeSimulationService.simulate({
      currentSkills,
      targetOpportunity: opportunity,
      userProfile,
      months: req.body.months || 6
    });

    res.json({
      success: true,
      data: simulation,
      meta: {
        opportunity: opportunity.title,
        simulatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('simulateIncome error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'SIMULATION_ERROR',
        title: 'Income simulation failed',
        message: "We couldn't run the income simulation. Please try again.",
        action: 'retry'
      }
    });
  }
};

// ─── WHY NOT THIS PATH? ───
exports.getWhyNotPath = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTH_REQUIRED',
          title: 'Authentication required',
          message: 'Please sign in to see path analysis.',
          action: 'login'
        }
      });
    }

    const explanation = await scoringService.getWhyNotPath(userId, id);

    // Handle error object from service
    if (explanation?.error) {
      return res.status(200).json({
        success: true,
        data: null,
        meta: {
          emptyState: {
            type: explanation.type,
            title: explanation.title,
            message: explanation.message,
            ctaLink: explanation.ctaLink,
            action: explanation.type === 'NO_SKILLS' ? 'profile' : 'refresh'
          }
        }
      });
    }

    res.json({
      success: true,
      data: explanation,
      meta: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('getWhyNotPath error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'ANALYSIS_ERROR',
        title: 'Path analysis failed',
        message: err.message || 'Unable to analyze this path. Please try again.',
        action: 'retry'
      }
    });
  }
};

// ─── COMPARISON DATA (Priority 2) ───
exports.getComparison = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTH_REQUIRED',
          title: 'Login required',
          message: 'Sign in to compare opportunities.',
          action: 'login'
        }
      });
    }

    const radar = await scoringService.getOpportunityRadar(userId);

    if (radar.emptyState || !Array.isArray(radar) || radar.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          emptyState: radar.emptyState || {
            type: 'NO_DATA',
            title: 'No comparison data',
            message: 'Add skills to see opportunity comparisons.',
            action: 'profile'
          }
        }
      });
    }

    // Build comparison matrix
    const comparison = radar.map(opp => ({
      id: opp.id,
      title: opp.title,
      category: opp.category,
      score: opp.score,
      demand: opp.demand_score,
      competition: opp.competition_score,
      skillMatch: opp.skill_match_percentage,
      incomeSpeed: opp.income_speed,
      futureProof: opp.future_proof_rating,
      incomePotential: opp.income_potential,
      incomeProbability: opp.income_probability?.level,
      radar_data: opp.radar_data
    }));

    res.json({
      success: true,
      data: comparison,
      meta: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('getComparison error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'COMPARISON_ERROR',
        title: 'Comparison failed',
        message: 'Unable to generate comparison data.',
        action: 'retry'
      }
    });
  }
};

// ─── LAZY EXPLANATION (Priority 2) ───
exports.getExplanation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTH_REQUIRED',
          title: 'Authentication required',
          message: 'Please sign in to see AI explanations.',
          action: 'login'
        }
      });
    }

    const explanation = await scoringService.getExplanation(userId, id);

    if (explanation?.error) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          title: 'Explanation unavailable',
          message: explanation.error,
          action: 'retry'
        }
      });
    }

    res.json({
      success: true,
      data: explanation,
      meta: {
        generatedAt: new Date().toISOString(),
        model: 'gemini-3.5-flash',
        lazyLoaded: true
      }
    });
  } catch (err) {
    console.error('getExplanation error:', err.message);
    res.status(500).json({
      success: false,
      error: {
        type: 'EXPLANATION_ERROR',
        title: 'AI explanation failed',
        message: 'Unable to generate explanation. Please try again.',
        action: 'retry'
      }
    });
  }
};

// ─── CAREER TWIN ───
exports.askCareerTwin = async (req, res, next) => {
  try {
    const { command, context } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: { type: 'INVALID_INPUT', title: 'Command required', message: 'Please provide a command for your Career Twin.', action: 'correct' }
      });
    }

    const userProfile = await userModel.findById(req.user.id);
    const twin = new CareerTwin(req.user.id, userProfile);
    const result = await twin.execute(command, context);

    res.json({
      success: true,
      data: result,
      meta: { agent: 'career_twin_v2', executedAt: new Date().toISOString() }
    });
  } catch (err) {
    console.error('askCareerTwin error:', err.message);
    res.status(500).json({
      success: false,
      error: { type: 'TWIN_ERROR', title: 'Career Twin unavailable', message: 'Your twin is recharging. Please try again.', action: 'retry' }
    });
  }
};

exports.getTwinStatus = async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'active',
      agent: 'career_twin_v2',
      capabilities: ['linkedin_post', 'connection_request', 'portfolio_project', 'interview_sim', 'skill_immunization']
    }
  });
};

// ─── SKILL ARBITRAGE MATRIX ───
exports.getArbitrage = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { type: 'AUTH_REQUIRED', title: 'Login required', message: 'Sign in to see arbitrage data.', action: 'login' }
      });
    }

    const [userSkills, userProfile] = await Promise.all([
      skillsModel.getByUserId(userId),
      userModel.findById(userId)
    ]);

    const matrix = await arbitrageService.getArbitrageMatrix(userSkills, userProfile?.location);
    res.json({ success: true, data: matrix });
  } catch (err) {
    console.error('getArbitrage error:', err.message);
    res.status(500).json({
      success: false,
      error: { type: 'ARBITRAGE_ERROR', title: 'Arbitrage calculation failed', message: 'Unable to load salary arbitrage data.', action: 'retry' }
    });
  }
};