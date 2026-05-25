// frontend/src/api/incomeApi.js
import { supabase } from '../config/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class IncomeApi {
  async getHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': session ? `Bearer ${session.access_token}` : ''
    };
  }

  async simulate(offerDetails, personalFinances, simulationName = '') {
    const res = await fetch(`${API_URL}/api/income/simulate`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ simulation_name: simulationName, offer_details: offerDetails, personal_finances: personalFinances })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getSimulations(limit = 10, offset = 0) {
    const res = await fetch(`${API_URL}/api/income/simulations?limit=${limit}&offset=${offset}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getSimulation(id) {
    const res = await fetch(`${API_URL}/api/income/simulations/${id}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteSimulation(id) {
    const res = await fetch(`${API_URL}/api/income/simulations/${id}`, {
      method: 'DELETE',
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getCostOfLiving(location) {
    const url = location 
      ? `${API_URL}/api/income/cost-of-living?location=${encodeURIComponent(location)}`
      : `${API_URL}/api/income/cost-of-living`;
    const res = await fetch(url, { headers: await this.getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async searchCities(query) {
    const res = await fetch(`${API_URL}/api/income/cities?query=${encodeURIComponent(query)}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

export const incomeApi = new IncomeApi();