// models/skillsModel.js
const supabase = require('../config/supabaseClient');

exports.getByUserId = async (userId) => {
  // Read from users.skills (where profile save stores them)
  const { data, error } = await supabase
    .from('users')
    .select('skills')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) throw error;
  
  // Return skills array, or empty array if null/undefined
  const skills = data?.skills;
  return Array.isArray(skills) ? skills : [];
};