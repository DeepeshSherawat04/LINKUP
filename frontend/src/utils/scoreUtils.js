// scoreUtils.js — FINAL v2.0
// Utility functions for formatting scores, colors, and analytics visuals

/**
 * Format a score value cleanly
 * - 0-100 scale: returns integer (e.g., "72")
 * - 0-10 scale: returns 1 decimal (e.g., "7.5")
 */
export const formatScore = (score, scale = 100) => {
  if (score === null || score === undefined || isNaN(score)) return scale === 10 ? '0.0' : '0';
  return scale === 10 ? Number(score).toFixed(1) : String(Math.round(Number(score)));
};

/**
 * Get color classes for a score badge (background + text + border)
 * 0-100: >=80 emerald, >=60 blue, >=40 amber, <40 rose
 * 0-10:  >=8 emerald, >=6 blue, >=4 amber, <4 rose
 */
export const getScoreColor = (score, scale = 100) => {
  const thresholdHigh = scale === 10 ? 8 : 80;
  const thresholdMid = scale === 10 ? 6 : 60;
  const thresholdLow = scale === 10 ? 4 : 40;

  if (score >= thresholdHigh) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= thresholdMid) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (score >= thresholdLow) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

/**
 * Get bar color for progress indicators
 * 0-100: >=80 emerald, >=60 blue, >=40 amber, <40 rose
 * 0-10:  >=8 emerald, >=6 blue, >=4 amber, <4 rose
 */
export const getScoreBarColor = (score, scale = 100) => {
  const thresholdHigh = scale === 10 ? 8 : 80;
  const thresholdMid = scale === 10 ? 6 : 60;
  const thresholdLow = scale === 10 ? 4 : 40;

  if (score >= thresholdHigh) return 'bg-emerald-500';
  if (score >= thresholdMid) return 'bg-blue-500';
  if (score >= thresholdLow) return 'bg-amber-500';
  return 'bg-rose-500';
};

/**
 * Get text color only (no background)
 * 0-100: >=80 emerald, >=60 blue, >=40 amber, <40 rose
 * 0-10:  >=8 emerald, >=6 blue, >=4 amber, <4 rose
 */
export const getScoreTextColor = (score, scale = 100) => {
  const thresholdHigh = scale === 10 ? 8 : 80;
  const thresholdMid = scale === 10 ? 6 : 60;
  const thresholdLow = scale === 10 ? 4 : 40;

  if (score >= thresholdHigh) return 'text-emerald-700';
  if (score >= thresholdMid) return 'text-blue-700';
  if (score >= thresholdLow) return 'text-amber-700';
  return 'text-rose-700';
};

/**
 * Get a visual label for a score range
 */
export const getScoreLabel = (score, scale = 100) => {
  const thresholdHigh = scale === 10 ? 8 : 80;
  const thresholdMid = scale === 10 ? 6 : 60;
  const thresholdLow = scale === 10 ? 4 : 40;

  if (score >= thresholdHigh) return 'Excellent';
  if (score >= thresholdMid) return 'Good';
  if (score >= thresholdLow) return 'Fair';
  return 'Needs Work';
};

/**
 * Income probability badge colors
 * Updated to match new design system
 */
export const getProbabilityColor = (level) => {
  const map = {
    High: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Medium: 'text-blue-700 bg-blue-50 border-blue-200',
    Low: 'text-amber-700 bg-amber-50 border-amber-200'
  };
  return map[level] || map.Low;
};

/**
 * Skill match bar color
 * Updated to match new design system
 */
export const getSkillMatchColor = (pct) => {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-amber-500';
};

/**
 * Skill match text label
 */
export const getSkillMatchLabel = (pct) => {
  if (pct >= 70) return 'Strong';
  if (pct >= 40) return 'Moderate';
  return 'Low';
};

/**
 * Format currency with USD
 */
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Format percentage cleanly
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Math.round(Number(value))}%`;
};

/**
 * Get demand badge color
 */
export const getDemandColor = (score) => {
  if (score >= 8) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (score >= 5) return 'text-blue-600 bg-blue-50/50 border-blue-100';
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

/**
 * Get competition badge color (inverted: lower is better)
 */
export const getCompetitionColor = (score) => {
  if (score <= 4) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score <= 6) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

/**
 * Get income speed badge color
 */
export const getIncomeSpeedColor = (score) => {
  if (score >= 8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 5) return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-amber-700 bg-amber-50 border-amber-200';
};

/**
 * Get future-proof badge color
 */
export const getFutureProofColor = (score) => {
  if (score >= 8) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  if (score >= 6) return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
};

/**
 * Get impact color for explainability factors
 */
export const getImpactColor = (impact) => {
  const map = {
    positive: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    neutral: 'text-blue-700 bg-blue-50 border-blue-200',
    negative: 'text-rose-700 bg-rose-50 border-rose-200'
  };
  return map[impact] || map.neutral;
};

/**
 * Get impact bar color
 */
export const getImpactBarColor = (impact) => {
  const map = {
    positive: 'bg-emerald-500',
    neutral: 'bg-blue-500',
    negative: 'bg-rose-500'
  };
  return map[impact] || map.neutral;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Format relative time
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};