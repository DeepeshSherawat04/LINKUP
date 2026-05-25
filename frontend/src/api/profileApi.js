// src/api/profileApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const profileApi = axios.create({
  baseURL: `${API_URL}/profile`,
  timeout: 10000,
});

// Attach auth token (same pattern as opportunityApi)
profileApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Error handling
profileApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = 'Network error. Check your connection.';
    }
    return Promise.reject(error);
  }
);

export const profileApiClient = {
  getProfile: () => profileApi.get('/'),
  saveProfile: (data) => profileApi.put('/', data),
  saveSkills: (skills) => profileApi.put('/skills', { skills }),
};