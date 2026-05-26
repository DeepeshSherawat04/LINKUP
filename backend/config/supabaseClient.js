// supabaseClient.js - Initializes and exports the Supabase client for database interactions
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Warning: Supabase credentials not set in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = supabase;f