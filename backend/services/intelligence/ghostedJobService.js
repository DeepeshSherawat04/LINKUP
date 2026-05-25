// ghostedJobService.js — v1.0 PRODUCTION
const { createClient } = require('@supabase/supabase-js');
const redisClient = require('../../config/redisClient');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const CACHE_TTL = 300; // 5 minutes — stats change as users log outcomes

class GhostedJobService {
  /**
   * Analyze a company+role using anonymized network data
   */
  async analyze(company, role, userId) {
    try {
      const cacheKey = `ghosted:${company.toLowerCase().replace(/\s+/g, '_')}:${role.toLowerCase().replace(/\s+/g, '_')}`;

      // 1. Try cache
      let stats = await redisClient.getCache(cacheKey);

      // 2. Fallback to DB + cache
      if (!stats) {
        const { data, error } = await supabase.rpc('get_ghosted_stats', {
          p_company: company,
          p_role: role
        });
        if (error) throw error;
        stats = data;
        await redisClient.setCache(cacheKey, stats, CACHE_TTL);
      }

      // 3. User's own history at this company
      const { data: history, error: hErr } = await supabase
        .from('application_outcomes')
        .select('*')
        .eq('user_id', userId)
        .ilike('company', `%${company}%`)
        .ilike('role', `%${role}%`)
        .order('applied_date', { ascending: false })
        .limit(20);

      if (hErr) console.warn('[GhostedJobService] History fetch warning:', hErr.message);

      // 4. User profile for gap analysis
      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('skills, github_stats, experience_years, location')
        .eq('id', userId)
        .single();

      if (pErr) console.warn('[GhostedJobService] Profile fetch warning:', pErr.message);

      return {
        network: {
          totalApplicants: stats?.total_applicants || 0,
          responseRate: stats?.response_rate || 0,
          avgTimeToReject: stats?.avg_days_to_reject,
          avgTimeToInterview: stats?.avg_days_to_interview,
          source: 'linkup_network'
        },
        whatWorked: stats?.what_worked || [],
        redFlags: stats?.red_flags || [],
        topSkills: stats?.top_hired_skills || [],
        userHistory: history || [],
        userProfile: profile || null,
        gapAnalysis: this._computeGaps(profile, stats)
      };
    } catch (error) {
      console.error('[GhostedJobService.analyze] Fatal:', error.message);
      // Graceful degradation — return empty but valid structure
      return {
        network: { totalApplicants: 0, responseRate: 0, source: 'error' },
        whatWorked: [], redFlags: [], topSkills: [],
        userHistory: [], userProfile: null, gapAnalysis: null,
        error: error.message
      };
    }
  }

  /**
   * Record a new outcome + invalidate cache
   */
  async recordOutcome(payload, userId) {
    try {
      const { data, error } = await supabase.rpc('record_application_outcome', {
        p_user_id: userId,
        p_company: payload.company,
        p_role: payload.role,
        p_applied_date: payload.appliedDate,
        p_response_date: payload.responseDate || null,
        p_outcome: payload.outcome || 'ghosted',
        p_skills: payload.skills || [],
        p_has_system_design_project: payload.hasSystemDesignProject || false,
        p_has_graphql: payload.hasGraphql || false,
        p_readme_length: payload.readmeLength || null,
        p_last_commit_date: payload.lastCommitDate || null,
        p_has_referral: payload.hasReferral || false,
        p_num_react_projects: payload.numReactProjects || 0,
        p_has_tests: payload.hasTests || false,
        p_resume_version: payload.resumeVersion || null,
        p_notes: payload.notes || null
      });

      if (error) throw error;

      // Invalidate cache so next analyze is fresh
      const cacheKey = `ghosted:${payload.company.toLowerCase().replace(/\s+/g, '_')}:${payload.role.toLowerCase().replace(/\s+/g, '_')}`;
      await redisClient.deleteCache(cacheKey);

      return { success: true, id: data };
    } catch (error) {
      console.error('[GhostedJobService.recordOutcome] Fatal:', error.message);
      throw error;
    }
  }

  /**
   * User's full application history
   */
  async getUserHistory(userId, filters = {}) {
    try {
      let query = supabase
        .from('application_outcomes')
        .select('*')
        .eq('user_id', userId)
        .order('applied_date', { ascending: false });

      if (filters.company) query = query.ilike('company', `%${filters.company}%`);
      if (filters.role) query = query.ilike('role', `%${filters.role}%`);
      if (filters.outcome) query = query.eq('outcome', filters.outcome);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[GhostedJobService.getUserHistory] Fatal:', error.message);
      return [];
    }
  }

  /**
   * Dashboard-level stats for the user
   */
  async getUserStats(userId) {
    try {
      const { data, error } = await supabase.rpc('get_user_application_stats', {
        p_user_id: userId
      });
      if (error) throw error;
      return data || { total_applied: 0, total_ghosted: 0, response_rate: 0, interview_rate: 0, offer_rate: 0 };
    } catch (error) {
      console.error('[GhostedJobService.getUserStats] Fatal:', error.message);
      return { total_applied: 0, total_ghosted: 0, response_rate: 0, interview_rate: 0, offer_rate: 0 };
    }
  }

  // ─── Internal: Gap Analysis ───
  _computeGaps(profile, stats) {
    if (!profile || !stats?.red_flags) return null;

    const gaps = [];
    const skills = profile.skills || [];
    const github = profile.github_stats || {};

    stats.red_flags.forEach(flag => {
      let userHas = false;
      const name = flag.flag_name?.toLowerCase() || '';

      if (name.includes('system design')) {
        userHas = skills.some(s => s.toLowerCase().includes('system design')) || github.has_system_design_project;
      } else if (name.includes('readme')) {
        userHas = (github.readme_length || 0) >= 100;
      } else if (name.includes('commit')) {
        const lastCommit = github.last_commit_date ? new Date(github.last_commit_date) : null;
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        userHas = lastCommit && lastCommit > threeMonthsAgo;
      } else if (name.includes('referral')) {
        userHas = false; // We don't know future intent; default fail to encourage action
      }

      gaps.push({
        factor: flag.flag_name,
        risk: flag.rate,
        userStatus: userHas ? 'pass' : 'fail',
        severity: (flag.rate || 0) > 0.7 ? 'critical' : (flag.rate || 0) > 0.5 ? 'warning' : 'info'
      });
    });

    return gaps;
  }
}

module.exports = new GhostedJobService();