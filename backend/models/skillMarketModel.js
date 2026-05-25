// models/skillMarketModel.js
const { supabaseClient } = require('../config/supabaseClient');

class SkillMarketModel {
  static async getAll(limit = 100, category = null) {
    let query = supabaseClient
      .from('skill_market_data')
      .select('*')
      .order('demand_growth_yoy', { ascending: false })
      .limit(limit);

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw new Error(`Market data fetch failed: ${error.message}`);
    return data || [];
  }

  static async getByNames(skillNames) {
    const { data, error } = await supabaseClient
      .from('skill_market_data')
      .select('*')
      .in('skill_name', skillNames);

    if (error) throw new Error(`Skill lookup failed: ${error.message}`);
    return data || [];
  }

  static async getArbitrageOpportunities(minGrowth = 1.0, maxSupply = 0.5, maxLearningDays = 60) {
    const { data, error } = await supabaseClient
      .from('skill_market_data')
      .select('*')
      .gte('demand_growth_yoy', minGrowth)
      .lte('supply_index', maxSupply)
      .lte('learning_days_estimate', maxLearningDays)
      .order('demand_growth_yoy', { ascending: false });

    if (error) throw new Error(`Arbitrage query failed: ${error.message}`);
    return data || [];
  }

  static async getCoolingSkills() {
    const { data, error } = await supabaseClient
      .from('skill_market_data')
      .select('*')
      .lt('demand_growth_yoy', 0)
      .order('demand_growth_yoy', { ascending: true });

    if (error) throw new Error(`Cooling skills query failed: ${error.message}`);
    return data || [];
  }

  static async upsert(skillData) {
    const { error } = await supabaseClient
      .from('skill_market_data')
      .upsert(skillData, { onConflict: 'skill_name' });

    if (error) throw new Error(`Market data upsert failed: ${error.message}`);
    return true;
  }

  static async trackUserSkillGap(userId, skillName, status = 'identified') {
    const { data, error } = await supabaseClient
      .from('user_skill_gaps')
      .upsert({
        user_id: userId,
        skill_name: skillName,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,skill_name' })
      .select()
      .single();

    if (error) throw new Error(`Skill gap tracking failed: ${error.message}`);
    return data;
  }

  static async getUserSkillGaps(userId) {
    const { data, error } = await supabaseClient
      .from('user_skill_gaps')
      .select('*, skill_market_data(*)')
      .eq('user_id', userId);

    if (error) throw new Error(`User gaps fetch failed: ${error.message}`);
    return data || [];
  }
}

module.exports = SkillMarketModel;