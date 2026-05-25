const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => {
  // Silent fail in production — never crash the server because Redis hiccuped
  console.warn('Redis error:', err.message);
});

async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
      console.log('✅ Redis connected');
    }
  } catch (err) {
    console.warn('⚠️ Redis not connected. Caching disabled.');
  }
}

// ─── Safe wrappers ───
async function setCache(key, value, ttlSeconds = 3600) {
  try {
    if (!client.isOpen) return false;
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) { return false; }
}

async function getCache(key) {
  try {
    if (!client.isOpen) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) { return null; }
}

async function deleteCache(key) {
  try {
    if (!client.isOpen) return false;
    await client.del(key);
    return true;
  } catch (err) { return false; }
}

// Raw string storage — no JSON wrapping (for simple status strings)
async function setRaw(key, value, ttlSeconds = 3600) {
  try {
    if (!client.isOpen) return false;
    await client.setEx(key, ttlSeconds, String(value));
    return true;
  } catch (err) { return false; }
}

async function getRaw(key) {
  try {
    if (!client.isOpen) return null;
    return await client.get(key);
  } catch (err) { return null; }
}

// Production-safe SCAN iterator (O(1) per batch, never blocks Redis)
async function scanKeys(pattern, countPerBatch = 100) {
  const keys = [];
  try {
    if (!client.isOpen) return keys;
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: countPerBatch })) {
      keys.push(key);
    }
  } catch (err) {
    console.warn('Redis scan error:', err.message);
  }
  return keys;
}

// Batch delete with safety limit
async function deleteKeys(keys) {
  try {
    if (!client.isOpen || !keys?.length) return 0;
    const result = await client.del(keys); // v4 accepts array
    return result || 0;
  } catch (err) {
    console.warn('Redis delete error:', err.message);
    return 0;
  }
}

module.exports = {
  client,
  connectRedis,
  setCache,
  getCache,
  deleteCache,
  setRaw,
  getRaw,
  scanKeys,
  deleteKeys
};