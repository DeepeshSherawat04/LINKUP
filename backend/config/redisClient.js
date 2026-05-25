// backend/config/redisClient.js
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  },
  disableOfflineQueue: true // 🔥 CRITICAL: reject immediately when disconnected
});

client.on('error', (err) => {
  console.warn('Redis error:', err.message);
});

client.on('connect', () => console.log('Redis client connected'));
client.on('ready', () => console.log('Redis ready'));
client.on('end', () => console.log('Redis connection closed'));

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
    if (!client.isReady) return false; // 🔥 was isOpen
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) { 
    console.warn('Redis setCache error:', err.message);
    return false; 
  }
}

async function getCache(key) {
  try {
    if (!client.isReady) return null; // 🔥 was isOpen
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) { 
    console.warn('Redis getCache error:', err.message);
    return null; 
  }
}

async function deleteCache(key) {
  try {
    if (!client.isReady) return false; // 🔥 was isOpen
    await client.del(key);
    return true;
  } catch (err) { 
    console.warn('Redis deleteCache error:', err.message);
    return false; 
  }
}

async function setRaw(key, value, ttlSeconds = 3600) {
  try {
    if (!client.isReady) return false; // 🔥 was isOpen
    await client.setEx(key, ttlSeconds, String(value));
    return true;
  } catch (err) { 
    console.warn('Redis setRaw error:', err.message);
    return false; 
  }
}

async function getRaw(key) {
  try {
    if (!client.isReady) return null; // 🔥 was isOpen
    return await client.get(key);
  } catch (err) { 
    console.warn('Redis getRaw error:', err.message);
    return null; 
  }
}

async function scanKeys(pattern, countPerBatch = 100) {
  const keys = [];
  try {
    if (!client.isReady) return keys; // 🔥 was isOpen
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: countPerBatch })) {
      keys.push(key);
    }
  } catch (err) {
    console.warn('Redis scan error:', err.message);
  }
  return keys;
}

async function deleteKeys(keys) {
  try {
    if (!client.isReady || !keys?.length) return 0; // 🔥 was isOpen
    const result = await client.del(keys);
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