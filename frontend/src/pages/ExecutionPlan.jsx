// ExecutionPlan.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOpportunityRadar, useExecutionPlan } from '../hooks/useOpportunity';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';

const ExecutionPlan = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('opportunity');

  const { data: opportunities, loading: loadingList, error: listError } = useOpportunityRadar();
  const { plan, simulation, loading, error, generate } = useExecutionPlan();

  const [selectedId, setSelectedId] = useState('');
  const [activeWeek, setActiveWeek] = useState(0);

  useEffect(() => {
    if (!opportunities.length) return;
    if (preselectedId && opportunities.find((o) => o.id === preselectedId)) {
      setSelectedId(preselectedId);
    } //else if (opportunities[0]) {
    //  setSelectedId(opportunities[0].id);
   // }
  }, [opportunities, preselectedId]);

  const handleGenerate = () => {
  if (!selectedId) return;
  generate(selectedId, {
    goal_type: 'freelance',
    time_per_week: 15,
  });
};

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <EmptyState
          title="Authentication Required"
          description="Sign in with Google to generate personalized 30-day execution plans powered by AI."
          actionLabel="Sign In →"
          actionPath="/profile"
          icon="🔐"
        />
      </div>
    );
  }

  if (loadingList) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <LoadingSkeleton type="plan" />
      </div>
    );
  }

  const selectedOpp = opportunities.find((o) => o.id === selectedId);
  const displayError = error || listError;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-12 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">30-Day Execution Plan</h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">
          AI-generated roadmap based on your profile and target opportunity
        </p>
      </div>

      {/* Selector Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Target Opportunity
            </label>
            <select
  value={selectedId}
  onChange={(e) => setSelectedId(e.target.value)}
  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 text-sm bg-white"
>
  <option value="">-- Select an opportunity --</option>
  {opportunities.map((opp) => (
    <option key={opp.id} value={opp.id}>
      {opp.title} (Score: {opp.score ?? '—'} • Match: {opp.skill_match_percentage ?? '—'}%)
    </option>
  ))}
</select>
          </div>

         {selectedOpp && (
  <div className="flex items-end">
    <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-center">
      <p className="text-xs text-gray-500">Income Potential</p>
      <p className="font-bold text-gray-900">
        {selectedOpp.income_potential
          ? `$${selectedOpp.income_potential.toLocaleString()}`
          : '—'}
      </p>
    </div>
  </div>
)}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !selectedId}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Generating AI Plan...
            </>
          ) : (
            <>🤖 Generate 30-Day Plan</>
          )}
        </button>

        {displayError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between animate-in fade-in">
            <span>{displayError}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && !plan && <LoadingSkeleton type="plan" />}

      {/* Income Simulation */}
      {simulation && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Income Projection</h2>
              <p className="text-xs text-gray-500">6-month forecast with confidence intervals</p>
            </div>
            <span
              className={`text-xs px-3 py-1.5 rounded-full border font-bold w-fit ${getProbabilityBadge(
                simulation.income_probability?.level
              )}`}
            >
              {simulation.income_probability?.level} Probability •{' '}
              {simulation.income_probability?.range}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            {simulation.projection?.slice(0, 4).map((month) => (
              <div
                key={month.month}
                className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100"
              >
                <p className="text-xs text-gray-500 mb-1">Month {month.month}</p>
                <p className="font-bold text-gray-900 text-sm md:text-base">
                  ${month.estimatedIncome.toLocaleString()}
                </p>
                <div className="mt-1.5">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${month.confidence}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-0.5">{month.confidence}% confidence</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="font-semibold text-blue-900 text-sm mb-2">AI Recommendations</p>
            <ul className="space-y-1.5">
              {simulation.summary?.recommendedActions?.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* AI Plan - Week by Week */}
      {plan && plan.weeks && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Your 30-Day Roadmap</h2>
            {plan.message && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 font-medium">
                {plan.message}
              </span>
            )}
          </div>

          {/* Week Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {plan.weeks.map((week, idx) => (
              <button
                key={idx}
                onClick={() => setActiveWeek(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeWeek === idx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Week {week.week}
              </button>
            ))}
          </div>

          {/* Active Week Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            {plan.weeks[activeWeek] && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">{plan.weeks[activeWeek].week}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{plan.weeks[activeWeek].focus}</h3>
                    <p className="text-xs text-gray-500">Week {plan.weeks[activeWeek].week} of 4</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {plan.weeks[activeWeek].tasks?.map((task, j) => (
                    <div
                      key={j}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {j + 1}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{task}</p>
                    </div>
                  ))}
                </div>

                {/* Progress indicator */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Overall Progress</span>
                    <span>{(((activeWeek + 1) / 4) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${((activeWeek + 1) / 4) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* How It Works (empty state) */}
      {!plan && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 space-y-4">
          <h3 className="font-bold text-gray-900">How AI Plan Generation Works</h3>
          {[
            {
              step: 1,
              title: 'Skill Assessment',
              desc: 'AI analyzes your skills against opportunity requirements',
              icon: '📊',
            },
            {
              step: 2,
              title: 'Gap Analysis',
              desc: 'Identifies missing skills and creates learning priorities',
              icon: '🔍',
            },
            {
              step: 3,
              title: 'Timeline Creation',
              desc: 'Builds week-by-week actionable milestones',
              icon: '📅',
            },
            {
              step: 4,
              title: 'Income Modeling',
              desc: 'Projects realistic earnings based on your commitment',
              icon: '💰',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 text-lg">
                {item.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const getProbabilityBadge = (level) => {
  const map = {
    High: 'bg-green-100 text-green-700 border-green-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[level] || map.Low;
};

export default ExecutionPlan;