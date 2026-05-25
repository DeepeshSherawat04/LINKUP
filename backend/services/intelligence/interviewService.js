// interviewService.js — v1.0 PRODUCTION
// Core interview engine: deterministic analysis, AI only for pressure-mode

const { createClient } = require('@supabase/supabase-js');
const redisClient = require('../../config/redisClient');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Deterministic Analysis Rules ───
const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'so', 'basically', 'literally', 'i mean', 'kind of', 'sort of'];
const PACE_TARGET = { min: 110, max: 140 }; // words per minute
const STRUCTURE_MARKERS = ['first', 'second', 'third', 'finally', 'however', 'therefore', 'because', 'for example', 'in conclusion', 'to summarize'];

// System design component detection (deterministic)
const COMPONENT_PATTERNS = {
  load_balancer: /\b(load balancer|nginx|haproxy|alb|elb)\b/i,
  api_gateway: /\b(api gateway|kong|zuul|apigee)\b/i,
  database: /\b(database|db|postgres|mysql|mongodb|dynamodb|cassandra)\b/i,
  cache: /\b(cache|redis|memcached|cdn|cloudflare|fastly)\b/i,
  message_queue: /\b(queue|kafka|rabbitmq|sqs|sns)\b/i,
  cdn: /\b(cdn|cloudflare|akamai|cloudfront)\b/i,
  microservices: /\b(microservice|service mesh|istio|consul)\b/i,
  replication: /\b(replica|master slave|primary secondary|read replica)\b/i,
  sharding: /\b(shard|partition|consistent hash)\b/i
};

const ANTI_PATTERNS = {
  single_point_of_failure: /\b(single (server|node|instance|database))\b/i,
  no_caching: /^(?!.*\b(cache|redis|cdn)\b).*$/is,
  no_scaling_plan: /^(?!.*\b(scale|shard|replica|load balance)\b).*$/is,
  tight_coupling: /\b(direct (call|connection)|monolith)\b/i
};

class InterviewService {
  /**
   * Start a new interview session
   */
  async startSession(userId, config) {
    const { interviewType, difficulty, durationMinutes } = config;

    const { data: question } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('interview_type', interviewType)
      .eq('difficulty', difficulty || 'medium')
      .order('created_at')
      .limit(1)
      .single();

    const { data: session, error } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        interview_type: interviewType,
        difficulty: difficulty || 'medium',
        duration_minutes: durationMinutes || 45,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Cache active session
    await redisClient.setCache(`interview:active:${userId}`, {
      sessionId: session.id,
      startedAt: Date.now(),
      type: interviewType,
      currentQuestion: question
    }, 3600);

    return {
      sessionId: session.id,
      question: question || null,
      timeRemaining: (durationMinutes || 45) * 60
    };
  }

  /**
   * End session and calculate scores
   */
  async endSession(sessionId, userId) {
    const { data: events } = await supabase
      .from('interview_feedback_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: true });

    // Calculate scores deterministically
    const scores = this._calculateScores(events || []);

    const { data, error } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        overall_score: scores.overall,
        technical_score: scores.technical,
        communication_score: scores.communication,
        structure_score: scores.structure
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await redisClient.deleteCache(`interview:active:${userId}`);

    return { session: data, scores };
  }

  /**
   * Analyze transcription — DETERMINISTIC (no AI)
   */
  async analyzeTranscription(sessionId, text, timestampMs) {
    const lowerText = text.toLowerCase();
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);

    // 1. Filler words
    const fillersFound = [];
    FILLER_WORDS.forEach(fw => {
      const regex = new RegExp(`\\b${fw}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(() => fillersFound.push(fw));
      }
    });

    // 2. Pace (WPM) — assume 10s audio chunk
    const wpm = Math.round((words.length / 10) * 60);

    // 3. Structure markers
    const structureMarkers = STRUCTURE_MARKERS.filter(m => lowerText.includes(m));

    const events = [];

    if (fillersFound.length > 0) {
      events.push({
        session_id: sessionId,
        event_type: 'filler_words',
        payload: { words: fillersFound, count: fillersFound.length, severity: fillersFound.length > 3 ? 'high' : 'low' },
        timestamp_ms: timestampMs
      });
    }

    events.push({
      session_id: sessionId,
      event_type: 'pace',
      payload: { wpm, status: wpm < PACE_TARGET.min ? 'too_slow' : wpm > PACE_TARGET.max ? 'too_fast' : 'good' },
      timestamp_ms: timestampMs
    });

    if (structureMarkers.length > 0) {
      events.push({
        session_id: sessionId,
        event_type: 'structure',
        payload: { markers: structureMarkers, count: structureMarkers.length },
        timestamp_ms: timestampMs
      });
    }

    if (events.length > 0) {
      await supabase.from('interview_feedback_events').insert(events);
    }

    return {
      fillers: { count: fillersFound.length, words: fillersFound },
      pace: { wpm, status: wpm < PACE_TARGET.min ? 'too_slow' : wpm > PACE_TARGET.max ? 'too_fast' : 'good' },
      structure: { markers: structureMarkers, count: structureMarkers.length }
    };
  }

  /**
   * Analyze whiteboard — DETERMINISTIC rule engine (no AI)
   */
  async analyzeWhiteboard(sessionId, canvasData, timestampMs) {
    // canvasData is expected to be: { textLabels: [], drawnShapes: [] }
    const allText = (canvasData.textLabels || []).join(' ').toLowerCase();
    const allShapes = (canvasData.drawnShapes || []).join(' ').toLowerCase();
    const combined = `${allText} ${allShapes}`;

    // Detect components
    const componentsFound = [];
    const componentsMissing = [];
    
    for (const [component, pattern] of Object.entries(COMPONENT_PATTERNS)) {
      if (pattern.test(combined)) {
        componentsFound.push(component);
      } else {
        componentsMissing.push(component);
      }
    }

    // Detect anti-patterns
    const antiPatternsFound = [];
    for (const [pattern, regex] of Object.entries(ANTI_PATTERNS)) {
      if (regex.test(combined)) {
        antiPatternsFound.push(pattern);
      }
    }

    const events = [];

    if (componentsMissing.length > 0) {
      events.push({
        session_id: sessionId,
        event_type: 'whiteboard_missing',
        payload: { missing: componentsMissing, found: componentsFound },
        timestamp_ms: timestampMs
      });
    }

    if (antiPatternsFound.length > 0) {
      events.push({
        session_id: sessionId,
        event_type: 'whiteboard_antipattern',
        payload: { patterns: antiPatternsFound },
        timestamp_ms: timestampMs
      });
    }

    // Save snapshot
    await supabase.from('interview_whiteboards').insert({
      session_id: sessionId,
      components_detected: componentsFound,
      timestamp_ms: timestampMs
    });

    if (events.length > 0) {
      await supabase.from('interview_feedback_events').insert(events);
    }

    return {
      componentsFound,
      componentsMissing,
      antiPatternsFound,
      coverage: componentsFound.length / (componentsFound.length + componentsMissing.length)
    };
  }

  /**
   * Get next pressure-mode question — AI ONLY for text generation
   */
  async getPressureQuestion(sessionId, context) {
    // Fetch session type to know what questions to ask
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('interview_type')
      .eq('id', sessionId)
      .single();

    const type = session?.interview_type || 'system_design';

    // Deterministic follow-ups based on detected gaps
    const { data: events } = await supabase
      .from('interview_feedback_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: false })
      .limit(10);

    const recentGaps = this._identifyGaps(events || []);

    // AI generates the specific wording, but the TOPIC is deterministic
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are an interview pressure-tester. The candidate is doing a ${type} interview.
Recent gaps detected: ${recentGaps.join(', ') || 'none yet'}.
Candidate's last statement: "${context.lastTranscription || 'N/A'}"

Generate ONE sharp follow-up question that pressure-tests their thinking. 
Rules:
- Be concise (1 sentence)
- Challenge a specific weakness
- Don't be rude, be professionally challenging
- If they mentioned a single point of failure, ask about it directly`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: 100, temperature: 0.8 }
      });
      const result = await model.generateContent(prompt);
      const question = result.response.text().trim();

      await supabase.from('interview_feedback_events').insert({
        session_id: sessionId,
        event_type: 'ai_interrupt',
        payload: { question, triggered_by: recentGaps },
        timestamp_ms: context.timestampMs || Date.now()
      });

      return { question, triggeredBy: recentGaps, source: 'ai_pressure' };
    } catch (error) {
      console.error('[InterviewService.getPressureQuestion] AI failed:', error.message);
      
      // Deterministic fallback
      const fallbackQuestions = {
        system_design: [
          'Your database is single-node. What happens during a region outage?',
          'You mentioned no caching. How does your system handle 10x traffic spikes?',
          'Where is your rate limiter? What prevents abuse?',
          'How do you handle data consistency across regions?'
        ],
        behavioral: [
          'What was the measurable outcome of that action?',
          'What would you do if the same situation happened tomorrow?',
          'How did the other person feel about your approach?'
        ],
        coding: [
          'What is the time complexity? Can you optimize further?',
          'How does this handle concurrent access?',
          'What if the input is 1000x larger?'
        ]
      };

      const pool = fallbackQuestions[type] || fallbackQuestions.system_design;
      const fallback = pool[Math.floor(Math.random() * pool.length)];

      return { question: fallback, triggeredBy: recentGaps, source: 'deterministic_fallback' };
    }
  }

  /**
   * Get hint (non-pressure, helpful)
   */
  async getHint(sessionId) {
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('interview_type')
      .eq('id', sessionId)
      .single();

    const { data: question } = await supabase
      .from('interview_questions')
      .select('hints')
      .eq('interview_type', session?.interview_type || 'system_design')
      .limit(1)
      .single();

    const hints = question?.hints || ['Take a deep breath and start with the requirements.'];
    const randomHint = hints[Math.floor(Math.random() * hints.length)];

    await supabase.from('interview_feedback_events').insert({
      session_id: sessionId,
      event_type: 'hint_given',
      payload: { hint: randomHint },
      timestamp_ms: Date.now()
    });

    return { hint: randomHint };
  }

  /**
   * Get session status + real-time metrics
   */
  async getSessionStatus(sessionId, userId) {
    const cacheKey = `interview:status:${sessionId}`;
    let cached = await redisClient.getCache(cacheKey);

    if (!cached) {
      const { data: session } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (!session) return null;

      const { data: recentEvents } = await supabase
        .from('interview_feedback_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_ms', { ascending: false })
        .limit(20);

      cached = {
        session,
        recentEvents: recentEvents || [],
        timeElapsed: Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      };

      await redisClient.setCache(cacheKey, cached, 10); // 10s cache
    }

    return cached;
  }

  // ─── Internal ───
  _calculateScores(events) {
    const fillerEvents = events.filter(e => e.event_type === 'filler_words');
    const paceEvents = events.filter(e => e.event_type === 'pace');
    const structureEvents = events.filter(e => e.event_type === 'structure');
    const whiteboardEvents = events.filter(e => e.event_type.startsWith('whiteboard_'));
    const interruptEvents = events.filter(e => e.event_type === 'ai_interrupt');

    const totalFillers = fillerEvents.reduce((sum, e) => sum + (e.payload?.count || 0), 0);
    const goodPace = paceEvents.filter(e => e.payload?.status === 'good').length;
    const paceScore = paceEvents.length > 0 ? (goodPace / paceEvents.length) * 100 : 50;
    
    const structureScore = Math.min((structureEvents.length * 10) + 30, 100);
    const technicalScore = Math.max(100 - (whiteboardEvents.length * 15), 30);
    const communicationScore = Math.max(100 - (totalFillers * 5) - ((1 - paceScore/100) * 20), 30);

    const overall = Math.round((technicalScore * 0.4) + (communicationScore * 0.3) + (structureScore * 0.3));

    return {
      overall: Math.min(overall, 100),
      technical: Math.round(technicalScore),
      communication: Math.round(communicationScore),
      structure: Math.round(structureScore),
      metrics: {
        totalFillers,
        totalInterruptions: interruptEvents.length,
        whiteboardIssues: whiteboardEvents.length
      }
    };
  }

  _identifyGaps(events) {
    const gaps = [];
    const recent = events.slice(0, 5);

    if (recent.some(e => e.event_type === 'whiteboard_missing' && e.payload?.missing?.includes('cache'))) {
      gaps.push('missing_cache');
    }
    if (recent.some(e => e.event_type === 'whiteboard_antipattern' && e.payload?.patterns?.includes('single_point_of_failure'))) {
      gaps.push('single_point_of_failure');
    }
    if (recent.some(e => e.event_type === 'filler_words' && e.payload?.count > 3)) {
      gaps.push('excessive_fillers');
    }
    if (recent.some(e => e.event_type === 'pace' && e.payload?.status === 'too_fast')) {
      gaps.push('speaking_too_fast');
    }

    return gaps;
  }
}

module.exports = new InterviewService();