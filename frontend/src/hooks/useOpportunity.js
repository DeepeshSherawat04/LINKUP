// useOpportunity.js — FINAL v2.1 SINGULARITY EDITION
// Priority 2: Analytical data | Priority 3: Explainability | Priority 4: Error states

import { useState, useEffect, useCallback } from 'react';
import { opportunityApi } from '../api/opportunityApi';
import { useAuth } from '../context/AuthContext';
import api from '../api/api'; // Direct Axios instance for critical calls like execution plan

/* ─────────────────────────────────────────
   1. RADAR — Personalized top opportunities
   ───────────────────────────────────────── */
export const useOpportunityRadar = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emptyState, setEmptyState] = useState(null);
  const [meta, setMeta] = useState(null);

  const fetchRadar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEmptyState(null);

      const response = await opportunityApi.getRadar();
      const responseData = response.data;

      if (responseData.meta?.emptyState) {
        setData([]);
        setEmptyState(responseData.meta.emptyState);
        setMeta(responseData.meta);
        return;
      }

      setData(responseData.data || []);
      setMeta(responseData.meta || null);
    } catch (err) {
      const status = err.response?.status;
      const backendError = err.response?.data?.error;

      if (backendError) {
        setError({
          message: backendError.message || 'Something went wrong',
          type: backendError.type || 'UNKNOWN',
          title: backendError.title || 'Error',
          action: backendError.action || 'retry',
          ctaText: backendError.ctaText,
          ctaLink: backendError.ctaLink,
        });
      } else if (status === 401) {
        setError({
          message: 'Please sign in to see your personalized radar',
          type: 'AUTH_REQUIRED',
          title: 'Login Required',
          action: 'login',
          ctaText: 'Sign In',
          ctaLink: '/login',
        });
      } else if (status === 503 || status === 504) {
        setError({
          message:
            err.response?.data?.error?.message ||
            'Service temporarily unavailable. Please try again.',
          type: 'SERVICE_ERROR',
          title: 'Service Unavailable',
          action: 'retry',
        });
      } else {
        setError({
          message: err.message || 'Failed to load opportunities',
          type: 'NETWORK_ERROR',
          title: 'Connection Issue',
          action: 'retry',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  return {
    data,
    loading,
    error,
    emptyState,
    meta,
    refetch: fetchRadar,
  };
};

/* ─────────────────────────────────────────
   2. ALL OPPORTUNITIES — For dropdowns / plan
   ───────────────────────────────────────── */
export const useAllOpportunities = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await opportunityApi.getAll();
      setData(res.data?.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load opportunities'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
};

/* ─────────────────────────────────────────
   3. WHY NOT PATH — Explainability
   ───────────────────────────────────────── */
export const useWhyNotPath = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWhyNot = useCallback(async (opportunityId) => {
    try {
      setLoading(true);
      setError(null);
      const res = await opportunityApi.getWhyNotPath(opportunityId);

      if (res.data.meta?.emptyState) {
        setData(null);
        setError({
          type: res.data.meta.emptyState.type,
          title: res.data.meta.emptyState.title,
          message: res.data.meta.emptyState.message,
          ctaLink: res.data.meta.emptyState.ctaLink,
        });
        return;
      }

      setData(res.data.data);
    } catch (err) {
      const backendError = err.response?.data?.error;
      setError({
        type: backendError?.type || 'UNKNOWN',
        title: backendError?.title || 'Error',
        message: backendError?.message || err.message || 'Failed to analyze path',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchWhyNot };
};

/* ─────────────────────────────────────────
   4. COMPARISON — Analytical dashboard
   ───────────────────────────────────────── */
export const useOpportunityComparison = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComparison = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await opportunityApi.getComparison();
      setData(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchComparison };
};

/* ─────────────────────────────────────────
   5. LAZY EXPLANATION — Singularity feature
   ───────────────────────────────────────── */
export const useOpportunityExplanation = () => {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchExplanation = useCallback(async (opportunityId) => {
    setLoading(true);
    try {
      const res = await opportunityApi.getExplanation(opportunityId);
      setExplanation(res.data);
    } catch (err) {
      console.error('Explanation error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { explanation, loading, fetchExplanation };
};

/* ─────────────────────────────────────────
   6. CAREER TWIN — Agentic AI (USP 2)
   ───────────────────────────────────────── */
export const useCareerTwin = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (command) => {
    if (!command?.trim()) return null;
    setLoading(true);
    try {
      const res = await opportunityApi.askCareerTwin(command);
      setResult(res.data);
      return res.data;
    } catch (err) {
      console.error('Twin error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, execute };
};

/* ─────────────────────────────────────────
   7. ARBITRAGE MATRIX — Salary arbitrage (USP 4)
   ───────────────────────────────────────── */
export const useOpportunityArbitrage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArbitrage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await opportunityApi.getArbitrage();
      setData(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchArbitrage };
};

/* ─────────────────────────────────────────
   8. EXECUTION PLAN — Generate + Simulate
   ───────────────────────────────────────── */
export const useExecutionPlan = () => {
  const [plan, setPlan] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async (opportunityId, options = {}) => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setSimulation(null);

    try {
      // 1. Generate AI Plan — direct axios call (consistent with api.js interceptors)
      const planRes = await api.post('/execution/plan', {
        opportunityId,
        goal_type: options.goal_type || 'freelance',
        time_per_week: options.time_per_week || 15,
        skills: options.skills || [],
      });

      // DEBUG — check browser console after clicking Generate
      console.log('🔥 RAW planRes.data:', planRes.data);

      // FIXED: Unwrap nested { success: true, data: { weeks: [...] } }
      const planPayload = planRes.data?.data ?? planRes.data ?? planRes;
      setPlan(planPayload);

      // 2. Fetch Income Simulation
      try {
        const simRes = await api.post(`/opportunities/${opportunityId}/simulate`, {});
        console.log('🔥 RAW simRes.data:', simRes.data);

        const simPayload = simRes.data?.data ?? simRes.data ?? simRes;
        // Ensure array so .map() works in ExecutionPlan.jsx
        setSimulation(Array.isArray(simPayload) ? simPayload : simPayload ? [simPayload] : []);
      } catch (simErr) {
        console.warn('Simulation fetch failed (non-critical):', simErr.message);
      }

    } catch (err) {
      console.error('Plan generation error:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error?.message ||
        err.message || 
        'Failed to generate execution plan'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { plan, simulation, loading, error, generate };
};

/* ─────────────────────────────────────────
   9. CAREER RACE — Social protocol (USP 5)
   ───────────────────────────────────────── */
export const useCareerRace = () => {
  const [races, setRaces] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await opportunityApi.getRaces();
      setRaces(res.data?.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinRace = useCallback(async (raceId, guildId) => {
    try {
      const res = await opportunityApi.joinRace(raceId, guildId);
      return res.data;
    } catch (err) {
      console.error('Join race error:', err);
      throw err;
    }
  }, []);

  const fetchLeaderboard = useCallback(async (raceId) => {
    try {
      const res = await opportunityApi.getLeaderboard(raceId);
      setLeaderboard(res.data?.data || []);
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
  }, []);

  return { races, leaderboard, loading, error, fetchRaces, joinRace, fetchLeaderboard };
};