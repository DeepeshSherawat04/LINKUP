// interruptService.js — v1.0 PRODUCTION
// Gemini ONLY generates follow-up questions. No factual claims.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const redisClient = require('../../config/redisClient');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an experienced technical interviewer conducting a system design interview.
Rules:
1. Ask ONLY ONE short follow-up question (max 20 words).
2. The question must pressure-test the candidate's current answer.
3. Never provide answers or hints.
4. Focus on: failure modes, scalability limits, trade-offs, or missing considerations.
5. Be direct and challenging.`;

class InterruptService {
  async generateInterrupt(context) {
    const { 
      questionText, 
      transcriptSoFar, 
      whiteboardComponents,
      timeElapsed,
      previousInterrupts = []
    } = context;

    // Cache key based on context
    const cacheKey = `interrupt:${this._hashContext(context)}`;
    const cached = await redisClient.getCache(cacheKey);
    if (cached) return cached;

    // Don't interrupt too frequently (min 30 seconds between interrupts)
    if (previousInterrupts.length > 0) {
      const lastInterrupt = previousInterrupts[previousInterrupts.length - 1];
      const timeSinceLast = Date.now() - new Date(lastInterrupt.timestamp).getTime();
      if (timeSinceLast < 30000) {
        return null; // Too soon
      }
    }

    // Build prompt with strict context
    const componentList = (whiteboardComponents || []).join(', ') || 'none drawn yet';
    
    const prompt = `${SYSTEM_PROMPT}

Current Question: ${questionText}
Candidate has said: "${transcriptSoFar.substring(-500)}" (last 500 chars)
Components on whiteboard: ${componentList}
Time elapsed: ${timeElapsed}s
Previous interrupts: ${previousInterrupts.length}

Generate ONE challenging follow-up question.`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: 50, temperature: 0.8 }
      });
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/^["']|["']$/g, '');
      
      // Validate: must end with ? and be reasonable length
      if (!text.endsWith('?') || text.length > 100) {
        return this._fallbackInterrupt(questionText, whiteboardComponents);
      }

      const interrupt = {
        text,
        timestamp: new Date().toISOString(),
        type: 'pressure',
        context: {
          timeElapsed,
          componentCount: whiteboardComponents?.length || 0
        }
      };

      await redisClient.setCache(cacheKey, interrupt, 60); // Short cache
      return interrupt;
    } catch (error) {
      console.error('[InterruptService] Generation failed:', error.message);
      return this._fallbackInterrupt(questionText, whiteboardComponents);
    }
  }

  _fallbackInterrupt(question, components) {
    const fallbacks = [
      "What happens if this component fails?",
      "How does this scale to 10x the load?",
      "What's the single point of failure here?",
      "How would you handle a sudden traffic spike?",
      "What's the latency under peak load?",
      "How do you prevent data loss?",
      "What if the database goes down?",
      "How do you handle concurrent writes?"
    ];
    
    // Pick based on question content
    if (question.includes('chat') || question.includes('real-time')) {
      return { text: "What if a user is offline for 3 days?", type: 'pressure', timestamp: new Date().toISOString() };
    }
    if (components?.length < 4) {
      return { text: "You're missing critical infrastructure. What about caching?", type: 'pressure', timestamp: new Date().toISOString() };
    }
    
    return {
      text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      type: 'pressure',
      timestamp: new Date().toISOString()
    };
  }

  _hashContext(context) {
    const str = JSON.stringify({
      q: context.questionText?.substring(0, 50),
      t: context.transcriptSoFar?.substring(-100),
      c: context.whiteboardComponents?.length,
      time: Math.floor(context.timeElapsed / 10) // Bucket by 10s
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

module.exports = new InterruptService();