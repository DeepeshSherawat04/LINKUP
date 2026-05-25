// linkedinConfig.js — v1.0 PRODUCTION
// PKCE OAuth 2.0 flow for LinkedIn
// NEVER stores access tokens in DB — only encrypted session cookies

const crypto = require('crypto');

const LINKEDIN_CONFIG = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/linkedin/callback',
  scopes: ['openid', 'profile', 'email', 'w_member_social', 'r_basicprofile', 'r_network'],
  
  // Endpoints
  authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  profileUrl: 'https://api.linkedin.com/v2/me',
  emailUrl: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
  connectionsUrl: 'https://api.linkedin.com/v2/connections',
  
  // Production safety
  maxRetries: 2,
  timeout: 15000
};

// PKCE generator
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

// State token for CSRF protection
function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  config: LINKEDIN_CONFIG,
  generatePKCE,
  generateState,
  
  // Validation
  isConfigured() {
    return !!(LINKEDIN_CONFIG.clientId && LINKEDIN_CONFIG.clientSecret);
  }
};