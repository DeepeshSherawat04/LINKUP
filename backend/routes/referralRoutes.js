// referralRoutes.js
const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const authMiddleware = require('../middleware/authMiddleware');

// LinkedIn OAuth (optional)
router.get('/linkedin/auth', authMiddleware, referralController.linkedinAuth);
router.get('/linkedin/callback', referralController.linkedinCallback);

// CSV Import (primary)
router.post('/import-csv', authMiddleware, referralController.importCSV);

// Pathfinding
router.get('/paths', authMiddleware, referralController.findPaths);
router.post('/score-bridge', authMiddleware, referralController.scoreBridge);

// Messaging
router.post('/draft-message', authMiddleware, referralController.draftMessage);

// Targets
router.get('/targets', authMiddleware, referralController.getTargets);
router.post('/targets', authMiddleware, referralController.addTarget);

// Outcomes
router.post('/outcomes', authMiddleware, referralController.logOutcome);

module.exports = router;