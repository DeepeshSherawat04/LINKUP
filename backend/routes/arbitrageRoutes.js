const express = require('express');
const router = express.Router();
const ArbitrageController = require('../controllers/arbitrageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/opportunities', ArbitrageController.getOpportunities.bind(ArbitrageController));
router.get('/heatmap', ArbitrageController.getHeatmap.bind(ArbitrageController));
router.get('/learning-plan/:skill', ArbitrageController.getLearningPlan.bind(ArbitrageController));
router.get('/market-data', ArbitrageController.getMarketData.bind(ArbitrageController));
router.post('/track-skill', ArbitrageController.trackSkill.bind(ArbitrageController));

module.exports = router;