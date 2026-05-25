import React, { useState, useRef, useEffect, useCallback } from 'react';
import { interviewApi } from '../../api/interviewApi';
import './InterviewBattleStation.css';

const INTERVIEW_TYPES = [
  { value: 'system_design', label: 'System Design', icon: '🏗️' },
  { value: 'behavioral', label: 'Behavioral', icon: '🗣️' },
  { value: 'coding', label: 'Coding', icon: '💻' },
  { value: 'architecture', label: 'Architecture', icon: '📐' }
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'hard', label: 'Hard', color: '#ef4444' }
];

const STATUS_COLORS = {
  good: '#10b981',
  warning: '#f59e0b',
  bad: '#ef4444',
  too_slow: '#f59e0b',
  too_fast: '#f59e0b'
};

export const InterviewBattleStation = () => {
  const [phase, setPhase] = useState('setup'); // setup, active, review
  const [sessionId, setSessionId] = useState(null);
  const [config, setConfig] = useState({ interviewType: 'system_design', difficulty: 'medium', durationMinutes: 45 });
  const [question, setQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [whiteboardData, setWhiteboardData] = useState({ textLabels: [], drawnShapes: [] });
  const [scores, setScores] = useState(null);
  const [pressureQuestion, setPressureQuestion] = useState(null);
  const [showPressure, setShowPressure] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const feedbackIntervalRef = useRef(null);

  // ─── Setup ───
  const startInterview = async () => {
    try {
      const { data } = await interviewApi.startSession(config);
      setSessionId(data.data.sessionId);
      setQuestion(data.data.question);
      setTimeRemaining(data.data.timeRemaining);
      setPhase('active');
      setTranscriptions([]);
      setFeedback([]);
      setScores(null);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            endInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Periodic whiteboard analysis
      feedbackIntervalRef.current = setInterval(() => {
        analyzeWhiteboard();
      }, 10000); // Every 10s

    } catch (err) {
      alert('Failed to start: ' + (err.response?.data?.error || err.message));
    }
  };

  const endInterview = async () => {
    clearInterval(timerRef.current);
    clearInterval(feedbackIntervalRef.current);
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    try {
      const { data } = await interviewApi.endSession(sessionId);
      setScores(data.data.scores);
      setPhase('review');
    } catch (err) {
      console.error('End failed:', err);
      setPhase('review');
    }
  };

  // ─── Voice Recording ───
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        try {
          const { data } = await interviewApi.transcribe(
            sessionId,
            audioBlob,
            Date.now()
          );
          
          setTranscriptions(prev => [...prev, {
            text: data.data.transcription,
            analysis: data.data.analysis,
            timestamp: Date.now()
          }]);

          // Check for pressure trigger
          if (data.data.analysis.fillers.count > 2 || data.data.analysis.pace.status !== 'good') {
            triggerPressure(data.data.transcription);
          }
        } catch (err) {
          console.error('Transcription failed:', err);
        }
        
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(5000); // Collect 5s chunks
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ─── Whiteboard ───
  const analyzeWhiteboard = async () => {
    if (!sessionId) return;
    
    try {
      const { data } = await interviewApi.analyzeWhiteboard(
        sessionId,
        whiteboardData,
        Date.now()
      );
      
      if (data.data.componentsMissing?.length > 0 || data.data.antiPatternsFound?.length > 0) {
        setFeedback(prev => [...prev, {
          type: 'whiteboard',
          timestamp: Date.now(),
          data: data.data
        }]);
      }
    } catch (err) {
      console.error('Whiteboard analysis failed:', err);
    }
  };

  const addWhiteboardLabel = (text) => {
    setWhiteboardData(prev => ({
      ...prev,
      textLabels: [...prev.textLabels, text]
    }));
  };

  // ─── Pressure Mode ───
  const triggerPressure = async (lastText) => {
    try {
      const { data } = await interviewApi.getPressureQuestion(sessionId, lastText, Date.now());
      setPressureQuestion(data.data);
      setShowPressure(true);
      
      // Auto-hide after 10s
      setTimeout(() => setShowPressure(false), 10000);
    } catch (err) {
      console.error('Pressure question failed:', err);
    }
  };

  const requestHint = async () => {
    try {
      const { data } = await interviewApi.getHint(sessionId);
      setFeedback(prev => [...prev, {
        type: 'hint',
        timestamp: Date.now(),
        text: data.data.hint
      }]);
    } catch (err) {
      console.error('Hint failed:', err);
    }
  };

  // ─── Format time ───
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(feedbackIntervalRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    };
  }, []);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  if (phase === 'setup') {
    return (
      <div className="ibs-container">
        <div className="ibs-header">
          <h1>⚔️ Live Interview Battle Station</h1>
          <p>Real-time AI sparring partner. Voice, whiteboard, and pressure-tested.</p>
        </div>

        <div className="ibs-setup">
          <div className="ibs-config-group">
            <label>Interview Type</label>
            <div className="ibs-type-grid">
              {INTERVIEW_TYPES.map(t => (
                <button
                  key={t.value}
                  className={`ibs-type-btn ${config.interviewType === t.value ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, interviewType: t.value })}
                >
                  <span className="ibs-type-icon">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ibs-config-group">
            <label>Difficulty</label>
            <div className="ibs-difficulty">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  className={`ibs-diff-btn ${config.difficulty === d.value ? 'active' : ''}`}
                  style={{ '--diff-color': d.color }}
                  onClick={() => setConfig({ ...config, difficulty: d.value })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ibs-config-group">
            <label>Duration (minutes)</label>
            <input
              type="range"
              min="15"
              max="60"
              step="5"
              value={config.durationMinutes}
              onChange={e => setConfig({ ...config, durationMinutes: parseInt(e.target.value) })}
            />
            <span className="ibs-duration-val">{config.durationMinutes} min</span>
          </div>

          <button onClick={startInterview} className="ibs-btn ibs-btn-primary ibs-btn-large">
            🚀 Start Interview
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'active') {
    const latestFeedback = feedback[feedback.length - 1];
    const latestTranscription = transcriptions[transcriptions.length - 1];

    return (
      <div className="ibs-container ibs-active">
        {/* Header Bar */}
        <div className="ibs-topbar">
          <div className="ibs-timer">
            ⏱ {formatTime(timeRemaining)}
          </div>
          <div className="ibs-question-type">
            {INTERVIEW_TYPES.find(t => t.value === config.interviewType)?.icon} {question?.question_text?.substring(0, 50)}...
          </div>
          <div className="ibs-controls">
            <button onClick={requestHint} className="ibs-btn ibs-btn-small">💡 Hint</button>
            <button onClick={endInterview} className="ibs-btn ibs-btn-danger">End</button>
          </div>
        </div>

        {/* Pressure Mode Overlay */}
        {showPressure && pressureQuestion && (
          <div className="ibs-pressure">
            <div className="ibs-pressure-badge">⚠️ PRESSURE MODE</div>
            <div className="ibs-pressure-text">{pressureQuestion.question}</div>
            <button onClick={() => setShowPressure(false)} className="ibs-btn ibs-btn-small">Dismiss</button>
          </div>
        )}

        {/* Main Content */}
        <div className="ibs-main">
          {/* Left: Question + Transcription */}
          <div className="ibs-left">
            <div className="ibs-question-box">
              <h3>Question</h3>
              <p>{question?.question_text}</p>
              {question?.time_limit_minutes && (
                <span className="ibs-time-limit">Time limit: {question.time_limit_minutes} min</span>
              )}
            </div>

            <div className="ibs-transcription">
              <h3>🎤 Your Answer</h3>
              {transcriptions.length === 0 ? (
                <div className="ibs-empty">Start recording to see transcription...</div>
              ) : (
                <div className="ibs-transcript-list">
                  {transcriptions.map((t, i) => (
                    <div key={i} className="ibs-transcript-item">
                      <p>{t.text}</p>
                      {t.analysis && (
                        <div className="ibs-transcript-meta">
                          <span style={{ color: STATUS_COLORS[t.analysis.pace.status] || '#94a3b8' }}>
                            {t.analysis.pace.wpm} WPM
                          </span>
                          {t.analysis.fillers.count > 0 && (
                            <span className="ibs-filler-tag">
                              {t.analysis.fillers.count} fillers
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="ibs-recording-bar">
              {!isRecording ? (
                <button onClick={startRecording} className="ibs-btn ibs-btn-record">
                  🔴 Start Recording
                </button>
              ) : (
                <button onClick={stopRecording} className="ibs-btn ibs-btn-recording">
                  ⏹ Stop Recording
                </button>
              )}
            </div>
          </div>

          {/* Right: Whiteboard + Feedback */}
          <div className="ibs-right">
            <div className="ibs-whiteboard">
              <h3>🎨 Whiteboard</h3>
              <div className="ibs-canvas-area" ref={canvasRef}>
                <div className="ibs-canvas-placeholder">
                  <p>Draw your architecture here</p>
                  <div className="ibs-canvas-tools">
                    <button onClick={() => addWhiteboardLabel('Load Balancer')}>+ Load Balancer</button>
                    <button onClick={() => addWhiteboardLabel('Database')}>+ Database</button>
                    <button onClick={() => addWhiteboardLabel('Cache')}>+ Cache</button>
                    <button onClick={() => addWhiteboardLabel('API Gateway')}>+ API Gateway</button>
                  </div>
                  {whiteboardData.textLabels.length > 0 && (
                    <div className="ibs-canvas-labels">
                      {whiteboardData.textLabels.map((label, i) => (
                        <span key={i} className="ibs-canvas-label">{label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Real-time Feedback */}
            <div className="ibs-feedback-panel">
              <h3>📊 Real-Time Feedback</h3>
              {feedback.length === 0 ? (
                <div className="ibs-empty">Speak or draw to get feedback...</div>
              ) : (
                <div className="ibs-feedback-list">
                  {feedback.slice(-5).map((f, i) => (
                    <div key={i} className={`ibs-feedback-item ibs-feedback-${f.type}`}>
                      {f.type === 'whiteboard' && (
                        <>
                          <strong>Whiteboard Analysis</strong>
                          {f.data.componentsMissing?.length > 0 && (
                            <div className="ibs-missing">
                              Missing: {f.data.componentsMissing.join(', ')}
                            </div>
                          )}
                          {f.data.antiPatternsFound?.length > 0 && (
                            <div className="ibs-antipattern">
                              ⚠️ {f.data.antiPatternsFound.join(', ')}
                            </div>
                          )}
                        </>
                      )}
                      {f.type === 'hint' && (
                        <div className="ibs-hint">💡 {f.text}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {latestTranscription?.analysis && (
                <div className="ibs-metrics">
                  <div className="ibs-metric">
                    <label>Filler Words</label>
                    <div className="ibs-metric-bar">
                      <div 
                        className="ibs-metric-fill" 
                        style={{ 
                          width: `${Math.min(latestTranscription.analysis.fillers.count * 20, 100)}%`,
                          background: latestTranscription.analysis.fillers.count > 2 ? '#ef4444' : '#10b981'
                        }}
                      />
                    </div>
                    <span>{latestTranscription.analysis.fillers.count} (target: &lt;2)</span>
                  </div>

                  <div className="ibs-metric">
                    <label>Pace</label>
                    <div className="ibs-metric-bar">
                      <div 
                        className="ibs-metric-fill" 
                        style={{ 
                          width: `${Math.min((latestTranscription.analysis.pace.wpm / 150) * 100, 100)}%`,
                          background: latestTranscription.analysis.pace.status === 'good' ? '#10b981' : '#f59e0b'
                        }}
                      />
                    </div>
                    <span>{latestTranscription.analysis.pace.wpm} WPM</span>
                  </div>

                  <div className="ibs-metric">
                    <label>Structure</label>
                    <div className="ibs-metric-bar">
                      <div 
                        className="ibs-metric-fill" 
                        style={{ 
                          width: `${Math.min((latestTranscription.analysis.structure.count / 5) * 100, 100)}%`,
                          background: latestTranscription.analysis.structure.count >= 2 ? '#10b981' : '#f59e0b'
                        }}
                      />
                    </div>
                    <span>{latestTranscription.analysis.structure.count} markers</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="ibs-container">
        <div className="ibs-header">
          <h1>📋 Interview Complete</h1>
        </div>

        {scores && (
          <div className="ibs-review">
            <div className="ibs-score-cards">
              <div className="ibs-score-card">
                <div className="ibs-score-val" style={{ color: scores.overall >= 70 ? '#10b981' : scores.overall >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {scores.overall}
                </div>
                <div className="ibs-score-label">Overall</div>
              </div>
              <div className="ibs-score-card">
                <div className="ibs-score-val">{scores.technical}</div>
                <div className="ibs-score-label">Technical</div>
              </div>
              <div className="ibs-score-card">
                <div className="ibs-score-val">{scores.communication}</div>
                <div className="ibs-score-label">Communication</div>
              </div>
              <div className="ibs-score-card">
                <div className="ibs-score-val">{scores.structure}</div>
                <div className="ibs-score-label">Structure</div>
              </div>
            </div>

            <div className="ibs-metrics-detail">
              <h3>Session Metrics</h3>
              <ul>
                <li>Total filler words: {scores.metrics.totalFillers}</li>
                <li>AI interruptions: {scores.metrics.totalInterruptions}</li>
                <li>Whiteboard issues: {scores.metrics.whiteboardIssues}</li>
              </ul>
            </div>

            <div className="ibs-review-actions">
              <button onClick={() => setPhase('setup')} className="ibs-btn ibs-btn-primary">
                New Interview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};