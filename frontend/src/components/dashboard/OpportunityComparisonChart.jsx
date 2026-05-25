import { useMemo } from 'react';

const OpportunityComparisonChart = ({ opportunities }) => {
  const metrics = [
    { key: 'demand_score', label: 'Demand', color: '#3b82f6' },
    { key: 'competition_score', label: 'Competition', color: '#ef4444' },
    { key: 'income_speed', label: 'Income Speed', color: '#22c55e' },
    { key: 'skill_match_percentage', label: 'Skill Match', color: '#a855f7' }
  ];

  const maxValue = 10;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
      <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Opportunity Comparison</h2>
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.key}>
            <div className="flex justify-between text-xs text-gray-600 mb-1.5">
              <span className="font-medium">{metric.label}</span>
              <span className="text-gray-400">0–10 scale</span>
            </div>
            <div className="space-y-1.5">
              {opportunities.map((opp, idx) => {
                const value = metric.key === 'skill_match_percentage' 
                  ? (opp[metric.key] || 0) / 10 
                  : (opp[metric.key] || 0);
                const pct = (value / maxValue) * 100;
                const rankColors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-400'];
                
                return (
                  <div key={opp.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ 
                          width: `${pct}%`, 
                          backgroundColor: metric.color,
                          opacity: 1 - (idx * 0.2)
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-8 text-right">
                      {metric.key === 'skill_match_percentage' 
                        ? `${opp[metric.key] || 0}%` 
                        : value.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
        {opportunities.map((opp, idx) => (
          <div key={opp.id} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}></span>
            <span className="text-xs text-gray-600 font-medium truncate max-w-[120px]">{opp.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OpportunityComparisonChart;