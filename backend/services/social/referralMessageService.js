// referralMessageService.js — v1.0 PRODUCTION
// Gemini ONLY drafts text. All facts come from the graph service.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const redisClient = require('../../config/redisClient');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt: strict guardrails
const SYSTEM_PROMPT = `You are a referral message assistant for LINKUP, a career platform.
Rules:
1. ONLY use facts provided in the context. Never invent companies, roles, or mutual interests.
2. Keep messages under 150 words.
3. Be conversational, not salesy.
4. Always include a specific ask ("Would you be open to a quick chat?").
5. Never claim false urgency.
6. If no mutual interests exist, focus on genuine curiosity about their work.`;

class ReferralMessageService {
  async draftMessage(context, tone = 'professional') {
    const { 
      userName, 
      bridgeName, 
      bridgeTitle, 
      bridgeCompany,
      targetCompany,
      targetRole,
      mutualInterests,
      sharedGroup,
      bridgeRecentPost,
      userProject
    } = context;

    // Cache key based on context hash
    const cacheKey = `msg:${this._hashContext(context)}`;
    const cached = await redisClient.getCache(cacheKey);
    if (cached) return cached;

    const toneInstructions = {
      professional: 'Formal but warm. Use full sentences.',
      casual: 'Conversational. Use contractions. Light humor if appropriate.',
      direct: 'Get to the point in 2 sentences. Respect their time.'
    };

    const prompt = `${SYSTEM_PROMPT}

Context:
- Sender: ${userName || 'A student'}
- Recipient: ${bridgeName}, ${bridgeTitle} at ${bridgeCompany}
- Target: ${targetRole || 'a role'} at ${targetCompany}
- Mutual interests: ${mutualInterests?.join(', ') || 'None identified'}
${sharedGroup ? `- Shared group: ${sharedGroup}` : ''}
${bridgeRecentPost ? `- Recipient recently posted about: ${bridgeRecentPost}` : ''}
${userProject ? `- Sender is building: ${userProject}` : ''}

Tone: ${toneInstructions[tone] || toneInstructions.professional}

Draft a LinkedIn connection request message.`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
      });
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const message = {
        text,
        tone,
        generatedAt: new Date().toISOString(),
        disclaimer: 'AI-generated draft. Review before sending.',
        contextUsed: {
          bridgeName: !!bridgeName,
          mutualInterests: mutualInterests?.length || 0,
          sharedGroup: !!sharedGroup
        }
      };

      await redisClient.setCache(cacheKey, message, 3600); // 1 hour cache
      return message;
    } catch (error) {
      console.error('[ReferralMessageService] Generation failed:', error.message);
      
      // Graceful fallback: template-based
      return this._fallbackTemplate(context);
    }
  }

  _fallbackTemplate(context) {
    const { bridgeName, targetCompany, mutualInterests, userProject } = context;
    
    let text = `Hi ${bridgeName || 'there'},`;
    
    if (mutualInterests?.length > 0) {
      text += `\n\nI noticed we both work with ${mutualInterests[0]}. `;
    }
    
    if (userProject) {
      text += `I'm currently building ${userProject} and would love your perspective. `;
    }
    
    text += `I saw ${targetCompany} is hiring and would greatly appreciate a brief chat about your experience there. Would you be open to 15 minutes this week?`;
    
    return {
      text,
      tone: 'professional',
      generatedAt: new Date().toISOString(),
      disclaimer: 'Template fallback (AI generation failed). Please personalize.',
      contextUsed: { fallback: true }
    };
  }

  _hashContext(context) {
    const str = JSON.stringify(context);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

module.exports = new ReferralMessageService();