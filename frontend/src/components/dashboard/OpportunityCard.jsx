// OpportunityCard.jsx — UPGRADED v2.0
// Priority 2: Analytical visuals | Priority 3: Explainability | Priority 4: Error resilience

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScoreMeter from './ScoreMeter';
import ExplainabilityPanel from './ExplainabilityPanel';
import RadarMiniChart from './RadarMiniChart';
import ComparisonBars from './ComparisonBars';
import { formatCurrency, getProbabilityColor, getSkillMatchColor } from '../../utils/scoreUtils';
import { useWhyNotPath } from '../../hooks/useOpportunity';
import HistoricalComparison from './HistoricalComparison';
import { useAuth } from '../../context/AuthContext';

const OpportunityCard = ({ opportunity, rank, onSelect }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showWhyNot, setShowWhyNot] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: whyNotData, loading: whyNotLoading, error: whyNotError, fetchWhyNot } = useWhyNotPath();

  const rankBadge = [
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-gray-100 text-gray-800 border-gray-200',
    'bg-orange-100 text-orange-800 border-orange-200'
  ];

  const handleWhyNot = async () => {
    if (!whyNotData && !whyNotLoading) await fetchWhyNot(opportunity.id);
    setShowWhyNot(true);
  };

  const aiExplanation = opportunity.ai_explanation;
  const explainability = opportunity.explainability;
  const skillMatch = opportunity.skill_match_percentage || 0;
  const incomeProb = opportunity.income_probability;
  const scoreVisual = opportunity.score_visual;
  const comparisonBars = opportunity.comparison_bars;
  const radarData = opportunity.radar_data;

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300 flex flex-col h-full"
      onClick={onSelect}
    >
      {/* ─── HEADER ─── */}
      <div className="mb-3 md:mb-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${rankBadge[rank - 1]}`}>
            #{rank}
          </span>
          {opportunity.category && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium uppercase tracking-wide">
              {opportunity.category}
            </span>
          )}
          {incomeProb && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${getProbabilityColor(incomeProb.level)}`}>
              {incomeProb.level}
            </span>
          )}
        </div>
        <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">{opportunity.title}</h3>
        {opportunity.market_trend && (
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{opportunity.market_trend}</p>
        )}
      </div>

      {/* ─── SCORE METER (Priority 2) ─── */}
      <ScoreMeter 
        score={opportunity.score} 
        label={scoreVisual?.label || 'Score'} 
        scale={100}
        color={scoreVisual?.color}
      />

      {/* ─── SKILL MATCH BAR (Priority 2) ─── */}
      <div className="mt-3 md:mt-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-600 font-semibold">Skill Match</span>
          <span className={`font-bold ${skillMatch >= 70 ? 'text-emerald-600' : skillMatch >= 40 ? 'text-blue-600' : 'text-amber-600'}`}>
            {skillMatch}% — {opportunity.skill_match_visual?.label || (skillMatch >= 70 ? 'Strong' : skillMatch >= 40 ? 'Moderate' : 'Low')}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full transition-all duration-700 ease-out ${getSkillMatchColor(skillMatch)}`}
            style={{ width: `${skillMatch}%` }}
          />
        </div>
      </div>

      {/* ─── COMPARISON BARS (Priority 2: Analytical) ─── */}
      {comparisonBars && (
        <div className="mt-3 md:mt-4">
          <ComparisonBars bars={comparisonBars} />
        </div>
      )}

      {/* ─── MINI RADAR (Priority 2: Visual Intelligence) ─── */}
      {radarData && (
        <div className="mt-3 md:mt-4">
          <RadarMiniChart data={radarData} />
        </div>
      )}

      {/* ─── METRICS GRID ─── */}
      <div className="mt-3 md:mt-4 grid grid-cols-3 gap-2 text-center">
        <MetricBox label="Demand" value={opportunity.demand_score} bg="bg-blue-50" text="text-blue-700" />
        <MetricBox label="Competition" value={opportunity.competition_score} bg="bg-red-50" text="text-red-700" />
        <MetricBox label="Income Speed" value={opportunity.income_speed} bg="bg-green-50" text="text-green-700" />
      </div>

      {/* ─── INCOME POTENTIAL ─── */}
      <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 font-semibold">Income Potential</p>
          <p className="text-xs text-gray-400">{incomeProb?.range}</p>
        </div>
        <p className="text-lg md:text-xl font-bold text-gray-900">{formatCurrency(opportunity.income_potential)}</p>
        {opportunity.time_to_first_income && (
          <p className="text-[11px] text-gray-400 mt-0.5">First income: {opportunity.time_to_first_income}</p>
        )}
      </div>

      {/* ─── AI EXPLANATION (Priority 3) ─── */}
      {aiExplanation && (
        <div className="mt-3 md:mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-bold text-purple-800">AI Analysis</span>
            {aiExplanation.fallback && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Fallback</span>
            )}
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{aiExplanation.summary}</p>
          <p className="text-xs text-purple-600 mt-1 italic">{aiExplanation.timeline}</p>
          {aiExplanation.market_edge && (
            <p className="text-[11px] text-indigo-600 mt-1">📈 {aiExplanation.market_edge}</p>
          )}
        </div>
      )}

      {/* ─── EXPLAINABILITY TOGGLE (Priority 3) ─── */}
      {explainability && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowExplain(!showExplain); }}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
        >
          <span>{showExplain ? '▾' : '▸'}</span>
          {showExplain ? 'Hide' : 'Show'} Why This Ranked Here
        </button>
      )}
      {showExplain && explainability && (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <ExplainabilityPanel data={explainability} />
        </div>
      )}

      {/* ─── HISTORICAL TOGGLE ─── */}
      {user && rank === 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {showHistory ? '▾ Hide' : '▸ Show'} Score History
        </button>
      )}
      {showHistory && user && (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <HistoricalComparison 
            userId={user.id} 
            opportunityId={opportunity.id}
            currentScore={opportunity.score}
          />
        </div>
      )}

      {/* ─── ACTIONS ─── */}
      <div className="mt-auto pt-4 md:pt-5 flex gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(`/plan?opportunity=${opportunity.id}`); }}
          className="flex-1 bg-blue-600 text-white text-sm font-bold py-2.5 md:py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
        >
          Get Execution Plan
        </button>
        {rank > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleWhyNot(); }}
            disabled={whyNotLoading}
            className="px-3.5 py-2.5 md:px-4 md:py-3 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 font-medium"
            title="Why isn't this ranked #1?"
          >
            {whyNotLoading ? '...' : 'Why Not?'}
          </button>
        )}
      </div>

      {/* ─── WHY NOT MODAL (Priority 3 + 4) ─── */}
      {showWhyNot && (
        <WhyNotModal 
          data={whyNotData} 
          error={whyNotError}
          loading={whyNotLoading}
          onClose={() => setShowWhyNot(false)} 
        />
      )}
    </div>
  );
};

/**
 * Why Not Modal — Enhanced with structured reasons (Priority 3)
 */
const WhyNotModal = ({ data, error, loading, onClose }) => {
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 mx-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-600">Analyzing your path...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Analysis Unavailable</h3>
          <p className="text-sm text-gray-600 mb-4">{error.message || 'Unable to analyze this path.'}</p>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const iconMap = {
    skills: '🎯',
    competition: '⚔️',
    income: '💰',
    demand: '📉',
    info: 'ℹ️'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Why Not This Path?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-semibold text-gray-900">{data.opportunity_title}</span>{' '}
          scores <span className="font-bold text-red-600">{data.overall_score}</span>/100
        </p>

        {/* Structured Reasons (Priority 3) */}
        <div className="space-y-3 mb-4">
          {data.reasons?.map((reason, i) => (
            <div key={i} className="bg-red-50 rounded-lg p-3 border border-red-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{iconMap[reason.icon] || '•'}</span>
                <span className="text-sm font-bold text-red-800">{reason.title}</span>
              </div>
              <p className="text-sm text-gray-700 ml-7">{reason.detail}</p>
            </div>
          ))}
        </div>

        {/* Suggestions (Priority 3) */}
        {data.suggestions?.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mb-4">
            <p className="text-sm font-bold text-blue-800 mb-2">💡 How to Improve</p>
            <ul className="space-y-1.5">
              {data.suggestions.map((suggestion, i) => (
                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="mt-0.5">→</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Plan */}
        {data.action_plan && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 mb-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Action Plan: </span>
              {data.action_plan}
            </p>
          </div>
        )}

        <button 
          onClick={onClose}
          className="w-full bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Got It
        </button>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, bg, text }) => (
  <div className={`${bg} rounded-lg p-2`}>
    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
    <p className={`font-bold ${text} text-sm`}>{value ?? '-'}/10</p>
  </div>
);

export default OpportunityCard;