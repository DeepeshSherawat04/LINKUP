/**
 * guildService.js — Guild/Cohort Management
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class GuildService {
  async createGuild(guildData, creatorId) {
    const { data, error } = await supabase
      .from('guilds')
      .insert({
        name: guildData.name,
        description: guildData.description,
        focus_area: guildData.focusArea,
        created_by: creatorId,
        max_members: guildData.maxMembers || 20,
        invite_code: this.generateInviteCode()
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as guild leader
    await supabase.from('guild_members').insert({
      guild_id: data.id,
      user_id: creatorId,
      role: 'leader',
      joined_at: new Date().toISOString()
    });

    return data;
  }

  async joinGuild(guildId, userId, inviteCode) {
    // Verify invite code if guild is private
    const { data: guild } = await supabase.from('guilds').select('*').eq('id', guildId).single();
    if (guild.invite_code && guild.invite_code !== inviteCode) {
      throw new Error('Invalid invite code');
    }

    const { data, error } = await supabase
      .from('guild_members')
      .insert({
        guild_id: guildId,
        user_id: userId,
        role: 'member',
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getGuildStats(guildId) {
    const { data: members } = await supabase
      .from('guild_members')
      .select('*, profiles:user_id(name, avatar_url)')
      .eq('guild_id', guildId);

    const { data: races } = await supabase
      .from('career_races')
      .select('*')
      .eq('guild_id', guildId)
      .eq('status', 'active');

    return {
      memberCount: members?.length || 0,
      members: members?.map(m => ({ name: m.profiles?.name, role: m.role })),
      activeRaces: races?.length || 0,
      totalCollectiveScore: members?.reduce((a, m) => a + (m.current_score || 0), 0) || 0
    };
  }

  generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = new GuildService();