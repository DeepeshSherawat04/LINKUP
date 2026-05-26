// executionPlanModel.js
const supabase = require('../config/supabaseClient');

exports.save = async (planData) => {
  const { data, error } = await supabase
    .from('execution_plans')a
    .upsert({
      user_id: planData.user_id,
      opportunity_id: planData.opportunity_id,
      week_1: planData.week_1,
      week_2: planData.week_2,
      week_3: planData.week_3,
      week_4: planData.week_4,
      ai_generated: planData.ai_generated || false
    }, { onConflict: 'user_id,opportunity_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

exports.getByUserAndOpportunity = async (userId, opportunityId) => {
  const { data, error } = await supabase
    .from('execution_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

exports.getByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('execution_plans')
    .select(`
      *,
      opportunities:opportunity_id (title)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};