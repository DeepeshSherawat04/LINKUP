// speechAnalysisService.js — v1.0 PRODUCTION
// 100% deterministic. Regex + math only. No AI.

const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'i mean', 'sort of', 'kind of',
  'basically', 'literally', 'honestly', 'so yeah', 'right', 'okay'
];

const STAR_KEYWORDS = {
  situation: ['situation', 'context', 'background', 'when', 'at', 'during', 'while'],
  task: ['task', 'responsibility', 'needed to', 'had to', 'was asked', 'my role'],
  action: ['action', 'i did', 'i implemented', 'i designed', 'i led', 'i created', 'i resolved'],
  result: ['result', 'outcome', 'impact', 'achieved', 'improved', 'increased', 'decreased', 'saved', 'led to']
};

class SpeechAnalysisService {
  /**
   * Analyze transcribed speech in real-time
   */
  analyze(transcript, questionType = 'system_design') {
    const cleanTranscript = transcript.toLowerCase().trim();
    const words = cleanTranscript.split(/\s+/).filter(w => w.length > 0);
    
    return {
      fillerWords: this._countFillers(cleanTranscript),
      pace: this._calculatePace(words.length, transcript),
      structure: this._analyzeStructure(cleanTranscript, questionType),
      technicalMentions: this._countTechnicalKeywords(cleanTranscript, questionType),
      sentiment: this._basicSentiment(cleanTranscript)
    };
  }

  /**
   * Real-time streaming chunk analysis
   */
  analyzeChunk(chunk, accumulatedTranscript) {
    const combined = (accumulatedTranscript + ' ' + chunk).toLowerCase();
    
    return {
      // Immediate red flags
      hasFillerSpike: this._hasFillerSpike(chunk),
      isRambling: this._isRambling(combined),
      
      // Progress tracking
      starProgress: this._starProgress(combined),
      tradeoffMentioned: this._hasTradeoffs(combined),
      
      // Interrupt triggers
      shouldInterrupt: this._shouldInterrupt(combined, chunk)
    };
  }

  // ─── Internal Methods ───
  _countFillers(text) {
    const found = [];
    FILLER_WORDS.forEach(fw => {
      const regex = new RegExp(`\\b${fw.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const matches = text.match(regex) || [];
      matches.forEach(() => found.push(fw));
    });
    
    return {
      count: found.length,
      words: found,
      density: found.length / Math.max(text.split(/\s+/).length, 1)
    };
  }

  _calculatePace(wordCount, transcript) {
    // Estimate: average speaking pace ~130 WPM
    // We can't know exact duration from text alone, so we use heuristics
    // In production, this is computed from audio duration via Whisper timestamps
    return {
      estimatedWpm: null, // Set by caller with audio duration
      wordCount,
      note: 'Provide audioDurationMs for accurate WPM'
    };
  }

  _analyzeStructure(text, type) {
    if (type === 'behavioral') {
      const hasSituation = STAR_KEYWORDS.situation.some(k => text.includes(k));
      const hasTask = STAR_KEYWORDS.task.some(k => text.includes(k));
      const hasAction = STAR_KEYWORDS.action.some(k => text.includes(k));
      const hasResult = STAR_KEYWORDS.result.some(k => text.includes(k));
      
      return {
        method: 'STAR',
        hasSituation,
        hasTask,
        hasAction,
        hasResult,
        isComplete: hasSituation && hasTask && hasAction && hasResult,
        score: [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length * 25
      };
    }
    
    // System design: check for structure markers
    const hasRequirements = /requirement|scope|functional|non.functional/.test(text);
    const hasHighLevel = /high.level|overview|architecture|diagram/.test(text);
    const hasDeepDive = /database|storage|cache|api|endpoint/.test(text);
    const hasTradeoffs = this._hasTradeoffs(text);
    const hasBottlenecks = /bottleneck|scale|million|latency|throughput/.test(text);
    
    return {
      method: 'Structured Design',
      hasRequirements,
      hasHighLevel,
      hasDeepDive,
      hasTradeoffs,
      hasBottlenecks,
      isComplete: hasRequirements && hasHighLevel && hasDeepDive,
      score: [hasRequirements, hasHighLevel, hasDeepDive, hasTradeoffs, hasBottlenecks].filter(Boolean).length * 20
    };
  }

  _countTechnicalKeywords(text, type) {
    const keywords = {
      system_design: ['database', 'cache', 'cdn', 'load balancer', 'microservice', 'api', 'queue', 'shard', 'replica', 'index', 'partition'],
      coding: ['time complexity', 'space complexity', 'optimization', 'edge case', 'recursion', 'iteration'],
      behavioral: ['team', 'stakeholder', 'deadline', 'priority', 'conflict', 'mentor']
    };
    
    const relevant = keywords[type] || keywords.system_design;
    const found = relevant.filter(k => text.includes(k));
    
    return { found, count: found.length, coverage: found.length / relevant.length };
  }

  _basicSentiment(text) {
    const positive = ['success', 'achieved', 'improved', 'solved', 'delivered', 'happy', 'great'];
    const negative = ['failed', 'problem', 'issue', 'difficult', 'struggle', 'bad', 'wrong'];
    
    const posCount = positive.filter(w => text.includes(w)).length;
    const negCount = negative.filter(w => text.includes(w)).length;
    
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

  _hasFillerSpike(chunk) {
    const words = chunk.toLowerCase().split(/\s+/);
    const fillerCount = words.filter(w => FILLER_WORDS.includes(w)).length;
    return fillerCount / Math.max(words.length, 1) > 0.15; // >15% fillers in chunk
  }

  _isRambling(text) {
    // Detect repeated phrases or circular talking
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 3) return false;
    
    const lastThree = sentences.slice(-3);
    const words = lastThree.map(s => s.trim().toLowerCase().split(/\s+/).slice(0, 5).join(' '));
    
    // Check if last 3 sentences start similarly (repeating)
    return words[0] === words[1] || words[1] === words[2];
  }

  _starProgress(text) {
    return {
      situation: STAR_KEYWORDS.situation.some(k => text.includes(k)),
      task: STAR_KEYWORDS.task.some(k => text.includes(k)),
      action: STAR_KEYWORDS.action.some(k => text.includes(k)),
      result: STAR_KEYWORDS.result.some(k => text.includes(k))
    };
  }

  _hasTradeoffs(text) {
    return /tradeoff|trade.off|pros? and cons|advantage|disadvantage|however|but|alternatively/.test(text);
  }

  _shouldInterrupt(combined, chunk) {
    // Interrupt conditions:
    // 1. User has been talking for >2 minutes without key structure
    // 2. Missing critical component in system design
    // 3. Filler word spike
    
    const wordCount = combined.split(/\s+/).length;
    const hasStructure = this._analyzeStructure(combined, 'system_design').isComplete;
    const fillerSpike = this._hasFillerSpike(chunk);
    
    return {
      shouldInterrupt: (wordCount > 150 && !hasStructure) || fillerSpike,
      reason: wordCount > 150 && !hasStructure ? 'missing_structure' : 
              fillerSpike ? 'filler_spike' : null,
      wordCount
    };
  }
}

module.exports = new SpeechAnalysisService();