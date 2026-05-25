// ghostedJobRoutes.js
const express = require('express');
const router = express.Router();
const ghostedJobController = require('../controllers/ghostedJobController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/analyze', authMiddleware, ghostedJobController.analyze);
router.post('/outcome', authMiddleware, ghostedJobController.recordOutcome);
router.get('/history', authMiddleware, ghostedJobController.getHistory);
router.get('/stats', authMiddleware, ghostedJobController.getStats);

module.exports = router;