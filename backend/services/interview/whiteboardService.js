// whiteboardService.js — v1.0 PRODUCTION
// Rule-based canvas analysis. No AI for facts.

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class WhiteboardService {
  /**
   * Analyze whiteboard JSON from React Flow / Canvas
   */
  async analyze(whiteboardData, interviewType = 'system_design') {
    try {
      // Fetch rules for this interview type
      const { data: rules, error } = await supabase
        .from('whiteboard_rules')
        .select('*')
        .eq('interview_type', interviewType);
      
      if (error) throw error;
      
      const components = this._extractComponents(whiteboardData);
      const connections = this._extractConnections(whiteboardData);
      
      const violations = [];
      let score = 100;
      
      for (const rule of (rules || [])) {
        const result = this._evaluateRule(rule, components, connections, whiteboardData);
        
        if (result.violated) {
          violations.push({
            rule: rule.rule_name,
            type: rule.rule_type,
            severity: rule.severity,
            message: rule.feedback_message,
            points: rule.points
          });
          score -= rule.points;
        }
      }
      
      // Bonus points for good practices
      const bonuses = this._checkBonuses(components, connections);
      
      return {
        score: Math.max(0, score + bonuses),
        maxScore: 100,
        grade: this._grade(score + bonuses),
        components: {
          count: components.length,
          list: components.map(c => c.name || c.type || 'Unknown')
        },
        connections: {
          count: connections.length,
          hasBidirectional: connections.some(c => c.bidirectional)
        },
        violations,
        bonuses,
        antiPatterns: violations.filter(v => v.type === 'anti_pattern'),
        missingComponents: violations.filter(v => v.type === 'missing_component'),
        strengths: this._identifyStrengths(components, connections)
      };
    } catch (error) {
      console.error('[WhiteboardService.analyze] Fatal:', error.message);
      return {
        score: 0,
        grade: 'error',
        error: error.message,
        components: { count: 0, list: [] },
        violations: []
      };
    }
  }

  // ─── Internal ───
  _extractComponents(data) {
    if (!data || !data.nodes) return [];
    return data.nodes.map(n => ({
      id: n.id,
      name: n.data?.label || n.data?.name || n.type,
      type: n.type || 'unknown',
      replicas: n.data?.replicas || 1,
      hasFailover: n.data?.hasFailover || false
    }));
  }

  _extractConnections(data) {
    if (!data || !data.edges) return [];
    return data.edges.map(e => ({
      source: e.source,
      target: e.target,
      bidirectional: e.data?.bidirectional || false,
      type: e.type || 'default'
    }));
  }

  _evaluateRule(rule, components, connections, rawData) {
    const componentNames = components.map(c => (c.name || '').toLowerCase());
    const componentTypes = components.map(c => (c.type || '').toLowerCase());
    
    switch (rule.rule_name) {
      case 'missing_load_balancer':
        return { violated: !componentNames.some(n => n.includes('load') || n.includes('balancer') || n.includes('gateway')) };
      
      case 'missing_cache':
        return { violated: !componentNames.some(n => n.includes('cache') || n.includes('redis') || n.includes('memcached')) };
      
      case 'missing_cdn':
        return { violated: !componentNames.some(n => n.includes('cdn') || n.includes('cloudfront') || n.includes('cloudflare')) };
      
      case 'single_database':
        const dbCount = componentNames.filter(n => n.includes('database') || n.includes('db') || n.includes('postgres') || n.includes('mysql')).length;
        return { violated: dbCount === 1 };
      
      case 'no_replication':
        const hasReplicas = components.some(c => (c.replicas || 1) > 1 || c.hasFailover);
        return { violated: !hasReplicas };
      
      case 'no_rate_limiter':
        return { violated: !componentNames.some(n => n.includes('rate') || n.includes('throttle')) };
      
      case 'no_monitoring':
        return { violated: !componentNames.some(n => n.includes('monitor') || n.includes('observ') || n.includes('log') || n.includes('trace')) };
      
      default:
        return { violated: false };
    }
  }

  _checkBonuses(components, connections) {
    let bonus = 0;
    const names = components.map(c => (c.name || '').toLowerCase());
    
    // Bonus: Multiple regions
    if (names.some(n => n.includes('region') || n.includes('zone') || n.includes('az'))) bonus += 5;
    
    // Bonus: Security layer
    if (names.some(n => n.includes('auth') || n.includes('firewall') || n.includes('waf') || n.includes('ssl'))) bonus += 5;
    
    // Bonus: Data pipeline
    if (names.some(n => n.includes('queue') || n.includes('stream') || n.includes('kafka') || n.includes('pub'))) bonus += 5;
    
    return bonus;
  }

  _grade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  _identifyStrengths(components, connections) {
    const names = components.map(c => (c.name || '').toLowerCase());
    const strengths = [];
    
    if (names.some(n => n.includes('cache'))) strengths.push('Caching strategy present');
    if (names.some(n => n.includes('queue') || n.includes('async'))) strengths.push('Async processing considered');
    if (connections.length > components.length) strengths.push('Well-connected architecture');
    if (components.length >= 6) strengths.push('Comprehensive component coverage');
    
    return strengths;
  }
}

module.exports = new WhiteboardService();