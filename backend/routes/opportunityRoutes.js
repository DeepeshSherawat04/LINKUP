// opportunityRoutes.js — v2.2 SINGULARITY EDITION
// NEW: Twin, Race, Arbitrage, Explanation routes (all before /:id)

const express = require('express');
const router = express.Router();
const opportunityController = require('../controllers/opportunityController');
const twinController = require('../controllers/twinController');
const raceController = require('../controllers/raceController');
const authMiddleware = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');

// ─── HEALTH CHECK ───
router.get('/health', opportunityController.getHealth);

// ─── PUBLIC ROUTES ───
router.get('/', apiLimiter, opportunityController.getOpportunities);

// ─── SPECIFIC ROUTES (MUST be before /:id) ───
router.get('/radar', apiLimiter, authMiddleware, opportunityController.getRadar);
router.get('/comparison', apiLimiter, authMiddleware, opportunityController.getComparison);
router.post('/parse-resume', apiLimiter, authMiddleware, opportunityController.parseResume);

// ─── NEW: LAZY EXPLANATION (Priority 2) ───
router.get('/:id/explain', apiLimiter, authMiddleware, opportunityController.getExplanation);

// ─── NEW: CAREER TWIN (USP 2) ───
router.get('/twin/status', apiLimiter, authMiddleware, twinController.getStatus);
router.post('/twin/execute', apiLimiter, authMiddleware, twinController.executeCommand);

// ─── NEW: ARBITRAGE MATRIX (USP 4) ───
router.get('/arbitrage', apiLimiter, authMiddleware, opportunityController.getArbitrage);

// ─── NEW: CAREER RACE PROTOCOL (USP 5) ───
router.post('/races', apiLimiter, authMiddleware, raceController.createRace);
router.post('/races/:id/join', apiLimiter, authMiddleware, raceController.joinRace);
router.get('/races/user/:userId', apiLimiter, authMiddleware, raceController.getUserRaces);
router.get('/races/:id/leaderboard', apiLimiter, authMiddleware, raceController.getLeaderboard);
router.post('/races/tasks/:taskId/complete', apiLimiter, authMiddleware, raceController.completeTask);

// ─── PARAMETERIZED ROUTES ───
router.get('/:id', apiLimiter, opportunityController.getOpportunityById);

// ─── PROTECTED ROUTES ───
router.post('/:opportunityId/simulate', apiLimiter, authMiddleware, opportunityController.simulateIncome);
router.get('/:id/why-not', apiLimiter, authMiddleware, opportunityController.getWhyNotPath);

module.exports = router;