/**
 * predictionService.js — Temporal Opportunity Prediction
 * Predicts role demand 60-90 days before market saturation
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class PredictionService {
  constructor() {
    this.lookbackDays = 90;
    this.predictionHorizon = 60;
  }

  /**
   * Calculate trend velocity and saturation for opportunity categories
   */
  async calculateMarketContext() {
    try {
      // Fetch historical posting data (you'll need to store this in a new table)
      const { data: history } = await supabase
        .from('market_snapshots')
        .select('*')
        .gte('snapshot_date', new Date(Date.now() - this.lookbackDays * 86400000).toISOString())
        .order('snapshot_date', { ascending: true });

      if (!history || history.length === 0) {
        // Fallback: return neutral context if no historical data yet
        return this.getDefaultContext();
      }

      const categories = [...new Set(history.map(h => h.category))];
      const trendVelocity = {};
      const competitionGrowth = {};
      const salaryGrowth = {};

      categories.forEach(cat => {
        const catData = history.filter(h => h.category === cat);
        if (catData.length < 2) return;

        // Simple linear regression on posting volume
        const volumes = catData.map((d, i) => ({ x: i, y: d.posting_count || 0 }));
        const velocity = this.calculateSlope(volumes);
        trendVelocity[cat] = this.normalizeVelocity(velocity);

        // Competition growth rate (applicants per posting)
        const competition = catData.map((d, i) => ({ x: i, y: (d.applicant_count || 0) / (d.posting_count || 1) }));
        const compGrowth = this.calculateSlope(competition);
        competitionGrowth[cat] = this.normalizeSaturation(compGrowth);

        // Salary trend
        const salaries = catData.map((d, i) => ({ x: i, y: d.avg_salary || 0 }));
        const salGrowth = this.calculateSlope(salaries);
        salaryGrowth[cat] = this.normalizeVelocity(salGrowth);
      });

      return { trendVelocity, competitionGrowth, salaryGrowth, lastUpdated: new Date().toISOString() };
    } catch (error) {
      console.error('[PredictionService] Error:', error);
      return this.getDefaultContext();
    }
  }

  /**
   * Tag opportunities with temporal signals
   */
  async enrichOpportunities(opportunities) {
    const context = await this.calculateMarketContext();
    
    return opportunities.map(opp => {
      const cat = opp.category || 'general';
      const velocity = context.trendVelocity[cat] || 0.5;
      const saturation = context.competitionGrowth[cat] || 0.5;
      const salaryGrowth = context.salaryGrowth[cat] || 0.5;

      let temporalSignal;
      if (velocity > 0.7 && saturation < 0.4) {
        temporalSignal = '🔥 EMERGING — Early mover advantage';
      } else if (velocity > 0.5 && saturation < 0.6) {
        temporalSignal = '⚡ GROWING — Enter now';
      } else if (velocity < 0.3 && saturation > 0.7) {
        temporalSignal = '⚠️ SATURATING — Differentiate or pivot';
      } else if (salaryGrowth > 0.6) {
        temporalSignal = '💸 SALARY HEATING — Negotiate hard';
      } else {
        temporalSignal = '📊 STABLE — Established market';
      }

      return {
        ...opp,
        temporal_meta: {
          signal: temporalSignal,
          velocity,
          saturation,
          salaryGrowth,
          predictionConfidence: history ? 'medium' : 'low' // Until we have 90 days of data
        }
      };
    });
  }

  calculateSlope(points) {
    const n = points.length;
    const sumX = points.reduce((a, b) => a + b.x, 0);
    const sumY = points.reduce((a, b) => a + b.y, 0);
    const sumXY = points.reduce((a, b) => a + b.x * b.y, 0);
    const sumXX = points.reduce((a, b) => a + b.x * b.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  normalizeVelocity(rawSlope) {
    // Normalize slope to 0-1 scale (assuming max reasonable growth is 2x per month)
    return Math.max(0, Math.min(1, (rawSlope / 100) + 0.5));
  }

  normalizeSaturation(rawSlope) {
    // Higher slope = faster saturation growth = worse for job seekers
    return Math.max(0, Math.min(1, (rawSlope / 50) + 0.5));
  }

  getDefaultContext() {
    return {
      trendVelocity: {},
      competitionGrowth: {},
      salaryGrowth: {},
      lastUpdated: new Date().toISOString(),
      note: 'Historical data insufficient — using neutral defaults. Populate market_snapshots table.'
    };
  }
}

module.exports = new PredictionService();