// referralController.js
const linkedinService = require('../services/social/linkedinService');
const networkGraphService = require('../services/social/networkGraphService');
const referralMessageService = require('../services/social/referralMessageService');

class ReferralController {
  // ─── LinkedIn OAuth (optional) ───
  async linkedinAuth(req, res, next) {
    try {
      if (!linkedinService.isConfigured()) {
        return res.status(200).json({ 
          success: true,
          oauthAvailable: false,
          message: 'LinkedIn OAuth not configured. Use CSV import instead.',
          csvTemplate: 'First Name,Last Name,Email Address,Company,Position,Connected On'
        });
      }
      const { url, state } = linkedinService.getAuthUrl();
      res.json({ success: true, oauthAvailable: true, authUrl: url, state });
    } catch (error) {
      next(error);
    }
  }

  async linkedinCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

      const tokens = await linkedinService.exchangeCode(code, state);
      
      // Store in session (NOT DB)
      req.session.linkedin = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + (tokens.expiresIn * 1000)
      };

      res.json({ success: true, connected: true });
    } catch (error) {
      next(error);
    }
  }

  // ─── CSV Import (Primary method) ───
  async importCSV(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { csvData } = req.body;

      if (!Array.isArray(csvData) || csvData.length === 0) {
        return res.status(400).json({ error: 'csvData array required' });
      }
      if (csvData.length > 1000) {
        return res.status(400).json({ error: 'Max 1000 connections per import' });
      }

      // Validate and normalize
      const connections = linkedinService.validateCSV(csvData);
      
      // Import to graph
      const result = await networkGraphService.importConnections(userId, connections, 'csv_import');
      
      res.json({ 
        success: true, 
        data: result,
        imported: connections.length,
        sample: connections.slice(0, 3).map(c => ({ name: c.name, company: c.company, title: c.title }))
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // ─── Pathfinding ───
  async findPaths(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { company, role, maxDepth } = req.query;

      if (!company?.trim()) {
        return res.status(400).json({ error: 'company query parameter required' });
      }

      const paths = await networkGraphService.findPaths(
        userId, 
        company.trim(), 
        Math.min(parseInt(maxDepth) || 3, 4)
      );

      res.json({ success: true, data: paths });
    } catch (error) {
      next(error);
    }
  }

  // ─── Score Bridge ───
  async scoreBridge(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { bridgeHash, company } = req.body;

      if (!bridgeHash || !company) {
        return res.status(400).json({ error: 'bridgeHash and company required' });
      }

      const score = await networkGraphService.scoreBridge(bridgeHash, userId, company);
      res.json({ success: true, data: score });
    } catch (error) {
      next(error);
    }
  }

  // ─── Draft Message ───
  async draftMessage(req, res, next) {
    try {
      const { context, tone } = req.body;

      if (!context?.bridgeName || !context?.targetCompany) {
        return res.status(400).json({ error: 'context.bridgeName and context.targetCompany required' });
      }

      const message = await referralMessageService.draftMessage(context, tone);
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  // ─── Targets ───
  async getTargets(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const targets = await networkGraphService.getTargets(userId);
      res.json({ success: true, data: targets });
    } catch (error) {
      next(error);
    }
  }

  async addTarget(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { companyName, roleTitle, priority } = req.body;

      if (!companyName?.trim()) {
        return res.status(400).json({ error: 'companyName required' });
      }

      const target = await networkGraphService.addTarget(userId, companyName.trim(), roleTitle, priority);
      res.status(201).json({ success: true, data: target });
    } catch (error) {
      next(error);
    }
  }

  // ─── Log Outcome ───
  async logOutcome(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { targetCompany, bridgeHash, message, outcome } = req.body;

      if (!targetCompany || !bridgeHash) {
        return res.status(400).json({ error: 'targetCompany and bridgeHash required' });
      }

      const result = await networkGraphService.logOutcome(userId, targetCompany, bridgeHash, message, outcome);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReferralController();