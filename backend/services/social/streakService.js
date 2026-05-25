/**
 * streakService.js — Engagement Mechanics
 * XP, streaks, badges, and behavioral nudges for Career Race Protocol
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const XP_TABLE = {
  TASK_COMPLETE: 10,
  TASK_COMPLETE_EARLY: 15, // Before 9 AM
  STREAK_3: 25,
  STREAK_7: 50,
  STREAK_14: 100,
  STREAK_30: 250,
  RACE_JOIN: 20,
  RACE_WIN: 500, // Top 3
  GUILD_HELP: 15, // Help another member
  PORTFOLIO_SUBMIT: 40,
  INTERVIEW_SIM_COMPLETE: 30,
  TWIN_COMMAND: 5
};

const BADGES = [
  { id: 'early_bird', name: 'Early Bird', desc: 'Complete 5 tasks before 9 AM', condition: (stats) => stats.earlyCompletions >= 5 },
  { id: 'streak_master', name: 'Streak Master', desc: '7-day streak', condition: (stats) => stats.maxStreak >= 7 },
  { id: 'race_winner', name: 'Race Winner', desc: 'Finish top 3 in a Career Race', condition: (stats) => stats.raceWins >= 1 },
  { id: 'skill_immunizer', name: 'Immunizer', desc: 'Complete a 30-day skill immunization plan', condition: (stats) => stats.immunizations >= 1 },
  { id: 'twin_power', name: 'Twin Power', desc: 'Execute 20 Career Twin commands', condition: (stats) => stats.twinCommands >= 20 },
  { id: 'arbitrage_hunter', name: 'Arbitrage Hunter', desc: 'Apply to 3 remote roles with 1.5x+ salary arbitrage', condition: (stats) => stats.arbitrageApplies >= 3 }
];

class StreakService {
  /**
   * Record an activity and update streak/XP
   */
  async recordActivity(userId, activityType, metadata = {}) {
    const now = new Date();
    const hour = now.getHours();

    let xp = XP_TABLE[activityType] || 5;
    let isEarly = hour < 9 && activityType === 'TASK_COMPLETE';
    if (isEarly) xp = XP_TABLE.TASK_COMPLETE_EARLY;

    // Get current stats
    const { data: stats } = await supabase
      .from('user_engagement_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentStats = stats || {
      user_id: userId,
      current_streak: 0,
      max_streak: 0,
      total_xp: 0,
      last_activity_date: null,
      early_completions: 0,
      race_wins: 0,
      immunizations: 0,
      twin_commands: 0,
      arbitrage_applies: 0
    };

    // Streak logic
    const lastDate = currentStats.last_activity_date ? new Date(currentStats.last_activity_date) : null;
    const daysSince = lastDate ? Math.floor((now - lastDate) / 86400000) : 999;

    let newStreak = currentStats.current_streak;
    if (daysSince === 1) {
      newStreak += 1;
    } else if (daysSince > 1) {
      newStreak = 1; // Reset but count today
    } else if (daysSince === 0) {
      // Already active today, don't increment streak
    } else {
      newStreak = 1;
    }

    // Streak bonuses
    let streakBonus = 0;
    if (newStreak === 3) streakBonus = XP_TABLE.STREAK_3;
    if (newStreak === 7) streakBonus = XP_TABLE.STREAK_7;
    if (newStreak === 14) streakBonus = XP_TABLE.STREAK_14;
    if (newStreak === 30) streakBonus = XP_TABLE.STREAK_30;

    // Update stats
    const updatedStats = {
      ...currentStats,
      current_streak: newStreak,
      max_streak: Math.max(currentStats.max_streak, newStreak),
      total_xp: currentStats.total_xp + xp + streakBonus,
      last_activity_date: now.toISOString(),
      early_completions: isEarly ? currentStats.early_completions + 1 : currentStats.early_completions,
      twin_commands: activityType === 'TWIN_COMMAND' ? currentStats.twin_commands + 1 : currentStats.twin_commands,
      immunizations: activityType === 'IMMUNIZATION_COMPLETE' ? currentStats.immunizations + 1 : currentStats.immunizations
    };

    // Upsert
    await supabase
      .from('user_engagement_stats')
      .upsert(updatedStats, { onConflict: 'user_id' });

    // Check badges
    const newBadges = await this.checkBadges(userId, updatedStats);

    return {
      xpEarned: xp + streakBonus,
      streak: newStreak,
      totalXp: updatedStats.total_xp,
      newBadges,
      isEarly
    };
  }

  /**
   * Get user engagement stats
   */
  async getStats(userId) {
    const { data } = await supabase
      .from('user_engagement_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      return {
        current_streak: 0,
        max_streak: 0,
        total_xp: 0,
        level: 1,
        nextLevelXp: 100,
        badges: []
      };
    }

    const level = Math.floor(Math.sqrt(data.total_xp / 10)) + 1;
    const nextLevelXp = Math.pow(level, 2) * 10;

    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    return {
      ...data,
      level,
      nextLevelXp,
      progress: ((data.total_xp - Math.pow(level - 1, 2) * 10) / (nextLevelXp - Math.pow(level - 1, 2) * 10)) * 100,
      badges: userBadges?.map(b => b.badge_id) || []
    };
  }

  /**
   * Check and award new badges
   */
  async checkBadges(userId, stats) {
    const { data: existing } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const existingIds = new Set(existing?.map(e => e.badge_id) || []);
    const newBadges = [];

    for (const badge of BADGES) {
      if (!existingIds.has(badge.id) && badge.condition(stats)) {
        await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id,
          awarded_at: new Date().toISOString()
        });
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  /**
   * Get leaderboard by XP
   */
  async getXpLeaderboard(limit = 50) {
    const { data } = await supabase
      .from('user_engagement_stats')
      .select('*, profiles:user_id(name, avatar_url)')
      .order('total_xp', { ascending: false })
      .limit(limit);

    return data?.map((d, i) => ({
      rank: i + 1,
      userId: d.user_id,
      name: d.profiles?.name || 'Anonymous',
      avatar: d.profiles?.avatar_url,
      xp: d.total_xp,
      level: Math.floor(Math.sqrt(d.total_xp / 10)) + 1,
      streak: d.current_streak,
      maxStreak: d.max_streak
    })) || [];
  }
}

module.exports = new StreakService();