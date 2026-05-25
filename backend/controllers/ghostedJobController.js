// controllers/ghostedJobController.js
const ghostedJobService = require('../services/intelligence/ghostedJobService');

class GhostedJobController {
  async analyze(req, res, next) {
    try {
      const { company, role } = req.query;
      const userId = req.user?.id || req.user?.sub;

      if (!company?.trim() || !role?.trim()) {
        return res.status(400).json({ error: 'company and role are required query parameters' });
      }

      const analysis = await ghostedJobService.analyze(company.trim(), role.trim(), userId);
      res.json({ success: true, data: analysis });
    } catch (error) {
      next(error);
    }
  }

  async recordOutcome(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { company, role, appliedDate } = req.body;

      if (!company?.trim() || !role?.trim() || !appliedDate) {
        return res.status(400).json({ error: 'company, role, and appliedDate are required' });
      }

      const outcome = await ghostedJobService.recordOutcome(req.body, userId);
      res.status(201).json({ success: true, data: outcome });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const history = await ghostedJobService.getUserHistory(userId, req.query);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const stats = await ghostedJobService.getUserStats(userId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GhostedJobController();