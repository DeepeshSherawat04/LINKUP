// models/incomeSimulationModel.js
const { supabaseClient } = require('../config/supabaseClient');

class IncomeSimulationModel {
  static async create(userId, simulationName, offerDetails, personalFinances, scenarios) {
    if (!userId) throw new Error('Authentication required: userId missing');
    
    const { data, error } = await supabaseClient
      .from('income_simulations')
      .insert({
        user_id: userId,
        simulation_name: simulationName || 'Untitled Simulation',
        offer_details: offerDetails,
        personal_finances: personalFinances,
        scenarios: scenarios,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[IncomeSimulationModel.create] Supabase error:', error);
      throw new Error(`Database insertion failed: ${error.message}`);
    }

    return data;
  }

  static async getByUserId(userId, limit = 20, offset = 0) {
    if (!userId) throw new Error('Authentication required');

    const { data, error } = await supabaseClient
      .from('income_simulations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[IncomeSimulationModel.getByUserId] Supabase error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    return data || [];
  }

  static async getById(id, userId) {
    const { data, error } = await supabaseClient
      .from('income_simulations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[IncomeSimulationModel.getById] Supabase error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!data) throw new Error('Simulation not found or access denied');
    return data;
  }

  static async delete(id, userId) {
    const { error } = await supabaseClient
      .from('income_simulations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[IncomeSimulationModel.delete] Supabase error:', error);
      throw new Error(`Database deletion failed: ${error.message}`);
    }

    return true;
  }
}

module.exports = IncomeSimulationModel;