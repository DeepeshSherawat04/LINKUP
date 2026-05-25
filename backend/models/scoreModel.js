const supabase = require('../config/supabaseClient');

exports.saveScore = async (scoreData) => {
  const { data, error } = await supabase
    .from('user_opportunity_scores')
    .insert({
      user_id: scoreData.user_id,
      opportunity_id: scoreData.opportunity_id,
      final_score: scoreData.final_score,
      income_probability_level: scoreData.income_probability_level,
      income_probability_range: scoreData.income_probability_range,
      skill_match_percent: scoreData.skill_match_percent,
      score_breakdown: scoreData.score_breakdown,
      ai_explanation: scoreData.ai_explanation
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

exports.getLatestScoresByUser = async (userId, limit = 3) => {
  const { data, error } = await supabase
    .from('user_opportunity_scores')
    .select(`
      *,
      opportunities:opportunity_id (
        id, title, demand_score, competition_score, income_speed, required_skills
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};

exports.getHistoricalComparison = async (userId, opportunityId) => {
  const { data, error } = await supabase
    .from('user_opportunity_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) throw error;
  return data || [];
};