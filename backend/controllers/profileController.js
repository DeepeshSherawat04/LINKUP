// profileController.js
const userModel = require('../models/userModel');
const scoringService = require('../services/scoringService');

// Helper: race against a 2s timeout so Redis can never hang the response
const safeCacheInvalidate = (userId) => {
  return Promise.race([
    scoringService.invalidateUserCache(userId),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('cache-invalidate-timeout')), 2000)
    )
  ]).catch(err => {
    console.warn('🛡️ Cache invalidate skipped (non-blocking):', err.message);
  });
};

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
    const updateData = { ...req.body };

    // Normalize skills to an array if provided (handles both string and array inputs)
    if (updateData.skills !== undefined) {
      if (Array.isArray(updateData.skills)) {
        updateData.skills = updateData.skills.map(s => s.trim()).filter(Boolean);
      } else if (typeof updateData.skills === 'string') {
        updateData.skills = updateData.skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      } else {
        updateData.skills = [];
      }
    }

    const user = await userModel.update(req.user.id, updateData);
    
    // 🔥 NON-BLOCKING: don't let Redis stall the HTTP response
    safeCacheInvalidate(req.user.id);
    
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateSkills = async (req, res, next) => {
  try {
    let skills = req.body.skills || [];
    
    if (typeof skills === 'string') {
      skills = skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    const user = await userModel.update(req.user.id, { skills });
    
    // 🔥 NON-BLOCKING
    safeCacheInvalidate(req.user.id);
    
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};