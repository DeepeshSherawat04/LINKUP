// RadarMiniChart.jsx — NEW
// Priority 2: Visual radar chart for 6-dimension opportunity analysis

const RadarMiniChart = ({ data }) => {
  if (!data) return null;

  const dimensions = [
    { key: 'demand', label: 'Demand', color: '#3B82F6' },
    { key: 'competition', label: 'Competition', color: '#F87171', inverted: true },
    { key: 'skillMatch', label: 'Skills', color: '#A855F7' },
    { key: 'incomeSpeed', label: 'Speed', color: '#10B981' },
    { key: 'futureProof', label: 'Future', color: '#6366F1' },
    { key: 'barrierToEntry', label: 'Barrier', color: '#F59E0B', inverted: true }
  ];

  const size = 140;
  const center = size / 2;
  const radius = size / 2 - 20;
  const angleStep = (Math.PI * 2) / dimensions.length;

  // Build polygon points
  const points = dimensions.map((dim, i) => {
    const value = data[dim.key] || 5;
    const normalized = (value / 10) * radius;
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: center + normalized * Math.cos(angle),
      y: center + normalized * Math.sin(angle),
      label: dim.label,
      value,
      color: dim.color
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Grid circles
  const gridLevels = [2, 4, 6, 8, 10];

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="flex-shrink-0">
        {/* Background grid */}
        {gridLevels.map(level => {
          const r = (level / 10) * radius;
          return (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Axis lines */}
        {dimensions.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3B82F6"
          strokeWidth="1.5"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={p.color}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex-1 space-y-1.5">
        {dimensions.map((dim, i) => {
          const value = data[dim.key] || 5;
          const displayValue = dim.inverted ? 10 - value : value;
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: dim.color }}
                />
                <span className="text-gray-600">{dim.label}</span>
              </div>
              <span className="font-bold text-gray-800">{displayValue}/10</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RadarMiniChart;