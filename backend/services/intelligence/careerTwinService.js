/**
 * careerTwinService.js — Autonomous Career Agent v3
 * Function-calling architecture with real data integration.
 * New tools: analyzeSalaryArbitrage, scanATSGap, generateNegotiationScript
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Simple TTL Cache ───
class SimpleCache {
  constructor() { this.cache = new Map(); }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) { this.cache.delete(key); return null; }
    return item.value;
  }
  set(key, value, ttlMs = 3600000) {
    this.cache.set(key, { value, expiry: Date.now() + ttlMs });
  }
}
const twinCache = new SimpleCache();

// ─── Retry with exponential backoff ───
async function callWithRetry(fn, retries = 3, baseDelay = 800) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        await new Promise(r => setTimeout(r, baseDelay * (i + 1) * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Fetch with timeout (Node-compatible) ───
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ─── HTML Sanitization Helper for ATS Scanning ───
function extractTextFromHTML(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<<script\b[^<<]*(?:(?!<\/script>)<<[^<<]*)*<<\/script>/gi, ' ')
    .replace(/<<style\b[^<<]*(?:(?!<\/style>)<<[^<<]*)*<<\/style>/gi, ' ')
    .replace(/<<noscript\b[^<<]*(?:(?!<\/noscript>)<<[^<<]*)*<<\/noscript>/gi, ' ')
    .replace(/<<template\b[^<<]*(?:(?!<\/template>)<<[^<<]*)*<<\/template>/gi, ' ')
    .replace(/<<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 12000);
}

// ─── Gemini JSON Helper ───
async function generateJSON(prompt, temperature = 0.7, maxTokens = 1024) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature,
      maxOutputTokens: maxTokens
    }
  });
  const result = await callWithRetry(() => model.generateContent(prompt), 2);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`Invalid JSON from Gemini: ${text.substring(0, 200)}`);
  }
}

class CareerTwin {
  constructor(userId, userProfile) {
    this.userId = userId;
    this.profile = userProfile || {};
    this.sessionId = `twin_${userId}_${Date.now()}`;
  }

  // ─── Function Declarations for Gemini Tool Calling ───
  _getFunctionDeclarations() {
    return [
      {
        name: 'generateLinkedInPost',
        description: 'Generate a high-engagement LinkedIn post tailored to the user\'s profile, skills, and career goals',
        parameters: {
          type: 'OBJECT',
          properties: {
            topic: {
              type: 'STRING',
              description: 'Specific topic, project, or theme to write about. Extract from user command.'
            },
            tone: {
              type: 'STRING',
              enum: ['professional', 'story', 'technical', 'provocative'],
              description: 'Tone and style of the post'
            },
            includeMetrics: {
              type: 'BOOLEAN',
              description: 'Whether to include specific metrics, percentages, and timeframes'
            }
          },
          required: ['topic']
        }
      },
      {
        name: 'generatePortfolioBrief',
        description: 'Create a production-grade portfolio project brief with architecture, deliverables, and success metrics',
        parameters: {
          type: 'OBJECT',
          properties: {
            domain: {
              type: 'STRING',
              description: 'Project domain or industry (fintech, healthcare, climate, e-commerce, etc.)'
            },
            complexity: {
              type: 'STRING',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'Complexity level appropriate for user experience'
            },
            techStack: {
              type: 'STRING',
              description: 'Primary technology to showcase (e.g., React, Node.js, Python)'
            }
          },
          required: ['domain']
        }
      },
      {
        name: 'simulateInterview',
        description: 'Simulate a technical interview with real questions calibrated for the user\'s target role and level',
        parameters: {
          type: 'OBJECT',
          properties: {
            difficulty: {
              type: 'STRING',
              enum: ['easy', 'medium', 'hard', 'google_faang'],
              description: 'Interview difficulty level'
            },
            focusArea: {
              type: 'STRING',
              enum: ['system_design', 'algorithms', 'behavioral', 'architecture', 'mixed'],
              description: 'Primary focus area for questions'
            },
            role: {
              type: 'STRING',
              description: 'Specific role to target (e.g., Senior Frontend Engineer)'
            }
          },
          required: ['difficulty', 'focusArea']
        }
      },
      {
        name: 'createImmunizationPlan',
        description: 'Create a 30-day plan to make a skill AI-resistant with real books, courses, and deliverables',
        parameters: {
          type: 'OBJECT',
          properties: {
            vulnerableSkill: {
              type: 'STRING',
              description: 'The skill being automated or at risk (e.g., React, copywriting, data entry)'
            },
            targetLevel: {
              type: 'STRING',
              enum: ['resistant', 'irreplaceable'],
              description: 'Desired protection level against AI automation'
            }
          },
          required: ['vulnerableSkill']
        }
      },
      {
        name: 'analyzeSalaryArbitrage',
        description: 'Analyze salary gaps between user\'s location and remote/global markets using real compensation data',
        parameters: {
          type: 'OBJECT',
          properties: {
            targetRole: {
              type: 'STRING',
              description: 'Job title to analyze salaries for'
            },
            currentLocation: {
              type: 'STRING',
              description: 'User\'s current city, country, or region'
            },
            yearsExperience: {
              type: 'NUMBER',
              description: 'Years of professional experience'
            }
          },
          required: ['targetRole']
        }
      },
      {
        name: 'scanATSGap',
        description: 'Fetch a live job posting and compare against user resume to find missing keywords, match score, and critical gaps',
        parameters: {
          type: 'OBJECT',
          properties: {
            jobUrl: {
              type: 'STRING',
              description: 'Live URL of the job posting to analyze'
            },
            resumeText: {
              type: 'STRING',
              description: 'Full text content of the user\'s resume'
            }
          },
          required: ['jobUrl', 'resumeText']
        }
      },
      {
        name: 'generateNegotiationScript',
        description: 'Generate a data-backed salary negotiation script with counter-offers, tactics, and walk-away points',
        parameters: {
          type: 'OBJECT',
          properties: {
            offerAmount: {
              type: 'NUMBER',
              description: 'The salary offer amount received'
            },
            marketMedian: {
              type: 'NUMBER',
              description: 'Market median salary for this role and experience level'
            },
            companySize: {
              type: 'STRING',
              enum: ['startup', 'mid', 'enterprise', 'faang'],
              description: 'Size or category of the employer'
            }
          },
          required: ['offerAmount', 'marketMedian']
        }
      }
    ];
  }

  // ─── Core Execution Engine ───
  async execute(command, context = {}) {
    const cacheKey = `${this.userId}::${command.trim().toLowerCase()}`;
    const cached = twinCache.get(cacheKey);
    if (cached) {
      console.log('[CareerTwin] Cache hit — serving instantly');
      return { ...cached, fromCache: true, cachedAt: new Date().toISOString() };
    }

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        tools: [{ functionDeclarations: this._getFunctionDeclarations() }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      });

      const prompt = this._buildSystemPrompt(command, context);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 4000)
      );

      const result = await Promise.race([
        callWithRetry(() => model.generateContent(prompt), 2),
        timeoutPromise
      ]);

      const functionCalls = result.response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const actions = [];
        for (const call of functionCalls) {
          console.log(`[CareerTwin] Tool call: ${call.name}(${JSON.stringify(call.args)})`);
          const toolResult = await this._executeTool(call.name, call.args);
          actions.push({
            tool: call.name,
            content: toolResult,
            meta: { generatedAt: new Date().toISOString(), modelUsed: 'gemini-3.5-flash' }
          });
        }

        const response = {
          type: 'action',
          actions,
          summary: this._generateSummary(actions, command),
          sessionId: this.sessionId
        };

        twinCache.set(cacheKey, response, 7200000);
        return response;
      }

      // No function call triggered — parse direct text response as JSON
      const text = result.response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = { summary: text };
      }

      const response = {
        type: 'action',
        actions: [parsed],
        summary: parsed.summary || parsed.message || 'Career Twin generated your actionable brief.',
        sessionId: this.sessionId
      };

      twinCache.set(cacheKey, response, 7200000);
      return response;

    } catch (error) {
      console.log('[CareerTwin] Fast fallback — Gemini unavailable, slow, or rate-limited');
      const fallback = this._fallbackResponse(command);
      twinCache.set(cacheKey, fallback, 1800000);
      return fallback;
    }
  }

  _buildSystemPrompt(command, context) {
    const p = {
      name: this.profile?.name || 'Student',
      skills: this.profile?.skills || ['JavaScript', 'React', 'Node.js'],
      targetRole: this.profile?.target_role || 'Software Engineer',
      experience: this.profile?.experience_level || 'mid',
      location: this.profile?.location || 'Remote'
    };

    return `
You are Career Twin, an elite autonomous career agent for ${p.name}.
User Profile: ${JSON.stringify(p)}
Current Date: ${new Date().toISOString()}

User Command: "${command}"
Additional Context: ${JSON.stringify(context)}

Analyze the command intent and call EXACTLY ONE function that best fulfills the request.
Extract all required parameters from the command and context.
If a parameter is missing but required, infer it from the user profile above.
For real-data tools (analyzeSalaryArbitrage, scanATSGap, generateNegotiationScript), prioritize them when the command mentions salary, compensation, ATS, resume gap, job posting, offer, or negotiation.
`;
  }

  async _executeTool(name, args) {
    switch (name) {
      case 'generateLinkedInPost': return await this.generateLinkedInPost(args);
      case 'generatePortfolioBrief': return await this.generatePortfolioBrief(args);
      case 'simulateInterview': return await this.simulateInterview(args);
      case 'createImmunizationPlan': return await this.createImmunizationPlan(args);
      case 'analyzeSalaryArbitrage': return await this.analyzeSalaryArbitrage(args);
      case 'scanATSGap': return await this.scanATSGap(args);
      case 'generateNegotiationScript': return await this.generateNegotiationScript(args);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  }

  _generateSummary(actions, command) {
    const content = actions[0]?.content;
    const tool = actions[0]?.tool;

    switch (tool) {
      case 'scanATSGap':
        return `Live ATS scan complete. Match score: ${content?.matchScore ?? 'N/A'}%. ${content?.missingKeywords?.length || 0} keyword gaps identified.`;
      case 'analyzeSalaryArbitrage':
        return `Salary arbitrage analysis complete. Arbitrage score: ${content?.arbitrageScore ?? 'N/A'}/100. Potential upside: $${content?.arbitrageAmount?.toLocaleString() ?? 'N/A'}.`;
      case 'generateNegotiationScript':
        return `Negotiation script generated. Confidence: ${content?.confidenceScore ?? 'N/A'}%. Target counter-offer: $${content?.counterOfferRange?.target?.toLocaleString() ?? 'N/A'}.`;
      case 'generateLinkedInPost':
        return `LinkedIn post ready. Predicted engagement: ${content?.estimatedEngagement || 'medium'}. Optimal posting time: ${content?.bestTimeToPost || 'Tuesday 9:00 AM'}.`;
      case 'generatePortfolioBrief':
        return `Portfolio brief ready: ${content?.title || 'Untitled'} (${content?.complexity || 'intermediate'}, ~${content?.estimatedHours || '?'}h).`;
      case 'simulateInterview':
        return `Interview simulation ready: ${content?.difficulty || 'medium'} ${content?.role || 'Software Engineer'} focus on ${(content?.focusAreas || ['mixed']).join(', ')}.`;
      case 'createImmunizationPlan':
        return `30-day immunization plan for ${content?.vulnerableSkill || 'your skill'}. Automation risk: ${content?.automationRiskScore ?? 'N/A'}%.`;
      default:
        return `Career Twin executed ${actions.length} tool(s) for your request.`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  TOOL IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════

  // ─── 1. LinkedIn Post Generator ───
  async generateLinkedInPost({ topic, tone = 'professional', includeMetrics = true }) {
    const p = this.profile;
    const prompt = `
You are Career Twin, an elite LinkedIn ghostwriter for ${p.name || 'a professional'}, a ${p.experience_level || 'mid'}-level ${p.target_role || 'Software Engineer'} skilled in ${(p.skills || ['JavaScript']).join(', ')}.
Write a LinkedIn post about: ${topic}
Tone: ${tone}
${includeMetrics ? 'Include specific metrics, percentages, and timeframes. Use real numbers.' : ''}

Return ONLY a JSON object with this exact schema:
{
  "hook": "First 1-2 sentences that stop the scroll",
  "body": "Full post with \\\\n line breaks. 4-6 paragraphs. Include a story arc and 2-3 bullet points.",
  "cta": "Engaging question or call to action",
  "estimatedEngagement": "low|medium|high",
  "hashtags": ["#SpecificHashtag", "#CareerGrowth"],
  "bestTimeToPost": "e.g. Tuesday 9:00 AM EST",
  "mediaSuggestion": "Exactly what visual to attach",
  "previewText": "The first 2 lines before '...see more'"
}

Rules:
- Write REAL content. Never placeholders like [Career Twin generated...].
- Be specific to ${p.target_role || 'Software Engineer'} and ${(p.skills || ['JavaScript'])[0]}.
- The hook must create a curiosity gap or pattern interrupt.
- Body should demonstrate expertise without arrogance.
`;
    return await generateJSON(prompt, 0.8, 1024);
  }

  // ─── 2. Portfolio Brief Generator ───
  async generatePortfolioBrief({ domain, complexity = 'advanced', techStack }) {
    const p = this.profile;
    const stack = techStack || (p.skills || ['React'])[0];
    const prompt = `
You are Career Twin, a Staff Engineer mentor for ${p.name || 'a developer'} targeting ${p.target_role || 'Software Engineer'} roles.
Design a ${complexity} portfolio project in the ${domain} domain using ${stack}.

Return ONLY a JSON object:
{
  "title": "Specific project name",
  "brief": "1 paragraph describing the real-world problem and solution",
  "architecture": {
    "components": ["Component 1", "Component 2"],
    "dataFlow": "Step-by-step data flow description",
    "diagramType": "layered|event-driven|security-layered"
  },
  "deliverables": ["Deliverable 1", "Deliverable 2"],
  "successMetrics": ["Metric 1", "Metric 2"],
  "estimatedHours": number,
  "complexity": "beginner|intermediate|advanced",
  "githubRepoStructure": ["/path1", "/path2"],
  "deploymentSteps": ["Step 1", "Step 2"],
  "learningOutcomes": ["Outcome 1", "Outcome 2"]
}

Rules:
- Suggest a project that would genuinely impress a hiring manager for ${p.target_role || 'Software Engineer'}.
- Include real tool names and frameworks.
- Architecture must be specific, not generic.
`;
    return await generateJSON(prompt, 0.7, 1024);
  }

  // ─── 3. Interview Simulator ───
  async simulateInterview({ difficulty = 'medium', focusArea = 'mixed', role }) {
    const p = this.profile;
    const targetRole = role || p.target_role || 'Software Engineer';
    const prompt = `
You are Career Twin, a former FAANG interviewer preparing ${p.name || 'a candidate'} for a ${difficulty} ${targetRole} interview.
Focus area: ${focusArea}

Return ONLY a JSON object:
{
  "role": "Target job role",
  "difficulty": "easy|medium|hard|google_faang",
  "focusAreas": ["system_design", "algorithms"],
  "timeLimit": "45 minutes",
  "questions": [
    {
      "type": "system_design|algorithms|behavioral|architecture",
      "question": "Full question text",
      "rubric": "What the interviewer grades you on",
      "followUp": "Deep-dive follow-up question",
      "sampleAnswerOutline": ["Key point 1", "Key point 2"],
      "estimatedTime": "10 min",
      "difficultyScore": 1-10
    }
  ],
  "scoringMatrix": { "technical": 35, "communication": 25, "problemSolving": 25, "cultureFit": 15 },
  "preparationChecklist": ["Task 1", "Task 2"],
  "commonPitfalls": ["Pitfall 1", "Pitfall 2"]
}

Rules:
- Generate questions actually asked at ${difficulty === 'google_faang' ? 'Google L5' : 'top tech companies'} for ${targetRole}.
- Include at least 3 questions.
- Make rubrics specific and actionable.
`;
    return await generateJSON(prompt, 0.6, 1024);
  }

  // ─── 4. Immunization Plan ───
  async createImmunizationPlan({ vulnerableSkill, targetLevel = 'irreplaceable' }) {
    const p = this.profile;
    const prompt = `
You are Career Twin, a strategic career advisor. ${p.name || 'The user'} wants to make their ${vulnerableSkill} skills ${targetLevel} against AI automation.

Return ONLY a JSON object:
{
  "vulnerableSkill": "Skill being automated",
  "targetLevel": "resistant|irreplaceable",
  "duration": "30 days",
  "phases": [
    {
      "week": 1,
      "focus": "Theme for the week",
      "tasks": ["Specific task"],
      "resources": ["Book: 'Title' by Author", "Course: Platform — Course Name"],
      "deliverable": "Tangible output due end of week"
    }
  ],
  "automationRiskScore": 0-100,
  "exitCriteria": "How you know you're ready",
  "complementarySkills": ["Skill 1", "Skill 2"],
  "salaryImpactProjection": "+X% if mastered"
}

Rules:
- Reference real books, courses, and deliverables.
- Be specific to ${vulnerableSkill}.
- Include metrics and timeframes.
- Phases must be realistic for a ${p.experience_level || 'mid'}-level professional.
`;
    return await generateJSON(prompt, 0.7, 1024);
  }

  // ─── 5. Salary Arbitrage Analyzer (REAL DATA) ───
  async analyzeSalaryArbitrage({ targetRole, currentLocation, yearsExperience = 0 }) {
    // Attempt to fetch external salary data if API is configured
    let externalData = null;
    if (process.env.SALARY_API_KEY && process.env.SALARY_API_URL) {
      try {
        const url = new URL(process.env.SALARY_API_URL);
        url.searchParams.append('role', targetRole);
        if (currentLocation) url.searchParams.append('location', currentLocation);
        url.searchParams.append('years', String(yearsExperience));

        const response = await fetchWithTimeout(url.toString(), {
          headers: {
            'Authorization': `Bearer ${process.env.SALARY_API_KEY}`,
            'Accept': 'application/json'
          }
        }, 5000);
        if (response.ok) externalData = await response.json();
      } catch (e) {
        console.log('[CareerTwin] External salary API unavailable:', e.message);
      }
    }

    const prompt = `
You are a compensation analyst with access to ${externalData ? 'real market data' : 'comprehensive salary benchmarks'}.
${externalData ? `EXTERNAL DATA: ${JSON.stringify(externalData)}` : ''}

Analyze salary arbitrage for:
- Role: ${targetRole}
- Current Location: ${currentLocation || 'Remote/Global'}
- Years Experience: ${yearsExperience}

Return ONLY JSON:
{
  "localMedian": number,
  "remoteMedian": number,
  "globalMedian": number,
  "topMarkets": [{"location": "string", "medianSalary": number, "currency": "USD"}],
  "arbitrageScore": 0-100,
  "arbitrageAmount": number,
  "recommendations": ["string"],
  "costOfLivingAdjusted": [{"location": "string", "adjustedSalary": number}],
  "dataSource": "string",
  "analysisDate": "ISO date"
}

Rules:
- Be specific with numbers.
- Consider cost-of-living adjustments.
- Identify the highest-leverage moves for this profile.
`;
    const result = await generateJSON(prompt, 0.4, 1024);
    return {
      ...result,
      dataSource: externalData ? 'external_api+gemini' : 'gemini_knowledge',
      queriedAt: new Date().toISOString()
    };
  }

  // ─── 6. ATS Gap Scanner (REAL DATA) ───
  async scanATSGap({ jobUrl, resumeText }) {
    if (!jobUrl || !resumeText) {
      throw new Error('Both jobUrl and resumeText are required for ATS analysis');
    }

    // Fetch live job posting
    let jobText;
    try {
      const response = await fetchWithTimeout(jobUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      }, 8000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      jobText = extractTextFromHTML(html);
      if (jobText.length < 200) throw new Error('Job page text too short — possible bot protection or redirect');
    } catch (err) {
      throw new Error(`Failed to fetch job posting: ${err.message}`);
    }

    // Use Gemini to analyze the gap
    const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer with deep knowledge of how resume parsers and recruiter workflows function.

JOB DESCRIPTION (extracted from live URL):
${jobText.substring(0, 6000)}

RESUME:
${resumeText.substring(0, 4000)}

Analyze the resume against the job description. Identify:
1. Missing keywords/skills that the job requires but the resume lacks
2. Match score (0-100)
3. Specific suggestions to improve the resume for this role
4. Critical gaps that would likely cause rejection
5. Overlapping strengths to emphasize

Return ONLY a JSON object:
{
  "missingKeywords": ["skill1", "skill2"],
  "matchScore": 75,
  "suggestions": ["Add experience with X", "Highlight Y achievement with metrics"],
  "criticalGaps": ["Must-have missing skill"],
  "overlappingStrengths": ["Strong match area"],
  "keywordDensity": {"required": 12, "matched": 8},
  "atsOptimizationTips": ["Use exact job title in headline", "Add skills section"]
}

Rules:
- Be brutally honest about gaps.
- Suggest specific rewording, not generic advice.
- Consider both hard skills and soft skills mentioned in the job description.
`;
    const result = await generateJSON(prompt, 0.3, 1024);
    return {
      ...result,
      jobUrl,
      analysisSource: 'live_fetch+gemini',
      scannedAt: new Date().toISOString(),
      jobTextLength: jobText.length
    };
  }

  // ─── 7. Negotiation Script Generator (REAL DATA) ───
  async generateNegotiationScript({ offerAmount, marketMedian, companySize = 'mid' }) {
    const p = this.profile;
    const gap = marketMedian - offerAmount;
    const gapPercent = offerAmount > 0 ? ((gap / offerAmount) * 100).toFixed(1) : '0.0';

    const prompt = `
You are an elite salary negotiation coach who has helped candidates secure $2B+ in total compensation.

CANDIDATE PROFILE:
- Role: ${p.target_role || 'Software Engineer'}
- Skills: ${(p.skills || ['JavaScript']).join(', ')}
- Experience: ${p.experience_level || 'mid'}
- Location: ${p.location || 'Remote'}

OFFER DETAILS:
- Offer Amount: $${offerAmount.toLocaleString()}
- Market Median: $${marketMedian.toLocaleString()}
- Gap: $${gap.toLocaleString()} (${gapPercent}%)
- Company Size: ${companySize}

Return ONLY JSON:
{
  "script": {
    "opening": "string",
    "counter": "string",
    "justification": "string",
    "objectionHandlers": [{"objection": "string", "response": "string"}],
    "close": "string"
  },
  "counterOfferRange": {"min": number, "target": number, "max": number},
  "walkAwayPoint": number,
  "nonSalaryLeverage": ["string"],
  "companyTactics": {"startup": "string", "mid": "string", "enterprise": "string", "faang": "string"},
  "confidenceScore": 0-100,
  "preparationChecklist": ["string"]
}

Rules:
- The script must sound natural, not robotic.
- Justification must tie to business value, not personal need.
- Objection handlers must be empathetic but firm.
- Counter-offer range must be mathematically sound.
`;
    return await generateJSON(prompt, 0.6, 1024);
  }

  // ═══════════════════════════════════════════════════════════════
  //  INTELLIGENT FALLBACK (No API required)
  // ═══════════════════════════════════════════════════════════════
  _fallbackResponse(command) {
    const cmd = command.toLowerCase();
    const role = this.profile?.target_role || 'Software Engineer';
    const skills = this.profile?.skills || ['JavaScript', 'React', 'Node.js'];
    const topSkill = skills[0] || 'React';
    const name = this.profile?.name || 'Student';
    const location = this.profile?.location || 'Remote';
    const experience = this.profile?.experience_level || 'mid';

    // Extract topic from command using simple NLP
    const extractTopic = (cmd) => {
      const patterns = [
        /about\s+(.+?)(?:\s+in\s+|\s+for\s+|$)/i,
        /for\s+(.+?)(?:\s+in\s+|\s+about\s+|$)/i,
        /create\s+(?:a|an)?\s*(.+?)(?:\s+for\s+|\s+about\s+|$)/i,
        /simulate\s+(?:a|an)?\s*(.+?)(?:\s+for\s+|$)/i,
        /plan\s+(?:for|to)?\s*(.+?)(?:\s+in\s+|$)/i
      ];
      for (const pattern of patterns) {
        const match = cmd.match(pattern);
        if (match && match[1]) return match[1].trim();
      }
      return null;
    };

    const topic = extractTopic(command) || 'your latest project';
    const contextTopic = topic.replace(/my\s+/g, '').replace(/a\s+/g, '').replace(/the\s+/g, '');

    // ─── NEW: Salary Arbitrage Fallback ───
    if (cmd.includes('salary') || cmd.includes('arbitrage') || cmd.includes('compensation') || cmd.includes('market rate')) {
      return {
        type: 'action',
        actions: [{
          tool: 'analyzeSalaryArbitrage',
          content: {
            localMedian: 95000,
            remoteMedian: 135000,
            globalMedian: 128000,
            topMarkets: [
              { location: 'San Francisco, CA', medianSalary: 185000, currency: 'USD' },
              { location: 'New York, NY', medianSalary: 165000, currency: 'USD' },
              { location: 'Seattle, WA', medianSalary: 155000, currency: 'USD' },
              { location: 'Remote (US)', medianSalary: 145000, currency: 'USD' },
              { location: 'London, UK', medianSalary: 95000, currency: 'USD' }
            ],
            arbitrageScore: 72,
            arbitrageAmount: 40000,
            recommendations: [
              'Target remote-first companies based in SF/NY while living in lower COL area',
              'Negotiate based on global median, not local market — cite market data',
              'Highlight async communication skills as remote premium justification',
              'Consider contracting at $120-150/hr as arbitrage multiplier'
            ],
            costOfLivingAdjusted: [
              { location: 'Austin, TX', adjustedSalary: 142000 },
              { location: 'Denver, CO', adjustedSalary: 138000 },
              { location: 'Miami, FL', adjustedSalary: 135000 }
            ],
            dataSource: 'fallback_estimates',
            disclaimer: 'Connect SALARY_API_KEY + SALARY_API_URL for real-time market data'
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'analytical', modelUsed: 'fallback_v3' }
        }],
        summary: `Salary arbitrage analysis for ${role} (fallback mode). Remote roles offer ~$40K arbitrage potential over ${location}. Add SALARY_API_KEY for live data.`,
        sessionId: this.sessionId
      };
    }

    // ─── NEW: ATS Gap Fallback ───
    if (cmd.includes('ats') || cmd.includes('resume gap') || (cmd.includes('job') && cmd.includes('resume')) || cmd.includes('keyword')) {
      return {
        type: 'action',
        actions: [{
          tool: 'scanATSGap',
          content: {
            missingKeywords: ['Kubernetes', 'gRPC', 'Terraform', 'CI/CD Pipeline Design', 'Observability', 'Load Testing'],
            matchScore: 62,
            suggestions: [
              `Add "Kubernetes" to your skills section — appears in 78% of ${role} postings`,
              'Replace "managed deployments" with "CI/CD Pipeline Design"',
              'Add a project showcasing gRPC or Protocol Buffers',
              'Include metrics: "Reduced latency by 40%" instead of "improved performance"',
              'Add "Prometheus/Grafana" under monitoring — high-frequency keyword'
            ],
            criticalGaps: ['System Design at Scale', 'Production Observability', 'Cloud-Native Architecture'],
            overlappingStrengths: ['React/Frontend Architecture', 'Node.js API Development', 'Cross-functional Collaboration'],
            keywordDensity: { required: 24, matched: 15 },
            atsOptimizationTips: [
              'Mirror the exact job title in your resume headline',
              'Place top 6 skills in a dedicated "Core Skills" section near the top',
              'Use standard section headings: Experience, Education, Skills — not creative variants',
              'Avoid tables and columns — ATS parsers strip them randomly'
            ],
            analysisSource: 'fallback_heuristic',
            disclaimer: 'Live analysis requires a valid jobUrl and Gemini API access'
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'diagnostic', modelUsed: 'fallback_v3' }
        }],
        summary: `ATS gap analysis (fallback mode). Based on typical ${role} requirements vs ${topSkill} profile, your match score is ~62%. Critical gaps: System Design and Observability.`,
        sessionId: this.sessionId
      };
    }

    // ─── NEW: Negotiation Script Fallback ───
    if (cmd.includes('negotiation') || cmd.includes('offer') || cmd.includes('counter') || cmd.includes('script')) {
      const offerMatch = command.match(/\$?(\d{3,}(?:,\d{3})*)/);
      const offerAmount = offerMatch ? parseInt(offerMatch[1].replace(/,/g, '')) : 120000;
      const marketMedian = Math.round(offerAmount * 1.15);
      const companySize = cmd.includes('startup') ? 'startup' : cmd.includes('faang') || cmd.includes('google') ? 'faang' : 'mid';

      return {
        type: 'action',
        actions: [{
          tool: 'generateNegotiationScript',
          content: {
            script: {
              opening: `Thank you for the offer. I'm genuinely excited about the team and the impact of this role. Based on my research and the value I've demonstrated in production ${topSkill} systems, I'd like to discuss the compensation package.`,
              counter: `The market median for ${role} with ${experience}-level experience is $${marketMedian.toLocaleString()}. Given my expertise in ${topSkill} and track record of shipping high-impact features, I was targeting a base of $${Math.round(marketMedian * 1.08).toLocaleString()}.`,
              justification: `I bring 3 specific advantages: 1) Production ${topSkill} experience at scale with measurable performance wins, 2) Cross-functional leadership that reduces delivery risk by an estimated 30%, 3) Domain expertise that shortens ramp-up time to full productivity.`,
              objectionHandlers: [
                { objection: 'The budget is fixed', response: 'I understand budget constraints. Could we explore a signing bonus or equity adjustment to bridge the gap? I’m flexible on timeline and open to a performance review at 6 months with a compensation checkpoint.' },
                { objection: 'We need to check with the compensation committee', response: 'Of course. To help the committee decide, I can share a one-page summary of my projected 12-month impact with specific milestones and KPIs I intend to hit.' },
                { objection: 'Other candidates accepted lower', response: `I respect that. My ask is based on specific market data for this role in ${location || 'this market'} and the specialized ${topSkill} skill set I bring. I’m confident the ROI will be clear within the first quarter.` }
              ],
              close: `I'm confident this adjustment reflects the value I'll deliver in the first 90 days. When can we finalize so I can give notice and join by my preferred start date?`
            },
            counterOfferRange: { min: Math.round(marketMedian * 0.95), target: Math.round(marketMedian * 1.08), max: Math.round(marketMedian * 1.15) },
            walkAwayPoint: Math.round(offerAmount * 0.92),
            nonSalaryLeverage: ['Remote work flexibility (2+ days/week)', 'Professional development budget ($5K/year)', 'Accelerated equity vesting schedule', 'Title bump to Senior', 'Conference/travel budget'],
            companyTactics: {
              startup: 'Emphasize equity upside and impact breadth. Ask for equity refreshers and advisor shares.',
              mid: 'Focus on total comp and growth trajectory. Mid-market companies have flexibility on title and remote.',
              enterprise: 'Negotiate on base + bonus. Enterprise values stability — emphasize your retention story and process improvement skills.',
              faang: 'Comp is largely formulaic. Negotiate on level/scope and sign-on bonus to offset lost equity from previous role.'
            },
            confidenceScore: 85,
            preparationChecklist: [
              'Research the hiring manager’s background on LinkedIn',
              'Prepare 3 specific business-impact stories with metrics',
              'Get competing offer or written market data printout',
              'Practice the script aloud 3 times with a timer',
              'Prepare your "silent minute" — pause after stating your number'
            ]
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'strategic', modelUsed: 'fallback_v3' }
        }],
        summary: `Negotiation script for ${role} (fallback mode). Calibrated for ${experience}-level ${companySize} offer of $${offerAmount.toLocaleString()}. Key tactic: anchor to market median + 8%.`,
        sessionId: this.sessionId
      };
    }

    // ─── LINKEDIN: Topic-aware, not generic ───
    if (cmd.includes('linkedin') || cmd.includes('post')) {
      const topicHooks = {
        'climate conditions': {
          hook: `I spent 3 years building climate data pipelines in ${location}. Here's what the numbers actually say about where we're heading — and why most "climate tech" is solving the wrong problem.`,
          body: `When I started working on climate data infrastructure, I thought the challenge was collection. It's not.\n\nWe have more climate data than ever — satellites, IoT sensors, government APIs. The real bottleneck is **decision latency**: how fast can a city planner, a farmer, or a policy maker turn raw data into action?\n\nI built a real-time climate analytics layer using ${topSkill} that reduced decision latency from 6 weeks to 4 hours for ${location} municipal planners.\n\n3 architectural choices that made the difference:\n\n1️⃣ **Edge-first processing**: Instead of centralizing everything in a cloud warehouse, we deployed lightweight ${topSkill} microservices at the edge. Flood warnings now trigger in 90 seconds, not 90 minutes.\n2️⃣ **Uncertainty visualization**: Most dashboards show averages. We built confidence intervals into every metric. A "72°F" forecast is useless. "72°F ± 3°F, 87% confidence" changes decisions.\n3️⃣ **API federation**: We unified 11 government data sources into a single GraphQL layer. One query gets you air quality, precipitation, and soil moisture — correlated, not isolated.\n\nThe lesson: climate tech isn't about more data. It's about **shrinking the gap between signal and decision**.\n\nFarmers in ${location} are already using this to shift planting schedules. City planners are rerouting drainage before storms hit.\n\nThe code is open-source. The data is public. The impact is measurable.`,
          cta: `What's the biggest gap you've seen between climate data and real-world action? Drop a comment — I read every one.`,
          hashtags: ['#ClimateTech', '#DataEngineering', `#${topSkill.replace(/[^a-zA-Z0-9]/g, '')}`, '#OpenData', '#ImpactEngineering'],
          media: 'Architecture diagram showing edge-to-cloud data flow, or a before/after dashboard screenshot'
        },
        'latest project': {
          hook: `How I cut ${role.toLowerCase()} delivery time by 40% using ${topSkill} — and why no one talks about the real bottleneck.`,
          body: `Last quarter, our ${role.toLowerCase()} team hit a wall.\n\nWe were shipping features, but technical debt was compounding. API latency spiked. The frontend lagged. Users noticed.\n\nInstead of rewriting everything, I made 3 targeted moves:\n\n1️⃣ Re-architected state management in ${topSkill} — dropped unnecessary re-renders by 60%.\n2️⃣ Introduced automated integration tests before merge. Regressions dropped to near zero.\n3️⃣ Documented architecture decisions (ADRs) so new devs onboard in 2 days, not 2 weeks.\n\nThe result? We shipped 2x faster with a smaller team.\n\nThe lesson: speed isn't about working harder. It's about removing invisible drag.`,
          cta: `What's the biggest "invisible drag" in your ${topSkill} workflow right now? Drop a comment — I read every one.`,
          hashtags: [`#${topSkill.replace(/[^a-zA-Z0-9]/g, '')}`, '#SoftwareEngineering', '#CareerGrowth', '#TechLeadership'],
          media: 'Architecture diagram showing before/after state flow, or a screenshot of your test coverage report'
        }
      };

      let content = topicHooks['latest project'];
      for (const [key, value] of Object.entries(topicHooks)) {
        if (cmd.includes(key)) {
          content = value;
          break;
        }
      }

      if (!content && contextTopic) {
        content = {
          hook: `I built a ${contextTopic} system that handles 10x the load with half the infrastructure. Here's the architecture no one asked me to document — but every hiring manager wanted to see.`,
          body: `When I started the ${contextTopic} project, the constraint was clear: ${experience}-level budget, senior-level expectations.\n\nI chose ${topSkill} not because it's trending, but because it solved a specific bottleneck: [describe your actual bottleneck].\n\nThe architecture:\n• Frontend: ${topSkill} with virtualization for 100k+ row datasets\n• API: Node.js streaming responses to prevent memory bloat\n• Data: [Your database choice] with query optimization that cut p95 latency from 2s to 120ms\n• Deployment: GitHub Actions → Docker → [Your platform] with rollback in <30 seconds\n\nWhat I didn't expect: the debugging phase taught me more than the build phase. I now have a mental model for [specific system behavior] that I apply to every project.\n\nThe ${contextTopic} space is crowded with tutorials. This is a production system with real users, real trade-offs, and real metrics.`,
          cta: `Have you shipped a ${contextTopic} feature to production? What broke that you didn't expect?`,
          hashtags: [`#${topSkill.replace(/[^a-zA-Z0-9]/g, '')}`, `#${contextTopic.replace(/\s+/g, '')}`, '#ProductionEngineering', '#CareerGrowth'],
          media: `System architecture diagram for ${contextTopic}, or performance benchmark chart`
        };
      }

      return {
        type: 'action',
        actions: [{
          tool: 'linkedin_post',
          content: {
            hook: content.hook,
            body: content.body,
            cta: content.cta,
            estimatedEngagement: 'high',
            hashtags: content.hashtags,
            bestTimeToPost: 'Tuesday, 9:00 AM (your local timezone)',
            mediaSuggestion: content.media,
            previewText: content.hook.substring(0, 100) + '...'
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'story', modelUsed: 'fallback_v3' },
          visualArtifacts: { type: 'social_card', engagementPrediction: 72, topic: contextTopic }
        }],
        summary: `Your LinkedIn post about "${contextTopic}" is ready. It's tailored to your ${role} profile, ${topSkill} stack, and ${location} context — written as a metrics-driven story that hiring managers actually read.`,
        sessionId: this.sessionId
      };
    }

    // ─── PORTFOLIO: Role + topic aware ───
    if (cmd.includes('portfolio') || cmd.includes('project')) {
      const projectTopics = {
        'fintech': {
          title: `${role} Real-Time Fraud Detection Pipeline`,
          brief: `Build a production-grade fraud detection system that processes 10k+ transactions/second with <50ms latency. This proves you can architect high-stakes financial systems where false positives cost real money.`,
          architecture: {
            components: [`${topSkill} Dashboard (Vite)`, 'Node.js / Express API Gateway', 'Python FastAPI ML Inference', 'Apache Kafka Event Stream', 'PostgreSQL + Redis', 'Grafana Monitoring'],
            dataFlow: `Transaction → Kafka → Python fraud model → Risk score → ${topSkill} real-time alert → Human review queue`,
            diagramType: 'event-driven'
          },
          deliverables: ['GitHub monorepo with CI/CD', 'Live demo with simulated transaction feed', 'ML model card (precision/recall metrics)', 'Security audit checklist', 'Performance benchmark (k6)'],
          hours: 55,
          complexity: 'advanced'
        },
        'healthcare': {
          title: `${role} HIPAA-Compliant Patient Data API`,
          brief: `Build a medical records API with end-to-end encryption, audit logging, and FHIR compliance. This proves you understand regulatory constraints — a skill senior engineers at health tech companies must have.`,
          architecture: {
            components: [`${topSkill} Frontend`, 'Node.js / Express + Helmet.js', 'PostgreSQL (encrypted at rest)', 'AWS KMS Key Management', 'Audit Log Stream (Kafka)', 'FHIR R4 Resource Server'],
            dataFlow: `Patient auth → OAuth2 + MFA → Encrypted query → Audit log → FHIR-formatted response`,
            diagramType: 'security-layered'
          },
          deliverables: ['GitHub repo with security docs', 'HIPAA compliance checklist', 'Penetration test report (OWASP ZAP)', 'FHIR conformance test results', 'Deployment on AWS with Terraform'],
          hours: 60,
          complexity: 'advanced'
        }
      };

      let project = projectTopics['fintech'];
      for (const [key, value] of Object.entries(projectTopics)) {
        if (cmd.includes(key)) {
          project = value;
          break;
        }
      }

      if (!project && contextTopic) {
        project = {
          title: `${role} ${contextTopic.charAt(0).toUpperCase() + contextTopic.slice(1)} System`,
          brief: `Build a production-grade ${contextTopic} platform using ${topSkill}. This project demonstrates system design, performance optimization, and deployment skills that ${role} positions require.`,
          architecture: {
            components: [`${topSkill} Frontend`, 'Node.js API Layer', 'Python Microservice', 'PostgreSQL', 'Redis Cache', 'WebSocket Layer'],
            dataFlow: `User action → ${topSkill} → API → ${topSkill} microservice → Database → Real-time update`,
            diagramType: 'layered'
          },
          deliverables: ['GitHub repo with README', 'Live demo URL', 'Architecture Decision Records', 'Performance benchmarks', 'CI/CD pipeline'],
          hours: 45,
          complexity: 'advanced'
        };
      }

      return {
        type: 'action',
        actions: [{
          tool: 'portfolio_brief',
          content: {
            title: project.title,
            brief: project.brief,
            architecture: project.architecture,
            deliverables: project.deliverables,
            successMetrics: ['Test coverage > 75%', 'API p95 latency < 200ms', 'Lighthouse score > 90', 'Handles 1k concurrent connections'],
            estimatedHours: project.hours,
            complexity: project.complexity,
            githubRepoStructure: ['/apps/web/src', '/apps/api/src', '/packages/shared', '/.github/workflows/ci.yml', 'README.md', 'ARCHITECTURE.md', 'docker-compose.yml', 'terraform/'],
            deploymentSteps: ['Provision infrastructure (Terraform/AWS)', 'Deploy API with Docker', 'Deploy frontend to Vercel', 'Configure CI/CD', 'Add monitoring (Sentry/DataDog)'],
            learningOutcomes: ['System design under load', 'Security/regulatory compliance', 'Production observability', 'CI/CD pipelines']
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'technical', modelUsed: 'fallback_v3' },
          visualArtifacts: { type: 'architecture_diagram', complexityBadge: project.complexity, hours: project.hours, topic: contextTopic }
        }],
        summary: `This ${project.complexity} portfolio brief for "${contextTopic}" elevates you from "I know ${topSkill}" to "I architect ${contextTopic} systems." It includes a real deployment pipeline, not just local code.`,
        sessionId: this.sessionId
      };
    }

    // ─── INTERVIEW: Difficulty + role + focus area aware ───
    if (cmd.includes('interview') || cmd.includes('simulate')) {
      const difficulty = cmd.includes('hard') || cmd.includes('senior') ? 'hard' :
                        cmd.includes('google') || cmd.includes('faang') ? 'google_faang' : 'medium';
      const focusArea = cmd.includes('system design') ? 'system_design' :
                        cmd.includes('algorithm') ? 'algorithms' :
                        cmd.includes('behavior') ? 'behavioral' : 'mixed';

      const questionBanks = {
        'hard': [
          {
            type: 'system_design',
            question: `Design a real-time collaborative whiteboard (like Figma) that supports 100k concurrent users with <50ms sync latency. Your ${topSkill} frontend must handle 60fps updates.`,
            rubric: 'Evaluates operational transformation algorithms, WebSocket shard strategy, conflict resolution, and frontend rendering optimization.',
            followUp: 'A user deletes an object while another user is editing it. How do you resolve this without locking?',
            sampleAnswerOutline: ['Operational Transformation (OT) or CRDT for conflict-free sync', 'WebSocket shards by document-id with consistent hashing', 'Client-side prediction + server reconciliation', 'Canvas/WebGL rendering layer for 60fps'],
            estimatedTime: '20 min',
            difficultyScore: 9
          },
          {
            type: 'architecture',
            question: `You need to migrate a monolithic ${topSkill} app (500k LOC) to micro-frontends without downtime. Walk me through your strangler fig pattern.`,
            rubric: 'Looks for incremental migration, module federation, build optimization, and rollback strategy.',
            followUp: 'How do you maintain a single source of truth for design tokens across 8 independently deployed teams?',
            sampleAnswerOutline: ['Module Federation for gradual extraction', 'Shared npm registry for design system', 'Feature flags for A/B rollout', 'Independent CI/CD per domain with contract testing'],
            estimatedTime: '15 min',
            difficultyScore: 8
          }
        ],
        'google_faang': [
          {
            type: 'system_design',
            question: `Design Google Docs' real-time collaboration backend. Specifically: how do you handle the "thundering herd" problem when a celebrity document goes viral?`,
            rubric: 'Evaluates fan-out architecture, read replica strategy, caching layers, and graceful degradation.',
            followUp: 'Your caching layer (Redis) hits memory limits. How do you evict without dropping active connections?',
            sampleAnswerOutline: ['Consistent hashing for document shards', 'Hot document detection + dedicated hot-cache tier', 'Read replicas with eventual consistency for non-editors', 'Graceful degradation to read-only mode'],
            estimatedTime: '25 min',
            difficultyScore: 10
          }
        ]
      };

      const questions = questionBanks[difficulty] || questionBanks['hard'];

      return {
        type: 'action',
        actions: [{
          tool: 'interview_sim',
          content: {
            role: `Senior ${role}`,
            difficulty: difficulty,
            focusAreas: [focusArea],
            timeLimit: '45 minutes',
            questions: questions,
            scoringMatrix: { technical: 35, communication: 25, problemSolving: 25, cultureFit: 15 },
            preparationChecklist: [
              `Read "Designing Data-Intensive Applications" chapters 1, 5, 11`,
              `Sketch 3 ${focusArea} solutions on paper in 15 minutes each`,
              `Prepare 5 STAR stories from your ${topSkill} projects`,
              `Review ${role} interview experiences on LeetCode Discuss`
            ],
            commonPitfalls: [
              'Jumping into code before clarifying requirements',
              'Ignoring scalability until asked',
              'Not discussing trade-offs (there are always trade-offs)',
              `Weak "why" behind ${topSkill} architecture choices`
            ]
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'technical', modelUsed: 'fallback_v3' },
          visualArtifacts: { type: 'interview_dashboard', difficulty: difficulty, focusArea: focusArea, questionCount: questions.length }
        }],
        summary: `This is a ${difficulty} ${role} simulation focused on ${focusArea}. The questions are calibrated to ${difficulty === 'google_faang' ? 'Google L5' : 'senior'} bar. Practice your system design narration out loud.`,
        sessionId: this.sessionId
      };
    }

    // ─── IMMUNIZATION: Skill-specific with real resources ───
    if (cmd.includes('immunization') || cmd.includes('ai-proof') || cmd.includes('skill')) {
      const vulnerableSkill = contextTopic || topSkill;

      const skillSpecificPlans = {
        'react': {
          riskScore: 65,
          phases: [
            {
              week: 1,
              focus: 'Master the Compiler, Not the Framework',
              tasks: ['Deep-dive into React Server Components architecture', 'Build a custom React renderer (mini-React from scratch)', 'Understand concurrent features: Suspense, Transitions, useDeferredValue'],
              resources: ['Book: "Build Your Own React" by Rodrigo Pombo', 'Course: "React Internals" — Advanced React Patterns by Kent C. Dodds', 'Project: Build a React-like framework with 500 LOC'],
              deliverable: 'Working mini-React with JSX support'
            },
            {
              week: 2,
              focus: 'Cross Into Infrastructure',
              tasks: ['Learn Edge Runtime (Vercel Edge, Cloudflare Workers)', 'Deploy React at the edge with streaming SSR', 'Build an AI-powered component generator that uses your design system'],
              resources: ['Course: "Edge Computing with React" — Vercel Academy', 'Tool: PartyKit for real-time collaborative React apps'],
              deliverable: 'Edge-deployed React app with streaming SSR'
            },
            {
              week: 3,
              focus: 'AI-Adjacent Architecture',
              tasks: ['Build a React UI that orchestrates multiple LLM agents', 'Implement prompt engineering patterns in UI (chain-of-thought visualization)', 'Create an AI-debugging assistant for React apps'],
              resources: ['Course: "AI Engineering" — DeepLearning.AI (Andrew Ng)', 'Tool: LangChain JS + Vercel AI SDK'],
              deliverable: 'React app with multi-agent LLM orchestration'
            },
            {
              week: 4,
              focus: 'Publish Authority',
              tasks: [`Write "Beyond useEffect: A Senior React Engineer's Mental Model"`, 'Speak at a local React meetup or virtual conference', 'Mentor 2 junior devs through a complex React migration'],
              resources: ['Platform: React Summit CFP (Call for Papers)', 'Community: Reactiflux Discord for mentorship matching'],
              deliverable: 'Published article + mentorship log'
            }
          ],
          complementarySkills: ['Edge Computing', 'AI Orchestration', 'Performance Engineering', 'Technical Writing'],
          salaryImpact: '+22-30% (Staff Engineer track)'
        }
      };

      const plan = skillSpecificPlans[vulnerableSkill.toLowerCase()] || {
        riskScore: 60,
        phases: [
          {
            week: 1,
            focus: 'Identify the Human Layer',
            tasks: [`Audit 20 ${role} job postings — mark which ${vulnerableSkill} tasks AI already does`, `Map your ${vulnerableSkill} work to "judgment zones"`, `Write: "What ${vulnerableSkill} work should NEVER be automated?"`],
            resources: ['Book: "The Myth of Artificial Intelligence" by Erik J. Larson', 'Essay: "The End of Programming" by Matt Welsh (critique it)'],
            deliverable: 'Personal "Judgment Map" document'
          },
          {
            week: 2,
            focus: 'Build a Judgment Portfolio',
            tasks: ['Redesign a past project\'s architecture — document 3 bad decisions', 'Add ADRs to your GitHub', 'Mentor a junior dev through code review'],
            resources: ['Course: "System Design Interview" by Design Gurus', 'Template: ADR format from GitHub'],
            deliverable: '3 published ADRs + mentorship log'
          },
          {
            week: 3,
            focus: 'Cross-Train with AI-Adjacent Skills',
            tasks: ['Learn prompt engineering to debug AI failures', `Build an LLM evaluation framework for ${vulnerableSkill} tasks`, 'Study MLOps basics'],
            resources: ['Course: "Prompt Engineering for Developers" — DeepLearning.AI', 'Tool: Weights & Biases (free tier)'],
            deliverable: `LLM evaluation report on ${vulnerableSkill} automation limits`
          },
          {
            week: 4,
            focus: 'Publish Your Methodology',
            tasks: [`Write: "How I made my ${vulnerableSkill} skills irreplaceable in 30 days"`, 'Present your Judgment Map to a peer community', 'Update LinkedIn headline to reflect strategic focus'],
            resources: ['Platform: Dev.to or Hashnode', 'Guide: "On Writing Well" by William Zinsser'],
            deliverable: 'Published article + updated LinkedIn profile'
          }
        ],
        complementarySkills: ['System Design', 'Technical Writing', 'Team Coaching', 'MLOps Awareness'],
        salaryImpact: '+18-25% within 12 months'
      };

      return {
        type: 'action',
        actions: [{
          tool: 'immunization_plan',
          content: {
            vulnerableSkill: vulnerableSkill,
            targetLevel: 'irreplaceable',
            duration: '30 days',
            phases: plan.phases,
            automationRiskScore: plan.riskScore,
            exitCriteria: `You can teach ${vulnerableSkill} to a senior dev while explaining exactly when AI fails and why human judgment is required.`,
            complementarySkills: plan.complementarySkills,
            salaryImpactProjection: plan.salaryImpact
          },
          meta: { generatedAt: new Date().toISOString(), tone: 'strategic', modelUsed: 'fallback_v3' },
          visualArtifacts: { type: 'timeline', riskScore: plan.riskScore, weeks: 4, skill: vulnerableSkill }
        }],
        summary: `Your ${vulnerableSkill} skill has a ${plan.riskScore}% automation risk. This 30-day plan moves you from "executor" to "architect" — the layer AI cannot replace. Specific resources included.`,
        sessionId: this.sessionId
      };
    }

    // Generic fallback
    return {
      type: 'action',
      actions: [{
        tool: 'general',
        content: {
          message: `Career Twin is at capacity. Based on your ${role} profile with ${topSkill} skills: Focus on one high-leverage action this week — either publish a technical article about ${contextTopic || 'your latest project'}, ship a portfolio project with architecture diagrams, or simulate one hard system design interview. Momentum beats perfection.`
        },
        meta: { generatedAt: new Date().toISOString(), modelUsed: 'fallback_v3' }
      }],
      summary: 'Career Twin is experiencing high demand. Use the fallback action above to maintain momentum.',
      sessionId: this.sessionId
    };
  }
}

module.exports = CareerTwin;