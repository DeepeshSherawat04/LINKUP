// geminiClient.js - Initializes and exports the Gemini API client for AI interactions
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

console.log('🔑 Gemini API Key present:', apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO');

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

module.exports = genAI;