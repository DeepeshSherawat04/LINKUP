// linkedinService.js — v1.1 PRODUCTION
// Primary: CSV import. OAuth available but optional.

const axios = require('axios');
const crypto = require('crypto');
const redisClient = require('../../config/redisClient');

// PKCE generator (kept for future OAuth use)
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

class LinkedInService {
  isConfigured() {
    return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  // ─── OAuth: Only if env vars are set ───
  getAuthUrl() {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn OAuth not configured. Use CSV import instead.');
    }

    const pkce = generatePKCE();
    const state = generateState();
    redisClient.setCache(`linkedin_pkce:${state}`, pkce.verifier, 600);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      state,
      scope: 'openid profile email w_member_social r_basicprofile',
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method
    });

    return { url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`, state };
  }

  async exchangeCode(code, state) {
    const verifier = await redisClient.getCache(`linkedin_pkce:${state}`);
    if (!verifier) throw new Error('Invalid or expired OAuth state');
    await redisClient.deleteCache(`linkedin_pkce:${state}`);

    const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        code_verifier: verifier
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token
    };
  }

  // ─── CSV Validation ───
  validateCSV(rows) {
    const required = ['first name', 'last name', 'email address', 'company', 'position'];
    const headers = Object.keys(rows[0] || {}).map(h => h.toLowerCase().trim());
    
    const missing = required.filter(r => !headers.some(h => h.includes(r)));
    if (missing.length > 0) {
      throw new Error(`CSV missing columns: ${missing.join(', ')}. Expected: First Name, Last Name, Email Address, Company, Position`);
    }

    return rows.map(row => {
      const get = (key) => {
        const k = Object.keys(row).find(h => h.toLowerCase().includes(key));
        return k ? row[k]?.trim() : '';
      };

      return {
        id: get('email address') || `${get('first name')}.${get('last name')}@placeholder.com`,
        firstName: get('first name'),
        lastName: get('last name'),
        name: `${get('first name')} ${get('last name')}`.trim(),
        email: get('email address'),
        company: get('company'),
        title: get('position'),
        headline: get('position'),
        industry: '',
        location: '',
        profileUrl: '',
        skills: [],
        isRecentHire: false,
        strength: 0.6
      };
    }).filter(r => r.firstName && r.company);
  }
}

module.exports = new LinkedInService();