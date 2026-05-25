// twinController.js
const CareerTwin = require('../services/intelligence/careerTwinService');
const userModel = require('../models/userModel');

exports.executeCommand = async (req, res, next) => {
  try {
    const { command, context } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }

    const userProfile = await userModel.findById(req.user.id);
    const twin = new CareerTwin(req.user.id, userProfile);
    const result = await twin.execute(command, context);

    res.json({
      success: true,
      data: result,
      meta: { agent: 'career_twin_v2', executedAt: new Date().toISOString(), userId: req.user.id }
    });
  } catch (error) {
    next(error);
  }
};

exports.getStatus = async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'active',
      agent: 'career_twin_v2',
      capabilities: [
        'linkedin_post_generation',
        'connection_request_drafting',
        'portfolio_project_creation',
        'interview_simulation',
        'skill_immunization_planning'
      ]
    }
  });
};