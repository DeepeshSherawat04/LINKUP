// ExplainabilityPanel.jsx — NEW
// Priority 3: "Why?" for every score — structured factor breakdown

const iconMap = {
  'check': (
    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  'warning': (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  'x': (
    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  'trending-up': (
    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  'minus': (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  ),
  'shield': (
    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  'users': (
    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  'dollar': (
    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'clock': (
    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'shield-check': (
    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
};

const impactColors = {
  positive: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  neutral: 'bg-blue-50 border-blue-200 text-blue-800',
  negative: 'bg-rose-50 border-rose-200 text-rose-800'
};

const impactLabels = {
  positive: 'Strength',
  neutral: 'Moderate',
  negative: 'Gap'
};

const ExplainabilityPanel = ({ data }) => {
  if (!data) return null;

  const { overall_score, overall_rating, factors, summary } = data;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-800">Why This Ranked Here</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">{summary}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-gray-900">{overall_score}</span>
            <span className="text-xs text-gray-400">/100</span>
            <p className="text-[10px] font-medium text-gray-500">{overall_rating}</p>
          </div>
        </div>
      </div>

      {/* Factors */}
      <div className="divide-y divide-gray-100">
        {factors?.map((factor, index) => (
          <div 
            key={index} 
            className={`px-4 py-3 flex items-start gap-3 ${impactColors[factor.impact]}`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {iconMap[factor.icon] || iconMap['check']}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">{factor.factor}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/60 font-medium">
                  {impactLabels[factor.impact]}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{factor.explanation}</p>

              {/* Mini progress bar for factor score */}
              <div className="mt-1.5 w-full bg-white/40 rounded-full h-1">
                <div 
                  className={`h-1 rounded-full transition-all ${
                    factor.impact === 'positive' ? 'bg-emerald-400' : 
                    factor.impact === 'neutral' ? 'bg-blue-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${factor.score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExplainabilityPanel;