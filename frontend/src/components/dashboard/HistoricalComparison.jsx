// HistoricalComparison.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { formatScore, getScoreColor } from '../../utils/scoreUtils';

const HistoricalComparison = ({ userId, opportunityId, currentScore }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('user_opportunity_scores')
          .select('final_score, skill_match_percent, created_at')
          .eq('user_id', userId)
          .eq('opportunity_id', opportunityId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setHistory(data || []);
      } catch (e) {
        console.log('History fetch error:', e.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId && opportunityId) fetchHistory();
  }, [userId, opportunityId]);

  if (loading || history.length < 2) return null;

  const previousScore = history[1]?.final_score;
  const scoreChange = currentScore - previousScore;
  const percentChange = previousScore > 0 ? Math.round((scoreChange / previousScore) * 100) : 0;

  const trend = scoreChange > 0 ? 'improved' : scoreChange < 0 ? 'declined' : 'stable';
  const trendColor = scoreChange > 0 ? 'text-emerald-600' : scoreChange < 0 ? 'text-rose-600' : 'text-gray-500';
  const trendIcon = scoreChange > 0 ? '↑' : scoreChange < 0 ? '↓' : '→';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Score Trend</p>
          <p className="text-sm text-gray-700 mt-0.5">
            vs. last assessment ({new Date(history[1]?.created_at).toLocaleDateString()})
          </p>
        </div>
        <div className={`text-right ${trendColor}`}>
          <p className="text-2xl font-bold">
            {trendIcon} {Math.abs(percentChange)}%
          </p>
          <p className="text-xs font-medium capitalize">{trend}</p>
        </div>
      </div>
      
      {/* Mini sparkline */}
      <div className="mt-3 flex items-end gap-1 h-8">
        {history.slice().reverse().map((h, i) => (
          <div 
            key={i}
            className="flex-1 bg-blue-200 rounded-sm transition-all"
            style={{ 
              height: `${(h.final_score / 100) * 100}%`,
              opacity: i === history.length - 1 ? 1 : 0.5
            }}
            title={`${h.final_score} on ${new Date(h.created_at).toLocaleDateString()}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HistoricalComparison;