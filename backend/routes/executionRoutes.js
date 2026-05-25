// executionRoutes.js
const express = require('express');
const router = express.Router();
const executionController = require('../controllers/executionController');
const authMiddleware = require('../middleware/authMiddleware');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimiter');

// 🧪 TEST: Verify Gemini is working
router.get('/test-gemini', apiLimiter, async (req, res) => {
  try {
    const genAI = require('../config/geminiClient');
    if (!genAI) {
      return res.json({ success: false, message: 'Gemini not configured. Check GEMINI_API_KEY in .env' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent('Say "Gemini is working" and nothing else.');
    const text = result.response.text();
    
    res.json({ 
      success: true, 
      message: 'Gemini test passed',
      response: text,
      keyConfigured: true
    });
  } catch (error) {
    res.json({ 
      success: false, 
      message: 'Gemini test failed',
      error: error.message,
      keyConfigured: !!process.env.GEMINI_API_KEY
    });
  }
});

// ─── AI-POWERED ROUTES ───

// Resume skill extraction
router.post('/parse-resume', apiLimiter, authMiddleware, executionController.parseResume);

// 🔥 AI: Generate 30-day execution plan (rate-limited)
router.post('/plan', aiLimiter, authMiddleware, executionController.generateAIPlan);

// AI: Explain income potential for an opportunity
router.get('/income-explanation/:opportunityId', apiLimiter, authMiddleware, executionController.getIncomeExplanation);

// ─── DATA RETRIEVAL ROUTES ───

// Get user's saved execution plans (history)
router.get('/plans', apiLimiter, authMiddleware, executionController.getExecutionPlan);

// Get income simulation (rule-based, not AI)
router.post('/simulate', apiLimiter, authMiddleware, executionController.simulateIncome);

module.exports = router;