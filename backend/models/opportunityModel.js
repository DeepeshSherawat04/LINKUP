// opportunityModel.js
const supabase = require('../config/supabaseClient');

exports.getAll = async () => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*');
  
  if (error) throw error;
  return data || [];
};

exports.getById = async (id) => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // <-- CHANGED: safer
  
  if (error) throw error;
  return data;
};