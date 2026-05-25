// networkGraphService.js — v1.0 PRODUCTION
// Builds anonymized graph, runs BFS via RPC, scores bridges

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const redisClient = require('../../config/redisClient');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Anonymize LinkedIn ID (one-way hash)
function hashLinkedInId(linkedInId, salt = process.env.NODE_ENV) {
  return crypto.createHmac('sha256', process.env.LINKEDIN_HASH_SECRET || 'linkup-default-salt')
    .update(`${linkedInId}:${salt}`)
    .digest('hex')
    .substring(0, 16);
}

class NetworkGraphService {
  /**
   * Import connections from LinkedIn (or manual CSV)
   */
  async importConnections(userId, connections, source = 'linkedin_api') {
    const nodes = [];
    const edges = [];
    const userHash = hashLinkedInId(userId); // Self-representing hash

    // Ensure user node exists
    const { data: existingUser } = await supabase
      .from('network_nodes')
      .select('node_hash')
      .eq('user_id', userId)
      .limit(1);

    const userNodeHash = existingUser?.[0]?.node_hash || userHash;

    if (!existingUser?.length) {
      // Create user node
      await supabase.from('network_nodes').insert({
        user_id: userId,
        node_hash: userNodeHash,
        display_name: 'You',
        network_score: 100
      });
    }

    for (const conn of connections) {
      const connHash = hashLinkedInId(conn.id || conn.linkedinId || conn.email);
      
      nodes.push({
        user_id: userId,
        node_hash: connHash,
        display_name: conn.firstName && conn.lastName ? `${conn.firstName} ${conn.lastName}` : conn.name,
        headline: conn.headline,
        industry: conn.industry,
        location: conn.location,
        profile_url: conn.profileUrl,
        current_company: conn.company,
        current_title: conn.title,
        company_start_date: conn.companyStartDate,
        is_recent_hire: conn.isRecentHire || false,
        skills: conn.skills || [],
        groups: conn.groups || [],
        posts_per_week: conn.postsPerWeek || 0,
        network_score: this._calculateBaseScore(conn)
      });

      edges.push({
        source_hash: userNodeHash,
        target_hash: connHash,
        connection_strength: conn.strength || 0.5,
        shared_connections_count: conn.sharedConnections || 0
      });
    }

    // Upsert nodes (ignore conflicts)
    if (nodes.length > 0) {
      const { error: nodeErr } = await supabase
        .from('network_nodes')
        .upsert(nodes, { onConflict: 'node_hash', ignoreDuplicates: true });
      if (nodeErr) console.error('[NetworkGraphService] Node upsert error:', nodeErr.message);
    }

    // Upsert edges
    if (edges.length > 0) {
      const { error: edgeErr } = await supabase
        .from('network_edges')
        .upsert(edges, { onConflict: 'source_hash,target_hash', ignoreDuplicates: true });
      if (edgeErr) console.error('[NetworkGraphService] Edge upsert error:', edgeErr.message);
    }

    return { imported: nodes.length, source };
  }

  /**
   * Manual CSV import (when LinkedIn API is restricted)
   */
  async importFromCSV(userId, csvData) {
    // CSV expected: name,title,company,linkedin_url,email
    const connections = csvData.map(row => ({
      id: row.email || row.linkedin_url, // Use as stable ID
      name: row.name,
      title: row.title,
      company: row.company,
      profileUrl: row.linkedin_url,
      skills: row.skills ? row.skills.split(',').map(s => s.trim()) : [],
      isRecentHire: false // Unknown from CSV
    }));

    return this.importConnections(userId, connections, 'csv_import');
  }

  /**
   * Find paths to target company via BFS RPC
   */
  async findPaths(userId, targetCompany, maxDepth = 3) {
    try {
      const cacheKey = `paths:${userId}:${targetCompany.toLowerCase().replace(/\s+/g, '_')}`;
      let cached = await redisClient.getCache(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase.rpc('find_referral_paths', {
        p_user_id: userId,
        p_target_company: targetCompany,
        p_max_depth: maxDepth
      });

      if (error) throw error;

      const enriched = await this._enrichPaths(data || []);
      
      // Cache for 10 minutes
      await redisClient.setCache(cacheKey, enriched, 600);
      
      return enriched;
    } catch (error) {
      console.error('[NetworkGraphService.findPaths] Fatal:', error.message);
      return [];
    }
  }

  /**
   * Score the best bridge in a path
   */
  async scoreBridge(bridgeHash, userId, targetCompany) {
    try {
      const { data, error } = await supabase.rpc('score_bridge', {
        p_bridge_hash: bridgeHash,
        p_user_id: userId,
        p_target_company: targetCompany
      });

      if (error) throw error;
      return data || { score: 0, likelihood: 0, reasons: [] };
    } catch (error) {
      console.error('[NetworkGraphService.scoreBridge] Fatal:', error.message);
      return { score: 0, likelihood: 0, reasons: [] };
    }
  }

  /**
   * Get user's referral targets
   */
  async getTargets(userId) {
    const { data, error } = await supabase
      .from('referral_targets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true });

    if (error) {
      console.error('[NetworkGraphService.getTargets] Fatal:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Add referral target
   */
  async addTarget(userId, companyName, roleTitle, priority = 1) {
    const { data, error } = await supabase
      .from('referral_targets')
      .insert({ user_id: userId, company_name: companyName, role_title: roleTitle, priority })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Log referral outcome
   */
  async logOutcome(userId, targetCompany, bridgeHash, message, outcome = 'pending') {
    const { data, error } = await supabase
      .from('referral_outcomes')
      .insert({
        user_id: userId,
        target_company: targetCompany,
        bridge_node_hash: bridgeHash,
        message_sent: message,
        outcome
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Internal ───
  _calculateBaseScore(conn) {
    let score = 50; // Base
    
    if (conn.isRecentHire) score += 20;
    if (conn.postsPerWeek >= 2) score += 15;
    if (conn.title?.toLowerCase().includes('senior')) score += 10;
    if (conn.title?.toLowerCase().includes('staff')) score += 15;
    if (conn.title?.toLowerCase().includes('manager')) score += 10;
    
    return Math.min(score, 100);
  }

  async _enrichPaths(paths) {
    // Add bridge scoring to each path
    for (const path of paths) {
      if (path.path && path.path.length >= 2) {
        const bridge = path.path[path.path.length - 2]; // Person before target
        const score = await this.scoreBridge(bridge.hash, path.path[0].hash, path.path[path.path.length - 1].company);
        path.bridgeScore = score;
        path.bestBridge = bridge;
      }
    }
    
    // Sort by bridge score then path score
    return paths.sort((a, b) => {
      const scoreDiff = (b.bridgeScore?.score || 0) - (a.bridgeScore?.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a.depth - b.depth; // Prefer shorter paths
    });
  }
}

module.exports = new NetworkGraphService();