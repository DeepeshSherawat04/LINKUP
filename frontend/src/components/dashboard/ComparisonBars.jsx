// ComparisonBars.jsx — NEW
// Priority 2: Horizontal progress bars for opportunity metrics

const ComparisonBars = ({ bars }) => {
  if (!bars) return null;

  const barConfig = {
    demand: { label: 'Market Demand', color: 'bg-blue-500', bg: 'bg-blue-100' },
    competition: { label: 'Competition Level', color: 'bg-rose-400', bg: 'bg-rose-100', inverted: true },
    skillMatch: { label: 'Skill Match', color: 'bg-purple-500', bg: 'bg-purple-100', max: 100 },
    incomeSpeed: { label: 'Income Speed', color: 'bg-green-500', bg: 'bg-green-100' },
    futureProof: { label: 'Future-Proof', color: 'bg-indigo-500', bg: 'bg-indigo-100' }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Score Breakdown</p>
      {Object.entries(bars).map(([key, bar]) => {
        const config = barConfig[key];
        if (!config) return null;

        const max = config.max || 10;
        const value = Number(bar.value) || 0;
        const displayValue = config.inverted ? max - value : value;
        const percentage = (displayValue / max) * 100;

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-24 flex-shrink-0 text-right font-medium">
              {config.label}
            </span>
            <div className={`flex-1 h-2 rounded-full ${config.bg} overflow-hidden`}>
              <div 
                className={`h-2 rounded-full ${config.color} transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-gray-700 w-8 flex-shrink-0">
              {displayValue}{max === 100 ? '%' : '/10'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ComparisonBars;