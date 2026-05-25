/// Skill Arbitrage Panel
import React, { useState, useEffect, useCallback } from 'react';
import { arbitrageApi } from '../../api/arbitrageApi';
import { SkillHeatmap } from './SkillHeatmap';
import './SkillArbitragePanel.css';

/**
 * Skill Arbitrage Radar Panel
 * Live market gap finder.
 */
export function SkillArbitragePanel({ userSkills = [] }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [learningPlan, setLearningPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await arbitrageApi.getOpportunities(userSkills);
      setData(response.data);
    } catch (err) {
      setError('Failed to load market data. Cron job may be syncing.');
      console.error('[SkillArbitragePanel]', err);
    } finally {
      setLoading(false);
    }
  }, [userSkills]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSkillClick = useCallback(async (skillName) => {
    setSelectedSkill(skillName);
    setPlanLoading(true);
    try {
      const res = await arbitrageApi.getLearningPlan(skillName);
      setLearningPlan(res.data);
    } catch (err) {
      console.error('[SkillArbitragePanel] Learning plan error:', err);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const handleTrackSkill = useCallback(async (skillName) => {
    try {
      await arbitrageApi.trackSkill(skillName, 'learning');
      alert(`Added ${skillName} to your learning queue!`);
    } catch (err) {
      console.error('[SkillArbitragePanel] Track error:', err);
    }
  }, []);

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(cents / 100);
  };

  if (loading) return <div className="arbitrage-loading">Loading live market data...</div>;
  if (error) return <div className="arbitrage-error" role="alert">{error}</div>;
  if (!data) return null;

  return (
    <div className="skill-arbitrage-panel">
      <div className="panel-header">
        <h2>🚀 Skill Arbitrage Radar</h2>
        <p className="panel-subtitle">
          Live market data • Last updated: {new Date(data.last_updated).toLocaleString()}
        </p>
      </div>

      <div className="arbitrage-layout">
        <div className="opportunities-column">
          <h3>Hot Arbitrage Opportunities</h3>
          <div className="opportunity-list">
            {data.opportunities.map(opp => (
              <div 
                key={opp.skill_name} 
                className="opportunity-card"
                onClick={() => handleSkillClick(opp.skill_name)}
                role="button"
                tabIndex={0}
              >
                <div className="opp-header">
                  <span className="opp-skill">{opp.skill_name}</span>
                  <span className="opp-score" style={{ 
                    background: opp.arbitrage_score >= 80 ? '#22c55e' : opp.arbitrage_score >= 50 ? '#f59e0b' : '#3b82f6'
                  }}>
                    Score: {opp.arbitrage_score}
                  </span>
                </div>
                <div className="opp-stats">
                  <span>📈 {((opp.demand_growth_yoy) * 100).toFixed(0)}% YoY demand</span>
                  <span>💰 {formatCurrency(opp.avg_salary_cents)} avg</span>
                  <span>⏱️ {opp.learning_days_estimate}d to learn</span>
                </div>
                <div className="opp-confidence">
                  Confidence: <strong>{opp.market_confidence}</strong> ({opp.demand_count.toLocaleString()} jobs)
                </div>
                <button 
                  className="track-btn"
                  onClick={(e) => { e.stopPropagation(); handleTrackSkill(opp.skill_name); }}
                >
                  Start 30-Day Plan
                </button>
              </div>
            ))}
          </div>

          {data.cooling.length > 0 && (
            <div className="cooling-section">
              <h3>⚠️ Cooling Skills (Avoid)</h3>
              <div className="cooling-list">
                {data.cooling.map(skill => (
                  <div key={skill.skill_name} className="cooling-card">
                    <span>{skill.skill_name}</span>
                    <span className="cooling-stat">
                      {((skill.demand_growth_yoy) * 100).toFixed(0)}% demand • Oversupplied
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="heatmap-column">
          <h3>Your Skill Heatmap</h3>
          <SkillHeatmap 
            data={data.owned_skills.concat(data.opportunities.slice(0, 20))} 
            userSkills={userSkills}
          />
        </div>
      </div>

      {selectedSkill && (
        <div className="learning-modal">
          <div className="modal-content">
            <button className="modal-close" onClick={() => { setSelectedSkill(null); setLearningPlan(null); }}>×</button>
            <h3>30-Day Plan: {selectedSkill}</h3>
            
            {planLoading ? (
              <div className="plan-loading">Generating learning path...</div>
            ) : learningPlan ? (
              <div className="plan-details">
                <div className="plan-meta">
                  <span>Category: {learningPlan.category}</span>
                  <span>Est. Salary Bump: {formatCurrency(learningPlan.estimated_salary_bump_cents)}</span>
                </div>
                
                <div className="milestones">
                  {learningPlan.plan.milestones.map(m => (
                    <div key={m.week} className="milestone">
                      <div className="milestone-week">Week {m.week}</div>
                      <div className="milestone-focus">{m.focus}</div>
                      <div className="milestone-deliverable">🎯 {m.deliverable}</div>
                    </div>
                  ))}
                </div>

                <div className="capstone">
                  <strong>Capstone:</strong> {learningPlan.plan.capstone_project}
                </div>

                <button 
                  className="track-btn primary"
                  onClick={() => handleTrackSkill(selectedSkill)}
                >
                  Add to My Learning Queue
                </button>
              </div>
            ) : (
              <div className="plan-error">Failed to load learning plan.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}