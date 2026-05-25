// controllers/profileController.js
const userModel = require('../models/userModel');
const scoringService = require('../services/scoringService'); // ADD THIS

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userModel.update(req.user.id, req.body);
    
    // 🗑️ CRITICAL: Wipe stale radar cache so next Dashboard load is fresh
    await scoringService.invalidateUserCache(req.user.id);
    
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateSkills = async (req, res, next) => {
  try {
    const user = await userModel.update(req.user.id, { skills: req.body.skills });
    
    // 🗑️ CRITICAL: Wipe stale radar cache immediately
    await scoringService.invalidateUserCache(req.user.id);
    
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};