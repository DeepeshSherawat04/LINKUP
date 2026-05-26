const rateLimit = require('express-rate-limit');

let redisStore = null;

// Production-safe: never crash if rate-limit-redis is missing or Redis is down
try {
  const RedisStore = require('rate-limit-redis');
  const { client } = require('../config/redisClient');

  if (client && typeof client.isOpen === 'boolean' && client.isOpen) {
    redisStore = new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
    });
    console.log('✅ Redis rate limit store active');
  } else {
    console.warn('⚠️  Redis client not open. Using memory store for rate limiting.');
  }
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.warn('⚠️  rate-limit-redis not installed. Using memory store for rate limiting.');
  } else {
    console.error('❌ Redis rate limit store failed:', err.message, '| Using memory store.');
  }
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore || undefined, // undefined = built-in memory store
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore || undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'AI quota exceeded. Try again in 1 hour.',
    });
  },
});

module.exports = { apiLimiter, aiLimiter };