// controllers/incomeController.js
const IncomeSimulationService = require('../services/incomeSimulationService');
const IncomeSimulationModel = require('../models/incomeSimulationModel');

class IncomeController {
  async simulate(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { simulation_name, offer_details, personal_finances } = req.body;
      
      if (!offer_details || !personal_finances) {
        return res.status(400).json({ error: 'offer_details and personal_finances are required' });
      }

      // === NOW ASYNC: fetches live CoL data ===
      const scenarios = await IncomeSimulationService.buildScenarios(offer_details, personal_finances);

      const record = await IncomeSimulationModel.create(
        userId,
        simulation_name,
        offer_details,
        personal_finances,
        scenarios
      );

      res.status(201).json({
        success: true,
        data: {
          simulation_id: record.id,
          scenarios,
          created_at: record.created_at
        }
      });
    } catch (error) {
      console.error('[IncomeController.simulate]', error);
      next(error);
    }
  }

  async getSimulations(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const offset = parseInt(req.query.offset) || 0;

      const simulations = await IncomeSimulationModel.getByUserId(userId, limit, offset);
      res.json({ success: true, data: simulations });
    } catch (error) {
      console.error('[IncomeController.getSimulations]', error);
      next(error);
    }
  }

  async getSimulationById(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Simulation ID required' });

      const simulation = await IncomeSimulationModel.getById(id, userId);
      res.json({ success: true, data: simulation });
    } catch (error) {
      console.error('[IncomeController.getSimulationById]', error);
      next(error);
    }
  }

  async deleteSimulation(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { id } = req.params;
      await IncomeSimulationModel.delete(id, userId);
      res.json({ success: true, message: 'Simulation deleted' });
    } catch (error) {
      console.error('[IncomeController.deleteSimulation]', error);
      next(error);
    }
  }

    /**
   * GET /api/income/cities?query=San
   * Search cities for autocomplete
   */
  async searchCities(req, res, next) {
    try {
      const { query } = req.query;
      if (!query || query.length < 2) {
        return res.json({ success: true, data: [], message: 'Minimum 2 characters required' });
      }

      const CostOfLivingService = require('../services/costOfLivingService');
      const cities = await CostOfLivingService.searchCities(query, 10);
      
      res.json({ 
        success: true, 
        data: cities,
        count: cities.length 
      });
    } catch (error) {
      next(error);
    }
  }

  async getCostOfLiving(req, res, next) {
    try {
      const CostOfLivingService = require('../services/costOfLivingService');
      const location = req.query.location || 'Remote';
      
      const data = await CostOfLivingService.getCostOfLiving(location);
      
      if (!data) {
        return res.status(503).json({ 
          error: 'Cost of living data temporarily unavailable. Please try again later.',
          location 
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new IncomeController();