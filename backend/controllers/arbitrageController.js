/// Arbitrage Controller
const ArbitrageService = require('../services/arbitrageService');
const SkillMarketModel = require('../models/skillMarketModel');

/**
 * Skill Arbitrage Radar Controller
 */
class ArbitrageController {
  /**
   * GET /api/arbitrage/opportunities
   * Personalized arbitrage opportunities
   */
  async getOpportunities(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      // Get user skills from profile (passed in query or fetched from profile service)
      const userSkills = req.query.skills 
        ? req.query.skills.split(',').map(s => s.trim())
        : req.user?.skills || [];

      const data = await ArbitrageService.findOpportunities(userSkills);
      res.json({ success: true, data });
    } catch (error) {
      console.error('[ArbitrageController.getOpportunities]', error);
      next(error);
    }
  }

  /**
   * GET /api/arbitrage/heatmap
   * User skills vs market heatmap
   */
  async getHeatmap(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const userSkills = req.query.skills 
        ? req.query.skills.split(',').map(s => s.trim())
        : req.user?.skills || [];

      const data = await ArbitrageService.getUserHeatmap(userSkills);
      res.json({ success: true, data });
    } catch (error) {
      console.error('[ArbitrageController.getHeatmap]', error);
      next(error);
    }
  }

  /**
   * GET /api/arbitrage/learning-plan/:skill
   * 30-day plan for a specific skill
   */
  async getLearningPlan(req, res, next) {
    try {
      const { skill } = req.params;
      if (!skill) return res.status(400).json({ error: 'Skill name required' });

      const plan = await ArbitrageService.generateLearningPlan(decodeURIComponent(skill));
      res.json({ success: true, data: plan });
    } catch (error) {
      console.error('[ArbitrageController.getLearningPlan]', error);
      next(error);
    }
  }

  /**
   * GET /api/arbitrage/market-data
   * Raw market data (for admin/scraper)
   */
  async getMarketData(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const category = req.query.category || null;

      const data = await SkillMarketModel.getAll(limit, category);
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('[ArbitrageController.getMarketData]', error);
      next(error);
    }
  }

  /**
   * POST /api/arbitrage/track-skill
   * Track a skill gap for the user
   */
  async trackSkill(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { skill_name, status } = req.body;
      if (!skill_name) return res.status(400).json({ error: 'skill_name required' });

      const record = await SkillMarketModel.trackUserSkillGap(userId, skill_name, status || 'identified');
      res.json({ success: true, data: record });
    } catch (error) {
      console.error('[ArbitrageController.trackSkill]', error);
      next(error);
    }
  }
}

module.exports = new ArbitrageController();