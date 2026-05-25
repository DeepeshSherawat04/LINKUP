// scoringController.js
const scoringService = require('../services/scoringService');

exports.calculateScore = async (req, res, next) => {
  try {
    const score = await scoringService.calculate(req.body);
    res.json({ success: true, data: score });
  } catch (err) {
    next(err);
  }
};