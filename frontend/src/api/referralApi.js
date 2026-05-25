// referralApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api/referrals`,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const referralApi = {
  // LinkedIn OAuth
  getLinkedInAuthUrl: () => api.get('/linkedin/auth'),
  
  // Import
  importConnections: (connections, source = 'manual') => 
    api.post('/import', { connections, source }),
  importCSV: (csvData) => api.post('/import-csv', { csvData }),
  
  // Pathfinding
  findPaths: (company, role, maxDepth = 3) => 
    api.get('/paths', { params: { company, role, maxDepth } }),
  scoreBridge: (bridgeHash, company) => 
    api.post('/score-bridge', { bridgeHash, company }),
  
  // Messaging
  draftMessage: (context, tone = 'professional') => 
    api.post('/draft-message', { context, tone }),
  
  // Targets
  getTargets: () => api.get('/targets'),
  addTarget: (companyName, roleTitle, priority = 1) => 
    api.post('/targets', { companyName, roleTitle, priority }),
  
  // Outcomes
  logOutcome: (targetCompany, bridgeHash, message, outcome = 'pending') => 
    api.post('/outcomes', { targetCompany, bridgeHash, message, outcome })
};