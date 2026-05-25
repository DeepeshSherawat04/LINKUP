// This component displays a user's recent opportunity discovery history, showing the final score, skill match percentage, income probability level, and the date of analysis for each opportunity.
import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { format } from 'date-fns';

const UserHistoryPanel = ({ userId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('user_opportunity_scores')
        .select(`
          id, final_score, skill_match_percent, income_probability_level, created_at,
          opportunities:opportunity_id (title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setHistory(data || []);
      setLoading(false);
    };

    if (userId) fetchHistory();
  }, [userId]);

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  if (!history.length) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Previous Analysis</h3>
      <p className="text-sm text-gray-500 mb-4">Your opportunity discovery history</p>
      
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {history.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors border border-gray-100">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
              item.final_score >= 70 ? 'bg-emerald-100 text-emerald-700' :
              item.final_score >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              {item.final_score}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{item.opportunities?.title || 'Unknown'}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                <span>•</span>
                <span>Match: {item.skill_match_percent}%</span>
                <span>•</span>
                <span className={`font-medium ${
                  item.income_probability_level === 'High' ? 'text-green-600' :
                  item.income_probability_level === 'Medium' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{item.income_probability_level}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserHistoryPanel;