// This component renders a radar chart comparing the top 3 opportunities across multiple factors.
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const RadarComparisonChart = ({ opportunities }) => {
  if (!opportunities?.length) return null;

  const data = [
    { factor: 'Demand', fullMark: 10 },
    { factor: 'Competition', fullMark: 10 },
    { factor: 'Income Speed', fullMark: 10 },
    { factor: 'Skill Match', fullMark: 100 },
  ];

  opportunities.slice(0, 3).forEach((opp, idx) => {
    data[0][opp.title] = opp.demand_score;
    data[1][opp.title] = opp.competition_score;
    data[2][opp.title] = opp.income_speed;
    data[3][opp.title] = opp.skill_match_percentage;
  });

  const colors = ['#eab308', '#6b7280', '#f97316']; // Gold, Silver, Bronze

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Multi-Factor Comparison</h3>
      <p className="text-sm text-gray-500 mb-4">Radar view of top 3 opportunities</p>
      
      <div className="h-[300px] md:h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis 
              dataKey="factor" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
            
            {opportunities.slice(0, 3).map((opp, idx) => (
              <Radar
                key={opp.id}
                name={`#${idx + 1} ${opp.title}`}
                dataKey={opp.title}
                stroke={colors[idx]}
                fill={colors[idx]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RadarComparisonChart;