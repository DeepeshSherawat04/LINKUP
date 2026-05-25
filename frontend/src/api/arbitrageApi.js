import { supabase } from '../config/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ArbitrageApi {
  async getHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': session ? `Bearer ${session.access_token}` : ''
    };
  }

  async getOpportunities(userSkills = []) {
    const skillsParam = userSkills.length ? `?skills=${encodeURIComponent(userSkills.join(','))}` : '';
    const res = await fetch(`${API_URL}/api/arbitrage/opportunities${skillsParam}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getHeatmap(userSkills = []) {
    const skillsParam = userSkills.length ? `?skills=${encodeURIComponent(userSkills.join(','))}` : '';
    const res = await fetch(`${API_URL}/api/arbitrage/heatmap${skillsParam}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getLearningPlan(skillName) {
    const res = await fetch(`${API_URL}/api/arbitrage/learning-plan/${encodeURIComponent(skillName)}`, {
      headers: await this.getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async trackSkill(skillName, status = 'identified') {
    const res = await fetch(`${API_URL}/api/arbitrage/track-skill`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ skill_name: skillName, status })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

export const arbitrageApi = new ArbitrageApi();