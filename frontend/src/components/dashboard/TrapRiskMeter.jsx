import React from 'react';

/**
 * Trap Risk Visualization Component
 */
export function TrapRiskMeter({ score, breakdown }) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const color = breakdown?.color || (score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e');
  
  return (
    <div className="trap-risk-meter" title={`Trap Risk: ${score}/100`}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
        />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="40"
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize="18"
          fontWeight="bold"
        >
          {score}
        </text>
      </svg>
      <span className="trap-label" style={{ color }}>{breakdown?.label || 'Risk'}</span>
    </div>
  );
}