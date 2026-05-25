// opportunityApi.js — v2.2 BUGFIX EDITION
// Fixed: Execution plan now uses correct /execution base URL
// Fixed: Race endpoints added

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Opportunities API (mounted at /api/opportunities)
const opportunitiesApi = axios.create({
  baseURL: `${API_URL}/opportunities`,
  timeout: 30000,
});

// Execution API (mounted at /api/execution)
const executionApi = axios.create({
  baseURL: `${API_URL}/execution`,
  timeout: 30000,
});

// Auth interceptor
const addAuthToken = (config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

opportunitiesApi.interceptors.request.use(addAuthToken);
executionApi.interceptors.request.use(addAuthToken);

// Error handler
const handleError = (error) => {
  if (error.code === 'ECONNABORTED') {
    error.message = 'Request timed out. Please try again.';
  }
  if (!error.response) {
    error.message = 'Network error. Check your connection.';
  }
  return Promise.reject(error);
};

opportunitiesApi.interceptors.response.use((res) => res, handleError);
executionApi.interceptors.response.use((res) => res, handleError);

export const opportunityApi = {
  // ─── OPPORTUNITIES ENDPOINTS ───
  getAll: () => opportunitiesApi.get('/'),
  getById: (id) => opportunitiesApi.get(`/${id}`),
  getRadar: () => opportunitiesApi.get('/radar'),
  getWhyNotPath: (id) => opportunitiesApi.get(`/${id}/why-not`),
  simulateIncome: (id, months = 6) => opportunitiesApi.post(`/${id}/simulate`, { months }),
  getComparison: () => opportunitiesApi.get('/comparison'),
  getHealth: () => opportunitiesApi.get('/health'),
  parseResume: (text) => opportunitiesApi.post('/parse-resume', { text }),
  getExplanation: (id) => opportunitiesApi.get(`/${id}/explain`),
  
  // ─── TWIN ENDPOINTS ───
  askCareerTwin: (command) => opportunitiesApi.post('/twin/execute', { command }),
  getTwinStatus: () => opportunitiesApi.get('/twin/status'),
  
  // ─── ARBITRAGE ───
  getArbitrage: () => opportunitiesApi.get('/arbitrage'),
  
  // ─── RACE ENDPOINTS ───
  getRaces: () => opportunitiesApi.get('/races'),
  getUserRaces: (userId) => opportunitiesApi.get(`/races/user/${userId}`),
  joinRace: (raceId, guildId) => opportunitiesApi.post(`/races/${raceId}/join`, { guildId }),
  getLeaderboard: (raceId) => opportunitiesApi.get(`/races/${raceId}/leaderboard`),
  completeTask: (taskId, proofUrl) => opportunitiesApi.post(`/races/tasks/${taskId}/complete`, { proofUrl }),
  
  // ─── EXECUTION PLAN (fixed: uses executionApi, not opportunitiesApi) ───
  generatePlan: (opportunityId, options) => executionApi.post('/plan', {
    opportunityId,
    goal_type: options?.goal_type || 'freelance',
    time_per_week: options?.time_per_week || 15,
  }),
};

export default opportunityApi;