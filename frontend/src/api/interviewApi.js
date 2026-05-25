// interviewApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api/interviews`,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const interviewApi = {
  startSession: (config) => api.post('/sessions', config),
  endSession: (sessionId) => api.post(`/sessions/${sessionId}/end`),
  getStatus: (sessionId) => api.get(`/sessions/${sessionId}/status`),
  getSummary: (sessionId) => api.get(`/sessions/${sessionId}/summary`),
  getHint: (sessionId) => api.get(`/sessions/${sessionId}/hint`),
  
  transcribe: (sessionId, audioBlob, timestampMs) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('timestampMs', timestampMs);
    return api.post(`/sessions/${sessionId}/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  analyzeWhiteboard: (sessionId, canvasData, timestampMs) => 
    api.post(`/sessions/${sessionId}/whiteboard`, { canvasData, timestampMs }),
  
  getPressureQuestion: (sessionId, lastTranscription, timestampMs) => 
    api.post(`/sessions/${sessionId}/pressure`, { lastTranscription, timestampMs })
};