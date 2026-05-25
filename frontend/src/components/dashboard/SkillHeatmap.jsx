/// Skill Heatmap Component
import React, { useMemo } from 'react';
import './SkillHeatmap.css';

/**
 * Skill Heatmap Grid
 * Visualizes demand vs supply for skills.
 */
export function SkillHeatmap({ data, userSkills = [] }) {
  const normalizedUserSkills = userSkills.map(s => s.toLowerCase());

  const cells = useMemo(() => {
    return data.map(item => {
      const isOwned = normalizedUserSkills.includes(item.skill_name?.toLowerCase());
      const demand = item.demand_growth_yoy || 0;
      
      let intensity = 'low';
      if (demand >= 2.0) intensity = 'very-high';
      else if (demand >= 1.0) intensity = 'high';
      else if (demand >= 0.2) intensity = 'medium';
      else if (demand >= 0) intensity = 'low';
      else intensity = 'negative';

      return {
        ...item,
        isOwned,
        intensity
      };
    });
  }, [data, normalizedUserSkills]);

  const getColor = (intensity) => {
    const map = {
      'very-high': '#16a34a',
      'high': '#22c55e',
      'medium': '#f59e0b',
      'low': '#64748b',
      'negative': '#ef4444'
    };
    return map[intensity] || '#64748b';
  };

  return (
    <div className="skill-heatmap">
      <div className="heatmap-legend">
        <span><span className="dot" style={{ background: '#16a34a' }}></span> Hot (+200%)</span>
        <span><span className="dot" style={{ background: '#22c55e' }}></span> Warm (+100%)</span>
        <span><span className="dot" style={{ background: '#f59e0b' }}></span> Stable (+20%)</span>
        <span><span className="dot" style={{ background: '#ef4444' }}></span> Cooling</span>
        <span><span className="dot" style={{ background: '#3b82f6' }}></span> Owned by you</span>
      </div>
      
      <div className="heatmap-grid">
        {cells.map(cell => (
          <div 
            key={cell.skill_name || cell.skill}
            className={`heatmap-cell ${cell.isOwned ? 'owned' : ''}`}
            style={{ 
              backgroundColor: cell.isOwned ? '#1e3a8a' : getColor(cell.intensity),
              opacity: cell.isOwned ? 1 : 0.9
            }}
            title={`${cell.skill_name || cell.skill}: ${(cell.demand_growth_yoy * 100).toFixed(0)}% growth`}
          >
            <span className="cell-name">{cell.skill_name || cell.skill}</span>
            <span className="cell-salary">
              ${((cell.avg_salary_cents || 0) / 1000000).toFixed(0)}k
            </span>
            {cell.isOwned && <span className="cell-badge">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}