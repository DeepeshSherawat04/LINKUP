const interviewService = require('../services/intelligence/interviewService');
const whisperService = require('../services/intelligence/whisperService');

class InterviewController {
  // ─── HTTP: Start Session ───
  async start(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { interviewType, difficulty, durationMinutes } = req.body;

      if (!interviewType) {
        return res.status(400).json({ error: 'interviewType required (system_design, behavioral, coding, architecture)' });
      }

      const session = await interviewService.startSession(userId, {
        interviewType,
        difficulty,
        durationMinutes
      });

      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: End Session ───
  async end(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { sessionId } = req.params;

      const result = await interviewService.endSession(sessionId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: Get Status ───
  async status(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const { sessionId } = req.params;

      const status = await interviewService.getSessionStatus(sessionId, userId);
      if (!status) return res.status(404).json({ error: 'Session not found' });

      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: Get Summary ───
  async summary(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

      const { data, error } = await supabase.rpc('get_interview_summary', {
        p_session_id: sessionId
      });

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: Get Hint ───
  async hint(req, res, next) {
    try {
      const { sessionId } = req.params;
      const hint = await interviewService.getHint(sessionId);
      res.json({ success: true, data: hint });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: Transcribe Audio ───
  async transcribe(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { timestampMs } = req.body;

      if (!req.file && !req.body.audioBase64) {
        return res.status(400).json({ error: 'Audio data required (multipart or base64)' });
      }

      let audioBuffer;
      if (req.file) {
        audioBuffer = req.file.buffer;
      } else {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      }

      // Transcribe
      const transcription = await whisperService.transcribe(audioBuffer);

      // Analyze
      const analysis = await interviewService.analyzeTranscription(
        sessionId,
        transcription.text,
        timestampMs || Date.now()
      );

      res.json({
        success: true,
        data: {
          transcription: transcription.text,
          analysis
        }
      });
    } catch (error) {
      console.error('[InterviewController.transcribe] Error:', error.message);
      res.status(500).json({ 
        error: 'Transcription failed',
        fallback: true,
        message: 'Please type your answer if voice is unavailable.'
      });
    }
  }

  // ─── HTTP: Analyze Whiteboard ───
  async whiteboard(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { canvasData, timestampMs } = req.body;

      if (!canvasData) {
        return res.status(400).json({ error: 'canvasData required' });
      }

      const analysis = await interviewService.analyzeWhiteboard(
        sessionId,
        canvasData,
        timestampMs || Date.now()
      );

      res.json({ success: true, data: analysis });
    } catch (error) {
      next(error);
    }
  }

  // ─── HTTP: Pressure Question ───
  async pressure(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { lastTranscription, timestampMs } = req.body;

      const question = await interviewService.getPressureQuestion(sessionId, {
        lastTranscription,
        timestampMs
      });

      res.json({ success: true, data: question });
    } catch (error) {
      next(error);
    }
  }

  // ─── WebSocket Handler (for real-time streaming) ───
  setupWebSocket(io) {
    io.on('connection', (socket) => {
      console.log('[WS] Interview client connected:', socket.id);

      socket.on('join-session', async ({ sessionId, token }) => {
        try {
          // Verify token (simplified — use your authMiddleware pattern)
          socket.join(`session:${sessionId}`);
          socket.sessionId = sessionId;
          socket.emit('joined', { sessionId, status: 'active' });
        } catch (err) {
          socket.emit('error', { message: 'Invalid session' });
        }
      });

      socket.on('audio-chunk', async ({ audioBase64, timestampMs }) => {
        try {
          if (!socket.sessionId) {
            socket.emit('error', { message: 'Not in a session' });
            return;
          }

          const audioBuffer = Buffer.from(audioBase64, 'base64');
          const transcription = await whisperService.transcribe(audioBuffer);
          const analysis = await interviewService.analyzeTranscription(
            socket.sessionId,
            transcription.text,
            timestampMs
          );

          socket.emit('transcription', {
            text: transcription.text,
            analysis,
            timestampMs
          });

          // Broadcast to room (for interviewer view)
          socket.to(`session:${socket.sessionId}`).emit('candidate-transcription', {
            text: transcription.text,
            timestampMs
          });
        } catch (err) {
          socket.emit('transcription-error', { 
            message: 'Voice processing failed. Try speaking more clearly.',
            retry: true 
          });
        }
      });

      socket.on('whiteboard-update', async ({ canvasData, timestampMs }) => {
        try {
          if (!socket.sessionId) return;

          const analysis = await interviewService.analyzeWhiteboard(
            socket.sessionId,
            canvasData,
            timestampMs
          );

          socket.emit('whiteboard-feedback', {
            analysis,
            timestampMs
          });
        } catch (err) {
          socket.emit('whiteboard-error', { message: 'Analysis failed' });
        }
      });

      socket.on('request-pressure', async ({ lastTranscription, timestampMs }) => {
        try {
          if (!socket.sessionId) return;

          const question = await interviewService.getPressureQuestion(socket.sessionId, {
            lastTranscription,
            timestampMs
          });

          socket.emit('pressure-question', question);
        } catch (err) {
          socket.emit('pressure-error', { message: 'Failed to generate question' });
        }
      });

      socket.on('disconnect', () => {
        console.log('[WS] Interview client disconnected:', socket.id);
      });
    });
  }
}

module.exports = new InterviewController();