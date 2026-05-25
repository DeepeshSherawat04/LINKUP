// interviewRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const interviewController = require('../controllers/interviewController');
const authMiddleware = require('../middleware/authMiddleware');

// Multer for audio upload (memory storage, no disk)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Session management
router.post('/sessions', authMiddleware, interviewController.start);
router.post('/sessions/:sessionId/end', authMiddleware, interviewController.end);
router.get('/sessions/:sessionId/status', authMiddleware, interviewController.status);
router.get('/sessions/:sessionId/summary', authMiddleware, interviewController.summary);

// Real-time analysis (HTTP fallback for non-WS clients)
router.post('/sessions/:sessionId/transcribe', authMiddleware, upload.single('audio'), interviewController.transcribe);
router.post('/sessions/:sessionId/whiteboard', authMiddleware, interviewController.whiteboard);
router.post('/sessions/:sessionId/pressure', authMiddleware, interviewController.pressure);
router.get('/sessions/:sessionId/hint', authMiddleware, interviewController.hint);

module.exports = router;