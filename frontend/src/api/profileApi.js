// src/api/profileApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const profileApi = axios.create({
  baseURL: `${API_URL}/profile`,
  timeout: 30000, // 30s — accommodates cold-start on free hosting tiers
});

// Attach auth token
profileApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Error handling with specific timeout messaging
profileApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        error.message = 'Request timed out. Server may be waking up — please retry.';
      } else {
        error.message = 'Network error. Check your connection.';
      }
    }
    return Promise.reject(error);
  }
);

export const profileApiClient = {
  getProfile: () => profileApi.get('/'),
  saveProfile: (data) => profileApi.put('/', data),
  saveSkills: (skills) => profileApi.put('/skills', { skills }),
};