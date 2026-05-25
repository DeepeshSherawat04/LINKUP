// ScoreMeter.jsx
import { formatScore, getScoreBarColor, getScoreTextColor } from '../../utils/scoreUtils';

const ScoreMeter = ({ score, label = 'Score', scale = 100, showMax = true }) => {
  const safeScore = Math.min(scale, Math.max(0, Number(score) || 0));
  const percentage = (safeScore / scale) * 100;
  
  const barColor = getScoreBarColor(safeScore, scale);
  const textColor = getScoreTextColor(safeScore, scale);
  
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={`font-bold ${textColor}`}>
          {formatScore(safeScore, scale)}{showMax ? `/${scale}` : ''}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div 
          className={`h-2.5 rounded-full transition-all duration-700 ease-out ${barColor}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ScoreMeter;