// whisperService.js — v1.0 PRODUCTION
// Server-side transcription only. Audio never stored.

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class WhisperService {
  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Raw audio data (webm/mp3)
   * @returns {Promise<{text: string, duration: number}>}
   */
  async transcribe(audioBuffer) {
    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.webm`);
    
    try {
      // Write to temp file (Whisper API requires file path)
      fs.writeFileSync(tempFile, audioBuffer);

      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: 'en',
        response_format: 'json'
      });

      return {
        text: response.text || '',
        duration: response.duration || 0,
        confidence: this._estimateConfidence(response.text)
      };
    } catch (error) {
      console.error('[WhisperService.transcribe] Failed:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    } finally {
      // Always clean up temp file
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Quick health check
   */
  async healthCheck() {
    try {
      // Whisper doesn't have a dedicated health endpoint, so we do a minimal test
      await openai.models.list();
      return { status: 'healthy', model: 'whisper-1' };
    } catch (error) {
      return { status: 'unavailable', error: error.message };
    }
  }

  _estimateConfidence(text) {
    if (!text) return 0;
    // Heuristic: longer text with punctuation = higher confidence
    const words = text.split(/\s+/).length;
    const hasPunctuation = /[.!?]/.test(text);
    return Math.min((words / 10) * (hasPunctuation ? 1.2 : 0.8), 0.99);
  }
}

module.exports = new WhisperService();