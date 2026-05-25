// routes/incomeRoutes.js
const express = require('express');
const router = express.Router();
const IncomeController = require('../controllers/incomeController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/simulate', IncomeController.simulate.bind(IncomeController));
router.get('/simulations', IncomeController.getSimulations.bind(IncomeController));
router.get('/simulations/:id', IncomeController.getSimulationById.bind(IncomeController));
router.delete('/simulations/:id', IncomeController.deleteSimulation.bind(IncomeController));
router.get('/cost-of-living', IncomeController.getCostOfLiving.bind(IncomeController));
router.get('/cities', IncomeController.searchCities.bind(IncomeController)); // NEW

module.exports = router;