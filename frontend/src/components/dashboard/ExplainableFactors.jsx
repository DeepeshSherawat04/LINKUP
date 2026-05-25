// This component provides a detailed breakdown of the key factors contributing to an opportunity's score.
import { getScoreColor } from '../../utils/scoreUtils';

const ExplainableFactors = ({ opportunity }) => {
  if (!opportunity?.score_breakdown) return null;

  const factors = [
    {
      label: 'Skill Match',
      value: opportunity.skill_match_percentage,
      suffix: '%',
      impact: opportunity.skill_match_percentage > 70 ? 'High' : opportunity.skill_match_percentage > 40 ? 'Medium' : 'Low',
      description: 'How well your skills align with requirements',
      color: 'purple'
    },
    {
      label: 'Market Demand',
      value: opportunity.demand_score,
      suffix: '/10',
      impact: opportunity.demand_score > 7 ? 'Rising' : opportunity.demand_score > 4 ? 'Stable' : 'Low',
      description: 'Industry demand trend',
      color: 'blue'
    },
    {
      label: 'Competition Level',
      value: opportunity.competition_score,
      suffix: '/10',
      impact: opportunity.competition_score > 7 ? 'High' : opportunity.competition_score > 4 ? 'Medium' : 'Low',
      description: 'Market saturation index',
      color: 'red',
      inverse: true // Lower is better
    },
    {
      label: 'Income Velocity',
      value: opportunity.income_speed,
      suffix: '/10',
      impact: opportunity.income_speed > 7 ? 'Fast' : opportunity.income_speed > 4 ? 'Moderate' : 'Slow',
      description: 'Speed to first revenue',
      color: 'green'
    }
  ];

  const getImpactColor = (impact, inverse) => {
    const map = {
      'High': inverse ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50',
      'Rising': 'text-emerald-600 bg-emerald-50',
      'Fast': 'text-emerald-600 bg-emerald-50',
      'Medium': 'text-amber-600 bg-amber-50',
      'Stable': 'text-amber-600 bg-amber-50',
      'Moderate': 'text-amber-600 bg-amber-50',
      'Low': inverse ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50',
      'Slow': 'text-rose-600 bg-rose-50'
    };
    return map[impact] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Why This Opportunity?</h3>
      <p className="text-sm text-gray-500 mb-4">Factor analysis behind the ranking</p>
      
      <div className="space-y-3">
        {factors.map((factor) => (
          <div key={factor.label} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors">
            {/* Icon circle */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-${factor.color}-100`}>
              <span className={`text-${factor.color}-600 font-bold text-sm`}>
                {factor.value}{factor.suffix}
              </span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-gray-900 text-sm">{factor.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getImpactColor(factor.impact, factor.inverse)}`}>
                  {factor.impact}
                </span>
              </div>
              <p className="text-xs text-gray-500">{factor.description}</p>
            </div>
            
            {/* Mini bar */}
            <div className="w-16 md:w-24 shrink-0">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full bg-${factor.color}-500`}
                  style={{ width: `${factor.suffix === '%' ? factor.value : (factor.value / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExplainableFactors;