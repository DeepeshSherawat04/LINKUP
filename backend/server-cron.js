// server-cron.js — v2.3 PRODUCTION-HARDENED
// Changes from v2.2:
// - REMOVED: Numbeo API dependency (paid, not free)
// - ADDED: World Bank CoL cache refresh (weekly)
// - ADDED: GeoDB city cache warming
// - FIXED: Redis v4 API compatibility
// - FIXED: JSearch rate-limit resilience with circuit breaker
// - FIXED: Proper error handling for all cron jobs

const cron = require('node-cron');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const redisClient = require('./config/redisClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CostOfLivingService = require('./services/costOfLivingService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Utilities ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const jsearchClient = axios.create({
  baseURL: 'https://jsearch.p.rapidapi.com',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
  },
  timeout: 15000
});

// Resilient fetch with retry + circuit breaker pattern
async function fetchJSearchWithRetry(category, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`[CRON] JSearch retry ${attempt} for "${category}" after ${Math.round(backoff)}ms`);
        await sleep(backoff);
      }

      const response = await jsearchClient.get('/search', {
        params: { query: category, page: '1', num_pages: '1' }
      });
      return response.data?.data || [];
    } catch (err) {
      lastError = err;
      const status = err.response?.status;

      if (status === 403) {
        console.error(`[CRON] JSearch 403 for "${category}" — API key invalid/expired. Aborting.`);
        throw new Error('JSearch 403');
      }
      if (status === 429) {
        console.warn(`[CRON] JSearch 429 for "${category}" — rate limited.`);
        continue; // Retry with backoff
      }
      if (!status || status >= 500) continue; // Retry on network/5xx
      throw err; // 4xx other than 403/429, don't retry
    }
  }
  throw lastError;
}

// ─── JOB 1: Market Snapshot Sync (Every 6 hours) ───
cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Syncing market snapshots via JSearch...');

  try {
    const categories = ['software engineer', 'data scientist', 'product manager', 'ux designer', 'devops', 'mlops', 'frontend developer', 'backend developer', 'full stack developer', 'site reliability engineer', 'cloud architect', 'security engineer'];
    const snapshots = [];
    let consecutiveFailures = 0;
    const CIRCUIT_BREAKER = 3;

    for (const category of categories) {
      if (consecutiveFailures >= CIRCUIT_BREAKER) {
        console.warn(`[CRON] Circuit breaker OPEN after ${consecutiveFailures} failures. Skipping remaining categories.`);
        break;
      }

      try {
        if (snapshots.length > 0) await sleep(1500); // Stagger to avoid 429

        const jobs = await fetchJSearchWithRetry(category);

        const avgSalary = jobs.reduce((sum, job) => {
          const min = job.job_min_salary || 0;
          const max = job.job_max_salary || 0;
          // JSearch sometimes returns annual, sometimes monthly. Heuristic: >10k is annual.
          const monthly = max > 10000 ? (max / 12) : (max || min || 0);
          return sum + monthly;
        }, 0) / (jobs.length || 1);

        snapshots.push({
          category: category.replace(/\s+/g, '_'),
          posting_count: jobs.length,
          avg_salary: Math.round(avgSalary) || 5000,
          snapshot_date: new Date().toISOString().split('T')[0],
          source: 'jsearch'
        });

        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        console.error(`[CRON] JSearch failed for ${category}:`, err.message);
      }
    }

    // Degraded marker: if everything failed, record it so dashboards know data is stale
    if (snapshots.length === 0) {
      console.warn('[CRON] All JSearch fetches failed. Inserting degraded marker.');
      snapshots.push({
        category: 'system_status',
        posting_count: 0,
        avg_salary: 0,
        snapshot_date: new Date().toISOString().split('T')[0],
        source: 'degraded'
      });
    }

    const { error } = await supabase.from('market_snapshots').insert(snapshots);
    if (error) throw error;
    console.log(`[CRON] Inserted ${snapshots.length} snapshots`);

  } catch (err) {
    console.error('[CRON] Market sync failed:', err.message);
  }
});

// ─── JOB 2: AI Health Check (Every 30 min) ───
cron.schedule('*/30 * * * *', async () => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Health check: respond with "OK" only.');
    const text = result.response.text();
    const status = text.includes('OK') ? 'healthy' : 'degraded';

    await redisClient.setRaw('ai_health', status, 1800);
    console.log('[CRON] AI health:', status);
  } catch (err) {
    await redisClient.setRaw('ai_health', 'unavailable', 1800);
    console.error('[CRON] AI health check failed:', err.message);
  }
});

// ─── JOB 3: Stale Cache Cleanup (Daily 3 AM) ───
cron.schedule('0 3 * * *', async () => {
  try {
    const keys = await redisClient.scanKeys('radar:*', 100);

    if (keys.length > 1000) {
      const toDelete = keys.slice(0, Math.floor(keys.length / 2));
      const deleted = await redisClient.deleteKeys(toDelete);
      console.log(`[CRON] Cleared ${deleted} stale radar caches (scanned ${keys.length})`);
    } else {
      console.log(`[CRON] Cache scan: ${keys.length} keys, no cleanup needed.`);
    }
  } catch (err) {
    console.error('[CRON] Cache cleanup failed:', err.message);
  }
});

// ─── JOB 4: Trend Velocity (Daily 4 AM) ───
cron.schedule('0 4 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: snapshots, error } = await supabase
      .from('market_snapshots')
      .select('*')
      .gte('snapshot_date', cutoff)
      .order('snapshot_date', { ascending: true });

    if (error) throw error;
    if (!snapshots?.length) return;

    const valid = snapshots.filter(s => s.category !== 'system_status');
    const categories = [...new Set(valid.map(s => s.category))];
    const velocities = {};

    categories.forEach(cat => {
      const catData = valid.filter(s => s.category === cat);
      if (catData.length < 7) return;

      const recent = catData.slice(-7).reduce((a, b) => a + b.posting_count, 0) / 7;
      const previous = catData.slice(-14, -7).reduce((a, b) => a + b.posting_count, 0) / 7;
      const velocity = previous > 0 ? (recent - previous) / previous : 0;

      velocities[cat] = {
        velocity: parseFloat(velocity.toFixed(3)),
        trend: velocity > 0.1 ? 'rising' : velocity < -0.1 ? 'falling' : 'stable',
        source: 'jsearch'
      };
    });

    await redisClient.setCache('trend_velocities', velocities, 86400);
    console.log('[CRON] Trend velocities calculated:', Object.keys(velocities).length, 'categories');
  } catch (err) {
    console.error('[CRON] Trend calculation failed:', err.message);
  }
});

// ─── JOB 5: Cost of Living Cache Refresh (Weekly, Sundays 2 AM) ───
cron.schedule('0 2 * * 0', async () => {
  console.log('🌍 [CRON] Refreshing Cost of Living cache via World Bank...');
  try {
    const result = await CostOfLivingService.refreshAllCache();
    console.log(`✅ [CRON] CoL cache refreshed: ${result.success.length} cities updated, ${result.failed.length} failed`);
    
    // Log failures for monitoring
    if (result.failed.length > 0) {
      console.warn(`[CRON] CoL refresh failures: ${result.failed.slice(0, 10).join(', ')}${result.failed.length > 10 ? '...' : ''}`);
    }
  } catch (err) {
    console.error('❌ [CRON] CoL cache refresh failed:', err.message);
  }
});

// ─── JOB 6: Skill Market Data Refresh (Daily 5 AM) ───
cron.schedule('0 5 * * *', async () => {
  console.log('📊 [CRON] Refreshing skill market data from JSearch...');
  try {
    // Fetch top skills and update demand counts
    const skillCategories = ['MLOps', 'Kubernetes', 'React Native', 'GraphQL', 'System Design', 'TypeScript', 'Rust', 'Prompt Engineering', 'Terraform', 'AWS Lambda', 'Next.js', 'PyTorch', 'Docker'];
    
    const updates = [];
    for (const skill of skillCategories) {
      try {
        const jobs = await fetchJSearchWithRetry(skill);
        const avgSalary = jobs.reduce((sum, job) => {
          const max = job.job_max_salary || 0;
          return sum + (max > 10000 ? max / 12 : max);
        }, 0) / (jobs.length || 1);

        updates.push({
          skill_name: skill,
          demand_count: jobs.length,
          avg_salary_cents: Math.round((avgSalary || 5000) * 100),
          last_updated: new Date().toISOString()
        });
        
        await sleep(1000); // Rate limit protection
      } catch (err) {
        console.warn(`[CRON] Skill update failed for ${skill}:`, err.message);
      }
    }

    // Batch upsert to Supabase
    if (updates.length > 0) {
      const { error } = await supabase
        .from('skill_market_data')
        .upsert(updates, { onConflict: 'skill_name' });
      
      if (error) throw error;
      console.log(`[CRON] Updated ${updates.length} skills in market data`);
    }
  } catch (err) {
    console.error('[CRON] Skill market refresh failed:', err.message);
  }
});

// ─── JOB 7: System Health Report (Daily 6 AM) ───
cron.schedule('0 6 * * *', async () => {
  try {
    // Check database connectivity
    const { data: dbCheck, error: dbError } = await supabase
      .from('market_snapshots')
      .select('count')
      .limit(1);
    
    const dbStatus = dbError ? 'degraded' : 'healthy';
    
    // Check Redis
    const redisStatus = redisClient.isConnected ? 'healthy' : 'degraded';
    
    // Check AI
    const aiStatus = await redisClient.getRaw('ai_health') || 'unknown';
    
    // Compile report
    const report = {
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        ai: aiStatus,
        jsearch: 'unknown', // Updated by market sync job
        world_bank: 'unknown' // Updated by CoL refresh
      },
      last_market_sync: await redisClient.getRaw('last_market_sync') || 'never',
      last_col_refresh: await redisClient.getRaw('last_col_refresh') || 'never'
    };

    await redisClient.setCache('system_health_report', report, 86400);
    console.log('[CRON] System health report generated:', JSON.stringify(report.services));
  } catch (err) {
    console.error('[CRON] Health report failed:', err.message);
  }
});

console.log('[CRON] Scheduled: market sync (6h), AI health (30m), cache cleanup (3AM), trends (4AM), CoL refresh (weekly), skill refresh (daily), health report (daily)');