// interviewSocket.js — v1.s0 PRODUCTION
// WebSocket for real-time interview streaming

const interviewSessionService = require('../services/interview/interviewSessionService');

function setupInterviewSocket(io) {
  const interviewNamespace = io.of('/interview');

  interviewNamespace.on('connection', (socket) => {
    console.log('[InterviewSocket] Client connected:', socket.id);
    
    let currentSession = null;
    let currentQuestion = null;
    let accumulatedTranscript = '';
    let startTime = null;

    // ─── Authentication ───
    socket.on('auth', (token) => {
      // Verify JWT token (reuse your auth middleware logic)
      // For now, assume token is valid userId
      socket.userId = token; // In production, verify properly
      socket.emit('auth_success');
    });

    // ─── Start Session ───
    socket.on('start_session', async (config) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        currentSession = await interviewSessionService.createSession(socket.userId, config);
        startTime = Date.now();
        
        socket.emit('session_started', {
          sessionId: currentSession.id,
          type: currentSession.interview_type,
          duration: currentSession.duration_minutes
        });

        // Send first question
        await sendNextQuestion();
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ─── Audio Chunk (from Whisper in browser) ───
    socket.on('audio_transcript', async (data) => {
      try {
        if (!currentSession || !currentQuestion) return;

        const { transcript, isFinal, whiteboardData } = data;
        accumulatedTranscript += ' ' + transcript;

        // Real-time analysis
        const result = await interviewSessionService.processResponse(
          currentSession.id,
          {
            questionId: currentQuestion.id,
            questionText: currentQuestion.text,
            transcript,
            audioDurationMs: Date.now() - startTime,
            whiteboardData,
            accumulatedTranscript
          }
        );

        // Emit real-time feedback
        socket.emit('realtime_feedback', {
          transcript,
          fillerWords: result.speech.fillerWords.count,
          pace: result.speech.pace.estimatedWpm,
          structure: result.speech.structure,
          whiteboard: result.whiteboard ? {
            score: result.whiteboard.score,
            violations: result.whiteboard.violations.slice(0, 2) // Top 2 only
          } : null
        });

        // Emit interrupt if triggered
        if (result.interrupt) {
          socket.emit('ai_interrupt', {
            text: result.interrupt.text,
            timestamp: result.interrupt.timestamp
          });
        }

        // If final, save and move to next
        if (isFinal) {
          socket.emit('response_saved', { responseId: result.responseId });
          
          // Small delay before next question
          setTimeout(async () => {
            await sendNextQuestion();
          }, 2000);
        }
      } catch (error) {
        console.error('[InterviewSocket] Processing error:', error);
        socket.emit('error', { message: 'Analysis failed, continuing...' });
      }
    });

    // ─── Whiteboard Update ───
    socket.on('whiteboard_update', async (data) => {
      // Just cache for next analysis cycle
      socket.whiteboardData = data;
    });

    // ─── Pause/Resume ───
    socket.on('pause', () => {
      socket.emit('paused');
    });

    socket.on('resume', () => {
      socket.emit('resumed');
    });

    // ─── End Session ───
    socket.on('end_session', async () => {
      try {
        if (!currentSession) return;
        
        const scores = await interviewSessionService.completeSession(currentSession.id);
        socket.emit('session_complete', scores);
        
        currentSession = null;
        currentQuestion = null;
        accumulatedTranscript = '';
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ─── Disconnect ───
    socket.on('disconnect', async () => {
      if (currentSession) {
        try {
          await interviewSessionService.completeSession(currentSession.id);
        } catch (e) {
          console.error('[InterviewSocket] Cleanup error:', e.message);
        }
      }
      console.log('[InterviewSocket] Client disconnected:', socket.id);
    });

    // ─── Helper ───
    async function sendNextQuestion() {
      try {
        const question = await interviewSessionService.getQuestion(
          currentSession.id,
          currentQuestion?.id
        );

        if (question.error) {
          socket.emit('interview_complete', { reason: 'no_more_questions' });
          return;
        }

        currentQuestion = question;
        accumulatedTranscript = '';
        startTime = Date.now();

        socket.emit('new_question', {
          id: question.id,
          text: question.text,
          category: question.category,
          timeLimit: question.time_limit * 60, // seconds
          followUps: question.follow_ups || []
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to load question' });
      }
    }
  });
}

module.exports = { setupInterviewSocket };