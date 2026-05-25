/**
 * raceService.js — Career Race Protocol
 * 30-day multiplayer sprints with guilds and leaderboards
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class RaceService {
  /**
   * Create a new 30-day race
   */
  async createRace(raceData, creatorId) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const { data, error } = await supabase
      .from('career_races')
      .insert({
        title: raceData.title,
        description: raceData.description,
        category: raceData.category, // e.g., 'react', 'system_design', 'ai_engineering'
        difficulty: raceData.difficulty,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        created_by: creatorId,
        status: 'active',
        max_participants: raceData.maxParticipants || 50
      })
      .select()
      .single();

    if (error) throw error;

    // Create default daily tasks for the race
    await this.generateRaceTasks(data.id, raceData.category, raceData.difficulty);

    return data;
  }

  /**
   * Join a race (optionally with a guild)
   */
  async joinRace(raceId, userId, guildId = null) {
    const { data: existing } = await supabase
      .from('race_participants')
      .select('*')
      .eq('race_id', raceId)
      .eq('user_id', userId)
      .single();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('race_participants')
      .insert({
        race_id: raceId,
        user_id: userId,
        guild_id: guildId,
        joined_at: new Date().toISOString(),
        current_score: 0,
        streak_days: 0,
        last_activity: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Complete a daily task
   */
  async completeTask(taskId, userId, proofUrl = null) {
    const { data: task } = await supabase
      .from('race_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    // Record completion
    const { error } = await supabase
      .from('task_completions')
      .insert({
        task_id: taskId,
        user_id: userId,
        completed_at: new Date().toISOString(),
        proof_url: proofUrl,
        points_earned: task.points,
        verified: false // Can be verified by guild leader or AI later
      });

    if (error) throw error;

    // Update participant score and streak
    await this.updateParticipantStats(task.race_id, userId, task.points);

    return { success: true, pointsEarned: task.points };
  }

  /**
   * Get leaderboard for a race
   */
  async getLeaderboard(raceId) {
    const { data: participants } = await supabase
      .from('race_participants')
      .select(`
        *,
        profiles:user_id (name, avatar_url),
        guilds:guild_id (name)
      `)
      .eq('race_id', raceId)
      .order('current_score', { ascending: false })
      .limit(50);

    return participants?.map((p, idx) => ({
      rank: idx + 1,
      userId: p.user_id,
      name: p.profiles?.name || 'Anonymous',
      avatar: p.profiles?.avatar_url,
      guild: p.guilds?.name || 'Solo',
      score: p.current_score,
      streak: p.streak_days,
      lastActive: p.last_activity
    })) || [];
  }

  /**
   * Get active races for a user
   */
  async getUserRaces(userId) {
    const { data } = await supabase
      .from('race_participants')
      .select(`
        *,
        career_races:race_id (*)
      `)
      .eq('user_id', userId);

    return data?.map(d => ({
      ...d.career_races,
      participantStats: {
        score: d.current_score,
        streak: d.streak_days,
        joinedAt: d.joined_at
      }
    })) || [];
  }

  // ─── INTERNAL HELPERS ───

  async generateRaceTasks(raceId, category, difficulty) {
    const taskTemplates = {
      react: [
        { title: 'Build a custom hook', points: 10 },
        { title: 'Implement React.memo optimization', points: 15 },
        { title: 'Create a compound component pattern', points: 20 },
        { title: 'Write 3 unit tests with 80% coverage', points: 15 },
        { title: 'Deploy to Vercel with CI/CD', points: 20 },
        { title: 'Performance audit: reduce LCP by 40%', points: 25 },
        { title: 'Contribute to an open-source React library', points: 30 }
      ],
      system_design: [
        { title: 'Design a URL shortener', points: 15 },
        { title: 'Design a rate limiter', points: 20 },
        { title: 'Design a distributed cache', points: 25 },
        { title: 'Write a capacity estimation doc', points: 15 },
        { title: 'Trade-off analysis: SQL vs NoSQL', points: 20 }
      ],
      ai_engineering: [
        { title: 'Fine-tune a model on custom data', points: 25 },
        { title: 'Build a RAG pipeline', points: 20 },
        { title: 'Implement prompt caching strategy', points: 15 },
        { title: 'Evaluate model with custom benchmark', points: 20 }
      ]
    };

    const templates = taskTemplates[category] || taskTemplates.react;
    const multiplier = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.7 : 1;

    const tasks = templates.map((t, i) => ({
      race_id: raceId,
      day: i + 1,
      title: t.title,
      description: `Day ${i + 1} challenge: ${t.title}`,
      points: Math.round(t.points * multiplier),
      category
    }));

    await supabase.from('race_tasks').insert(tasks);
  }

  async updateParticipantStats(raceId, userId, points) {
    const { data: participant } = await supabase
      .from('race_participants')
      .select('*')
      .eq('race_id', raceId)
      .eq('user_id', userId)
      .single();

    if (!participant) return;

    const lastActive = new Date(participant.last_activity);
    const now = new Date();
    const hoursSince = (now - lastActive) / 36e5;

    let newStreak = participant.streak_days;
    if (hoursSince < 48) {
      // Within 2 days = streak maintained (allows some flexibility)
      if (hoursSince > 20) newStreak += 1; // New day
    } else {
      newStreak = 1; // Reset but count today
    }

    await supabase
      .from('race_participants')
      .update({
        current_score: participant.current_score + points,
        streak_days: newStreak,
        last_activity: now.toISOString()
      })
      .eq('id', participant.id);
  }
}

module.exports = new RaceService();