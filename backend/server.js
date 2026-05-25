// server.js — v2.1 SINGULARITY EDITION
// Added: server-cron for automated market sync, AI health checks, cache cleanup
// Added: WebSocket support for real-time interview streaming
// Added: Income Protection Simulator + Skill Arbitrage Radar routes

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { setupInterviewSocket } = require('./websocket/interviewSocket');

// ─── CRON JOBS (must be after dotenv, before routes) ───
require('./server-cron');

const { connectRedis } = require('./config/redisClient');
const errorHandler = require('./middleware/errorHandler');

// ─── ROUTE IMPORTS ───
const profileRoutes = require('./routes/profileRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const executionRoutes = require('./routes/executionRoutes');
const ghostedJobRoutes = require('./routes/ghostedJobRoutes');
const referralRoutes = require('./routes/referralRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const arbitrageRoutes = require('./routes/arbitrageRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── REDIS ───
connectRedis().catch(() => console.log('⚠️  Redis optional — running without cache'));

// ─── ROUTES ───
app.use('/api/profile', profileRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/ghosted-jobs', ghostedJobRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/arbitrage', arbitrageRoutes);

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'linkup-server', 
    version: '2.1',
    timestamp: new Date().toISOString(),
    features: [
      'smart-scoring',
      'skill-match',
      'income-probability', 
      'ai-explanations',
      'redis-cache',
      'auth-required-radar',
      'explainable-paths',
      'career-singularity-index',
      'temporal-prediction',
      'anti-fragile-index',
      'skill-arbitrage-matrix',
      'career-twin-agent',
      'career-race-protocol',
      'websocket-interview',
      'income-protection-simulator',   // NEW
      'skill-arbitrage-radar'          // NEW
    ]
  });
});

// ─── ERROR HANDLING (MUST BE LAST — only once!) ───
app.use(errorHandler);

// ─── WEBSOCKET SETUP ───
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

setupInterviewSocket(io);

// ─── START SERVER ───
httpServer.listen(PORT, () => {
  console.log(`🔗 LINKUP server v2.1 running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket active on /interview`);
  console.log(`📊 Cron jobs active: market sync (6h), AI health (30m), cache cleanup (3AM), trends (4AM), col-refresh (weekly)`);
});