// userModel.js
const supabase = require('../config/supabaseClient');

exports.findById = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // <-- CHANGED: .single() → .maybeSingle()
  
  // If no custom users table row, return null (don't throw)
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

exports.findOrCreate = async (id, email) => {
  // Try to find first
  let user = await exports.findById(id);
  if (user) return user;
  
  // Create if not exists
  const { data, error } = await supabase
    .from('users')
    .insert({ id, email, time_per_week: 10 })
    .select()
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

exports.update = async (id, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  
  if (error) throw error;
  return data;
};