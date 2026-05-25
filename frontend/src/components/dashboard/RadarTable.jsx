// RadarTable.jsx — UPGRADED v2.0
// Priority 2: Analytical comparison table with progress bars

import { useState } from 'react';

const RadarTable = ({ opportunities }) => {
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  if (!opportunities?.length) return null;

  const sorted = [...opportunities].sort((a, b) => {
    const aVal = a[sortKey] || a.score_breakdown?.[sortKey]?.value || 0;
    const bVal = b[sortKey] || b.score_breakdown?.[sortKey]?.value || 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1 font-bold">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-800">📊 Opportunity Comparison Matrix</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">Click column headers to sort • All scores out of 10</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 bg-gray-50/50">
              <th className="px-4 py-3 font-semibold text-xs">Opportunity</th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('score')}
              >
                Overall {SortIcon('score')}
              </th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('demand_score')}
              >
                Demand {SortIcon('demand_score')}
              </th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('competition_score')}
              >
                Competition {SortIcon('competition_score')}
              </th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('skill_match_percentage')}
              >
                Skill Match {SortIcon('skill_match_percentage')}
              </th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('income_speed')}
              >
                Speed {SortIcon('income_speed')}
              </th>
              <th 
                className="px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-600 transition-colors text-center"
                onClick={() => handleSort('future_proof_rating')}
              >
                Future-Proof {SortIcon('future_proof_rating')}
              </th>
              <th className="px-4 py-3 font-semibold text-xs text-center">Income Prob</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((opp) => {
              const prob = opp.income_probability || {};
              const scoreColor = opp.score >= 80 ? 'bg-emerald-500' : opp.score >= 60 ? 'bg-blue-500' : opp.score >= 40 ? 'bg-amber-500' : 'bg-rose-500';

              return (
                <tr key={opp.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-xs">{opp.title}</p>
                      {opp.category && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{opp.category}</p>
                      )}
                    </div>
                  </td>

                  {/* Overall Score with Progress Bar */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-bold text-gray-900">{opp.score}</span>
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className={`${scoreColor} h-1.5 rounded-full transition-all`} style={{ width: `${opp.score}%` }} />
                      </div>
                    </div>
                  </td>

                  {/* Demand */}
                  <td className="px-4 py-3 text-center">
                    <MetricBar value={opp.demand_score} color="bg-blue-500" />
                  </td>

                  {/* Competition (Inverted: lower is better) */}
                  <td className="px-4 py-3 text-center">
                    <MetricBar value={opp.competition_score} color="bg-rose-400" invert />
                  </td>

                  {/* Skill Match */}
                  <td className="px-4 py-3 text-center">
                    <MetricBar value={opp.skill_match_percentage} max={100} color="bg-purple-500" />
                  </td>

                  {/* Income Speed */}
                  <td className="px-4 py-3 text-center">
                    <MetricBar value={opp.income_speed} color="bg-green-500" />
                  </td>

                  {/* Future-Proof */}
                  <td className="px-4 py-3 text-center">
                    <MetricBar value={opp.future_proof_rating} color="bg-indigo-500" />
                  </td>

                  {/* Income Probability Badge */}
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${
                      prob.level === 'High' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      prob.level === 'Medium' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {prob.level || 'N/A'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * MetricBar — Visual progress bar for each metric
 */
const MetricBar = ({ value, max = 10, color, invert = false }) => {
  const numValue = Number(value) || 0;
  const percentage = (numValue / max) * 100;
  const displayValue = invert ? max - numValue : numValue;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold text-gray-700">{displayValue}{max === 10 ? '/10' : '%'}</span>
      <div className="w-12 bg-gray-100 rounded-full h-1.5">
        <div 
          className={`${color} h-1.5 rounded-full transition-all duration-500`} 
          style={{ width: `${invert ? 100 - percentage : percentage}%` }} 
        />
      </div>
    </div>
  );
};

export default RadarTable;