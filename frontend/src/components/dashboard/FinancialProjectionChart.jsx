import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

/**
 * 24-Month Financial Projection Chart
 * Uses Recharts for production visualization.
 */
export function FinancialProjectionChart({ scenarios }) {
  const data = useMemo(() => {
    if (!scenarios?.length) return [];
    
    const months = Array.from({ length: 24 }, (_, i) => i + 1);
    
    return months.map(month => {
      const point = { month: `M${month}` };
      scenarios.forEach(scenario => {
        const monthData = scenario.projection[month - 1];
        if (monthData) {
          // Convert cents to dollars for display
          point[scenario.type] = monthData.disposable_cents / 100;
        }
      });
      return point;
    });
  }, [scenarios]);

  const colors = {
    startup: '#ef4444',
    big_tech: '#22c55e',
    remote: '#3b82f6'
  };

  if (!data.length) return <div className="chart-empty">No projection data</div>;

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={12}
            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(value) => [`$${value.toLocaleString()}`, 'Disposable Income']}
          />
          <Legend wrapperStyle={{ color: '#cbd5e1' }} />
          
          {scenarios.map(scenario => (
            <Line
              key={scenario.type}
              type="monotone"
              dataKey={scenario.type}
              stroke={colors[scenario.type] || '#8884d8'}
              strokeWidth={2}
              dot={false}
              name={scenario.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}