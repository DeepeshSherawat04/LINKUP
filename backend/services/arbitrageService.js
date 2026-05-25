// services/arbitrageService.js
const SkillMarketModel = require('../models/skillMarketModel');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Unified Arbitrage Service
 * Handles BOTH:
 * 1. Skill Arbitrage Radar (market gap finder, learning paths)
 * 2. Salary Arbitrage Matrix (location-based salary comparison)
 */
class ArbitrageService {
  // ═══════════════════════════════════════════════════════
  // SKILL ARBITRAGE RADAR (Market Gap Finder)
  // ═══════════════════════════════════════════════════════

  static async findOpportunities(userSkills = []) {
    const normalizedUserSkills = Array.isArray(userSkills) 
      ? userSkills.map(s => {
          if (typeof s === 'string') return s.toLowerCase().trim();
          return (s.skill_name || s.name || String(s)).toLowerCase().trim();
        })
      : [];

    const hotOpportunities = await SkillMarketModel.getArbitrageOpportunities();
    const coolingSkills = await SkillMarketModel.getCoolingSkills();

    const scored = hotOpportunities.map(skill => {
      const arbitrageScore = this._calculateArbitrageScore(skill);
      const isOwned = normalizedUserSkills.includes(skill.skill_name.toLowerCase());
      
      return {
        ...skill,
        arbitrage_score: Math.round(arbitrageScore),
        is_already_owned: isOwned,
        gap_analysis: isOwned ? null : this._buildGapAnalysis(skill, normalizedUserSkills),
        learning_path: isOwned ? null : this._generateLearningPath(skill)
      };
    });

    scored.sort((a, b) => b.arbitrage_score - a.arbitrage_score);

    return {
      opportunities: scored.filter(s => !s.is_already_owned),
      owned_skills: scored.filter(s => s.is_already_owned),
      cooling: coolingSkills.map(s => ({
        skill_name: s.skill_name,
        demand_growth_yoy: s.demand_growth_yoy,
        supply_index: s.supply_index,
        avg_salary_cents: s.avg_salary_cents
      })),
      last_updated: new Date().toISOString()
    };
  }

  static async getUserHeatmap(userSkills = []) {
    const allMarketData = await SkillMarketModel.getAll(200);
    const normalizedUserSkills = userSkills.map(s => {
      if (typeof s === 'string') return s.toLowerCase().trim();
      return (s.skill_name || s.name || String(s)).toLowerCase().trim();
    });

    const heatmap = allMarketData.map(skill => {
      const isOwned = normalizedUserSkills.includes(skill.skill_name.toLowerCase());
      const demandLevel = this._categorizeDemand(skill.demand_growth_yoy);
      
      return {
        skill: skill.skill_name,
        category: skill.category,
        is_owned: isOwned,
        demand_level: demandLevel,
        demand_growth_yoy: skill.demand_growth_yoy,
        avg_salary_cents: skill.avg_salary_cents,
        supply_index: skill.supply_index,
        learning_days: skill.learning_days_estimate,
        time_to_fill: skill.time_to_fill_days
      };
    });

    const byCategory = heatmap.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    return {
      heatmap,
      by_category: byCategory,
      stats: {
        total_skills: heatmap.length,
        owned_count: heatmap.filter(h => h.is_owned).length,
        hot_missing: heatmap.filter(h => !h.is_owned && h.demand_level === 'hot').length
      }
    };
  }

  static async generateLearningPlan(skillName) {
    const [skill] = await SkillMarketModel.getByNames([skillName]);
    if (!skill) throw new Error(`Skill not found: ${skillName}`);

    const plan = this._generateLearningPath(skill);
    return {
      skill: skill.skill_name,
      category: skill.category,
      plan,
      estimated_salary_bump_cents: this._estimateSalaryBump(skill),
      market_confidence: this._calculateMarketConfidence(skill)
    };
  }

  // ═══════════════════════════════════════════════════════
  // SALARY ARBITRAGE MATRIX (Location-Based)
  // ═══════════════════════════════════════════════════════

  async getArbitrageMatrix(userSkills, userLocation) {
    try {
      const { data: benchmarks } = await supabase
        .from('salary_benchmarks')
        .select('skill_name, location_tier, median_salary, currency, remote_allowed')
        .in('skill_name', userSkills.map(s => s.skill_name || s));

      if (!benchmarks) return [];

      const userTier = this.classifyLocationTier(userLocation);
      
      const matrix = userSkills.map(skill => {
        const skillName = skill.skill_name || skill;
        const skillBenches = benchmarks.filter(b => b.skill_name === skillName);
        
        const localBench = skillBenches.find(b => b.location_tier === userTier) || skillBenches[0];
        const globalBench = skillBenches
          .filter(b => b.remote_allowed)
          .sort((a, b) => b.median_salary - a.median_salary)[0];

        if (!localBench || !globalBench) return null;

        const arbitrageRatio = globalBench.median_salary / localBench.median_salary;
        
        return {
          skill: skillName,
          localSalary: localBench.median_salary,
          globalSalary: globalBench.median_salary,
          arbitrageRatio: parseFloat(arbitrageRatio.toFixed(2)),
          locationTier: userTier,
          bestMarket: globalBench.location_tier,
          remoteEligible: globalBench.remote_allowed,
          recommendation: this.generateRecommendation(arbitrageRatio, skillName, globalBench.location_tier)
        };
      }).filter(Boolean);

      return matrix.sort((a, b) => b.arbitrageRatio - a.arbitrageRatio);
    } catch (error) {
      console.error('[ArbitrageService] Salary matrix error:', error);
      return [];
    }
  }

  classifyLocationTier(location) {
    if (!location) return 'global';
    const tier1 = ['san francisco', 'new york', 'london', 'singapore', 'zurich', 'sydney', 'tel aviv'];
    const tier2 = ['austin', 'seattle', 'toronto', 'berlin', 'amsterdam', 'dublin', 'bangalore'];
    
    const loc = location.toLowerCase();
    if (tier1.some(t => loc.includes(t))) return 'tier_1';
    if (tier2.some(t => loc.includes(t))) return 'tier_2';
    return 'tier_3_plus';
  }

  generateRecommendation(ratio, skill, market) {
    if (ratio >= 2.0) return `💰 Extreme arbitrage: ${skill} pays ${ratio}x more in ${market}. Prioritize remote roles immediately.`;
    if (ratio >= 1.5) return `💡 Strong arbitrage for ${skill}. Target ${market} remote positions.`;
    if (ratio >= 1.2) return `⚖️ Moderate uplift for ${skill} via remote work.`;
    return `🏠 ${skill} is competitively priced locally. Focus on skill depth over geography.`;
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS (Skill Radar)
  // ═══════════════════════════════════════════════════════

  static _calculateArbitrageScore(skill) {
    const demandWeight = Math.max(0, skill.demand_growth_yoy);
    const salaryWeight = skill.avg_salary_cents / 1000000;
    const supplyPenalty = 1 - skill.supply_index;
    const learningCost = Math.max(1, skill.learning_days_estimate / 10);
    return (demandWeight * salaryWeight * supplyPenalty * 100) / learningCost;
  }

  static _buildGapAnalysis(skill, userSkills) {
    const prerequisites = this._getPrerequisites(skill.skill_name, skill.category);
    const missing = prerequisites.filter(p => !userSkills.includes(p.toLowerCase()));
    return {
      prerequisites,
      missing_prerequisites: missing,
      estimated_learning_days: skill.learning_days_estimate,
      difficulty: skill.learning_days_estimate <= 14 ? 'Easy' : skill.learning_days_estimate <= 45 ? 'Medium' : 'Hard'
    };
  }

  static _generateLearningPath(skill) {
    const days = skill.learning_days_estimate;
    const weeks = Math.ceil(days / 7);
    const milestones = [];
    for (let week = 1; week <= weeks; week++) {
      milestones.push({
        week,
        focus: this._getWeekFocus(skill.skill_name, skill.category, week, weeks),
        deliverable: this._getWeekDeliverable(skill.skill_name, week, weeks),
        hours_per_week: week === weeks ? 20 : 15
      });
    }
    return {
      total_days: days,
      total_weeks: weeks,
      milestones,
      capstone_project: this._getCapstoneProject(skill.skill_name, skill.category),
      resources: this._getRecommendedResources(skill.skill_name)
    };
  }

  static _getPrerequisites(skillName, category) {
    const map = {
      'MLOps': ['Docker', 'Python', 'AWS'],
      'Kubernetes': ['Docker', 'Linux', 'Networking'],
      'Cloudflare Workers': ['JavaScript', 'Node.js', 'HTTP APIs'],
      'GraphQL': ['REST APIs', 'Node.js', 'Databases'],
      'System Design': ['Data Structures', 'Networking', 'Databases'],
      'Rust': ['C++ or C', 'Memory Management', 'Systems Programming'],
      'Prompt Engineering': ['Python', 'APIs', 'LLM Basics'],
      'Terraform': ['AWS', 'Infrastructure', 'YAML'],
      'AWS Lambda': ['Node.js', 'AWS', 'Event-driven architecture'],
      'Next.js': ['React', 'TypeScript', 'Node.js'],
      'PyTorch': ['Python', 'Linear Algebra', 'Calculus'],
      'Docker': ['Linux', 'Command Line', 'Networking']
    };
    return map[skillName] || ['Programming Fundamentals'];
  }

  static _getWeekFocus(skill, category, week, totalWeeks) {
    if (week === 1) return `Fundamentals of ${skill}`;
    if (week === totalWeeks) return `Production deployment & ${skill} integration`;
    if (week === 2) return `${skill} core patterns`;
    return `Advanced ${skill} & ${category} integration`;
  }

  static _getWeekDeliverable(skill, week, totalWeeks) {
    if (week === 1) return `Local ${skill} environment + hello world`;
    if (week === totalWeeks) return `End-to-end project deployed with monitoring`;
    return `${skill} module ${week} with tests`;
  }

  static _getCapstoneProject(skill, category) {
    const projects = {
      'MLOps': 'Deploy a fine-tuned LLM with auto-scaling on AWS/GCP',
      'Kubernetes': 'Build a multi-service mesh with auto-scaling and monitoring',
      'Cloudflare Workers': 'Global real-time collaboration app with <50ms latency',
      'GraphQL': 'Unified API gateway federating 3 microservices',
      'System Design': 'Design and prototype a URL shortener handling 1M RPS',
      'Rust': 'High-performance CLI tool with parallel processing',
      'Prompt Engineering': 'Automated prompt evaluation pipeline with A/B testing',
      'Terraform': 'Multi-environment infrastructure as code for a SaaS product',
      'AWS Lambda': 'Serverless event-driven data pipeline with 99.9% uptime',
      'Next.js': 'Full-stack SaaS with SSR, ISR, and edge deployment',
      'PyTorch': 'Computer vision model for real-time object detection',
      'Docker': 'Microservices orchestration with Compose and health checks'
    };
    return projects[skill] || `Production-grade ${skill} application`;
  }

  static _getRecommendedResources(skill) {
    return [
      { type: 'documentation', label: `${skill} Official Docs` },
      { type: 'course', label: `LINKUP ${skill} Intensive` },
      { type: 'project', label: 'GitHub Starter Template' },
      { type: 'community', label: `${skill} Discord/Reddit` }
    ];
  }

  static _estimateSalaryBump(skill) {
    return Math.round(skill.avg_salary_cents * 0.20);
  }

  static _calculateMarketConfidence(skill) {
    if (skill.demand_count >= 10000 && skill.demand_growth_yoy > 2.0) return 'VERY_HIGH';
    if (skill.demand_count >= 5000 && skill.demand_growth_yoy > 1.0) return 'HIGH';
    if (skill.demand_count >= 2000) return 'MEDIUM';
    return 'EMERGING';
  }

  static _categorizeDemand(growth) {
    if (growth >= 1.0) return 'hot';
    if (growth >= 0.2) return 'warm';
    if (growth >= 0) return 'stable';
    return 'cold';
  }
}

// Export singleton for salary matrix (backward compat), static methods for skill radar
const instance = new ArbitrageService();
Object.assign(instance, ArbitrageService); // Merge static methods onto instance
module.exports = instance;