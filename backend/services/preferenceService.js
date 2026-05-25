// This service handles tracking user preferences based on their interactions with opportunities, allowing us to personalize recommendations over time.
const supabase = require('../config/supabaseClient');

exports.trackSelection = async (userId, opportunityId, opportunityCategory) => {
  try {
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('category', opportunityCategory)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ 
          selection_count: existing.selection_count + 1,
          last_selected: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          category: opportunityCategory,
          selection_count: 1,
          last_selected: new Date().toISOString()
        });
    }
  } catch (e) {
    console.log('Preference tracking error:', e.message);
  }
};

exports.getTopPreference = async (userId) => {
  const { data } = await supabase
    .from('user_preferences')
    .select('category, selection_count')
    .eq('user_id', userId)
    .order('selection_count', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data?.category || null;
};