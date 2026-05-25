// interviewSessionService.js — v1.0 PRODUCTION
// Orchestrates the full interview lifecycle

const { createClient } = require('@supabase/supabase-js');
const redisClient = require('../../config/redisClient');
const speechAnalysis = require('./speechAnalysisService');
const whiteboardService = require('./whiteboardService');
const interruptService = require('./interruptService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class InterviewSessionService {
  async createSession(userId, config) {
    const { data, error } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        interview_type: config.type,
        difficulty: config.difficulty || 'medium',
        duration_minutes: config.duration || 45,
        enable_interrupts: config.enableInterrupts !== false,
        enable_whiteboard: config.enableWhiteboard !== false
      })
      .select()
      .single();

    if (error) throw error;
    
    // Cache active session
    await redisClient.setCache(`session:${userId}:active`, data.id, 3600);
    
    return data;
  }

  async getQuestion(sessionId, previousQuestionId = null) {
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('interview_type, difficulty')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    const { data, error } = await supabase.rpc('get_interview_question', {
      p_session_id: sessionId,
      p_type: session.interview_type,
      p_difficulty: session.difficulty,
      p_previous_question_id: previousQuestionId
    });

    if (error) throw error;
    return data;
  }

  async processResponse(sessionId, payload) {
    const {
      questionId,
      questionText,
      transcript,
      audioDurationMs,
      whiteboardData,
      accumulatedTranscript
    } = payload;

    // 1. Speech analysis
    const speech = speechAnalysis.analyze(transcript);
    if (audioDurationMs) {
      speech.pace.estimatedWpm = Math.round((transcript.split(/\s+/).length / audioDurationMs) * 60000);
    }

    // 2. Real-time chunk analysis for interrupts
    const chunkAnalysis = speechAnalysis.analyzeChunk(transcript, accumulatedTranscript || '');

    // 3. Whiteboard analysis
    let whiteboard = null;
    if (whiteboardData) {
      whiteboard = await whiteboardService.analyze(whiteboardData);
    }

    // 4. Check for interrupt
    let interrupt = null;
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('enable_interrupts')
      .eq('id', sessionId)
      .single();

    if (session?.enable_interrupts && chunkAnalysis.shouldInterrupt?.shouldInterrupt) {
      const previousInterrupts = await this._getPreviousInterrupts(sessionId);
      interrupt = await interruptService.generateInterrupt({
        questionText,
        transcriptSoFar: accumulatedTranscript || transcript,
        whiteboardComponents: whiteboard?.components?.list,
        timeElapsed: audioDurationMs || 0,
        previousInterrupts
      });
    }

    // 5. Save response
    const { data: responseId, error } = await supabase.rpc('save_interview_response', {
      p_session_id: sessionId,
      p_question_id: questionId,
      p_question_text: questionText,
      p_response_text: transcript,
      p_filler_count: speech.fillerWords.count,
      p_wpm: speech.pace.estimatedWpm,
      p_used_star: speech.structure.isComplete,
      p_whiteboard_analysis: whiteboard,
      p_ai_interrupt: interrupt?.text || null
    });

    if (error) throw error;

    return {
      responseId,
      speech,
      whiteboard,
      interrupt,
      chunkAnalysis,
      shouldContinue: !interrupt // If interrupted, pause for user response
    };
  }

  async completeSession(sessionId) {
    // Calculate final scores
    const { data: responses } = await supabase
      .from('interview_responses')
      .select('*')
      .eq('session_id', sessionId);

    const scores = this._calculateFinalScores(responses || []);

    const { error } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        overall_score: scores.overall,
        technical_score: scores.technical,
        communication_score: scores.communication,
        structure_score: scores.structure
      })
      .eq('id', sessionId);

    if (error) throw error;

    // Clear cache
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (session) {
      await redisClient.deleteCache(`session:${session.user_id}:active`);
    }

    return scores;
  }

  async getSessionHistory(userId) {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select(`
        *,
        responses:interview_responses(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }

  // ─── Internal ───
  async _getPreviousInterrupts(sessionId) {
    const { data } = await supabase
      .from('interview_responses')
      .select('ai_interrupt, ai_interrupt_timestamp')
      .eq('session_id', sessionId)
      .not('ai_interrupt', 'is', null)
      .order('created_at', { ascending: true });

    return (data || []).map(d => ({
      text: d.ai_interrupt,
      timestamp: d.ai_interrupt_timestamp
    }));
  }

  _calculateFinalScores(responses) {
    if (responses.length === 0) {
      return { overall: 0, technical: 0, communication: 0, structure: 0 };
    }

    const technical = responses.reduce((sum, r) => {
      const wb = r.whiteboard_analysis?.score || 0;
      const kw = (r.response_text?.toLowerCase().split(/\s+/).filter(w => 
        ['database', 'cache', 'scale', 'api', 'queue'].includes(w)
      ).length || 0) * 5;
      return sum + Math.min(wb + kw, 100);
    }, 0) / responses.length;

    const communication = responses.reduce((sum, r) => {
      const fillerPenalty = Math.min(r.filler_word_count * 5, 30);
      const paceScore = r.words_per_minute >= 100 && r.words_per_minute <= 160 ? 100 : 70;
      return sum + Math.max(0, paceScore - fillerPenalty);
    }, 0) / responses.length;

    const structure = responses.reduce((sum, r) => {
      return sum + (r.used_star_method ? 90 : r.whiteboard_analysis?.structure?.score || 50);
    }, 0) / responses.length;

    return {
      overall: Math.round((technical + communication + structure) / 3),
      technical: Math.round(technical),
      communication: Math.round(communication),
      structure: Math.round(structure)
    };
  }
}

module.exports = new InterviewSessionService();