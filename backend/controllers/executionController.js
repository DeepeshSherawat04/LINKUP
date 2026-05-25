// executionController.js
const executionPlanModel = require('../models/executionPlanModel');
const incomeSimulationService = require('../services/incomeSimulationService');
const aiAnalysisService = require('../services/aiAnalysisService');
const opportunityModel = require('../models/opportunityModel');
const userModel = require('../models/userModel');
const skillsModel = require('../models/skillsModel');
const scoreCalculator = require('../utils/scoreCalculator');

exports.getExecutionPlan = async (req, res, next) => {
  try {
    const plan = await executionPlanModel.getByUserId(req.user?.id || 'guest');
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};

exports.simulateIncome = async (req, res, next) => {
  try {
    const simulation = await incomeSimulationService.simulate(req.body);
    res.json({ success: true, data: simulation });
  } catch (err) {
    next(err);
  }
};

exports.parseResume = async (req, res, next) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ success: false, message: 'Resume text is required' });
    }

    const skills = await aiAnalysisService.extractSkillsFromResume(resumeText);
    
    res.json({ 
      success: true, 
      data: { 
        skills, 
        count: skills.length,
        source: skills.length > 0 ? 'gemini-extracted' : 'none'
      } 
    });
  } catch (err) {
    next(err);
  }
};

// 🔹 A. AI Execution Plan — Generate + Persist
exports.generateAIPlan = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { opportunityId, goal_type, time_per_week } = req.body;
    
    if (!opportunityId) {
      return res.status(400).json({ success: false, message: 'opportunityId is required' });
    }

    const opportunity = await opportunityModel.getById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    // Fetch user profile for personalization
    const [userProfile, userSkills] = await Promise.all([
      userModel.findById(userId),
      skillsModel.getByUserId(userId)
    ]);

    const profile = {
      time_per_week: time_per_week || userProfile?.time_per_week || 10,
      goal_type: goal_type || userProfile?.goal_type || 'freelance',
      skills: userSkills || []
    };

    // Generate AI plan
    const aiPlan = await aiAnalysisService.generateExecutionPlan(profile, opportunity);
    
    // Persist to database
    if (aiPlan && userId) {
      try {
        await executionPlanModel.save({
          user_id: userId,
          opportunity_id: opportunityId,
          week_1: aiPlan.week_1,
          week_2: aiPlan.week_2,
          week_3: aiPlan.week_3,
          week_4: aiPlan.week_4,
          ai_generated: true
        });
      } catch (err) {
        console.log('Plan persist error:', err.message);
      }
    }

    // Return in frontend-compatible format
    res.json({ 
      success: true, 
      data: aiPlan ? {
        weeks: [
          { week: 1, focus: aiPlan.week_1?.focus, tasks: aiPlan.week_1?.tasks },
          { week: 2, focus: aiPlan.week_2?.focus, tasks: aiPlan.week_2?.tasks },
          { week: 3, focus: aiPlan.week_3?.focus, tasks: aiPlan.week_3?.tasks },
          { week: 4, focus: aiPlan.week_4?.focus, tasks: aiPlan.week_4?.tasks }
        ]
      } : { 
        message: 'AI plan unavailable. Using default roadmap.',
        weeks: [
          { week: 1, focus: 'Skill Assessment', tasks: ['Audit current skills', 'Identify gaps'] },
          { week: 2, focus: 'Core Learning', tasks: ['Complete 2 courses', 'Build mini project'] },
          { week: 3, focus: 'Portfolio Building', tasks: ['Create 1 project', 'Publish on GitHub'] },
          { week: 4, focus: 'Job Market Entry', tasks: ['Apply to 10 roles', 'Network on LinkedIn'] }
        ]
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getIncomeExplanation = async (req, res, next) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await opportunityModel.getById(opportunityId);
    
    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    const incomePotential = scoreCalculator.calculateIncomePotential(opportunity);
    const explanation = await aiAnalysisService.generateIncomeExplanation(opportunity, incomePotential);
    
    res.json({ 
      success: true, 
      data: { 
        explanation, 
        incomePotential,
        opportunity: opportunity.title
      } 
    });
  } catch (err) {
    next(err);
  }
};