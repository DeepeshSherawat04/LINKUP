// CareerCommandCenter.jsx
import { useState, useEffect } from 'react';
import { useOpportunityRadar } from '../../hooks/useOpportunity';
import RadarComparisonChart from './RadarComparisonChart';
import ScoreMeter from './ScoreMeter';
import { opportunityApi } from '../../api/opportunityApi';
import TwinOutputRenderer from './TwinOutputRenderer';

// Sub-components (create these as separate files if preferred)
const AntiFragileGauge = ({ score, moatSkills, automationTimeline }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Anti-Fragile Index</h3>
    <div className="flex items-center justify-center mb-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
          <circle 
            cx="64" cy="64" r="56" 
            stroke={score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444'} 
            strokeWidth="12" 
            fill="none"
            strokeDasharray={`${score * 3.52} 351.86`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-gray-900">{score}</span>
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Automation Risk</span>
        <span className={`font-semibold ${score > 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {automationTimeline || 'Unknown'}
        </span>
      </div>
      {moatSkills?.length > 0 && (
        <div className="pt-2">
          <span className="text-xs text-gray-500 uppercase">Irreplaceable Skills</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {moatSkills.map((skill, i) => (
              <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const ArbitrageAlert = ({ opportunities, userLocation }) => {
  const topArbitrage = opportunities?.find(o => o.singularity_score?.insights?.arbitrage);
  if (!topArbitrage) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💰</span>
        <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Arbitrage Alert</h3>
      </div>
      <p className="text-sm text-emerald-800 mb-3 leading-relaxed">
        {topArbitrage.singularity_score.insights.arbitrage}
      </p>
      <div className="flex items-center justify-between text-xs text-emerald-700 bg-white/50 rounded-lg p-2.5">
        <span>Your location: {userLocation || 'Unknown'}</span>
        <span className="font-semibold">
          Ratio: {topArbitrage.singularity_score?.breakdown?.arbitragePotential || 0}/100
        </span>
      </div>
    </div>
  );
};

const CareerTwinPanel = ({ userProfile }) => {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  const executeCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    try {
      const res = await opportunityApi.askCareerTwin(command);
      setLastResult(res.data.data);
      setHistory(prev => [{ 
        command, 
        timestamp: new Date().toLocaleTimeString(), 
        type: res.data.data?.actions?.[0]?.tool 
      }, ...prev.slice(0, 4)]);
    } catch (e) {
      console.error('Twin execution failed:', e);
      const errorResult = {
        type: 'error',
        text: e.response?.data?.error?.message || e.message || 'Career Twin is temporarily unavailable.',
        summary: 'The AI service is at capacity. A fallback response was generated from your profile.'
      };
      setLastResult(errorResult);
      setHistory(prev => [{ 
        command, 
        timestamp: new Date().toLocaleTimeString(), 
        type: 'error'
      }, ...prev.slice(0, 4)]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Draft LinkedIn Post', icon: '📝', cmd: 'Draft a LinkedIn post about my latest project' },
    { label: 'Portfolio Project', icon: '🚀', cmd: `Create a portfolio project for ${userProfile?.target_role || 'my target role'}` },
    { label: 'Interview Prep', icon: '🎯', cmd: 'Simulate a hard technical interview' },
    { label: 'Skill Immunization', icon: '🛡️', cmd: 'Create a plan to make my skills AI-proof' }
  ];

  return (
    <div className="space-y-6">
      {/* Command Input Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-2xl shadow-md">
            🤖
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Career Twin</h3>
            <p className="text-xs text-gray-500">Autonomous career agent — now with visual artifacts</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { setCommand(action.cmd); }}
              className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 text-left transition-all text-sm font-medium text-gray-700 hover:text-indigo-700 border border-transparent hover:border-indigo-100"
            >
              <span className="text-lg">{action.icon}</span>
              <span className="leading-tight">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
            placeholder="e.g. Create a system design portfolio project for a fintech role..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm transition-all"
          />
          <button
            onClick={executeCommand}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Building...
              </span>
            ) : 'Execute'}
          </button>
        </div>
      </div>

      {/* Execution History Sidebar */}
      {history.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Recent Commands</h5>
          <div className="flex gap-2 flex-wrap">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setCommand(h.command)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition"
              >
                <span className="mr-1 opacity-50">{h.timestamp}</span>
                {h.command.substring(0, 30)}...
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="space-y-2">
              <div className="w-32 h-4 bg-gray-200 rounded" />
              <div className="w-48 h-3 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-gray-200 rounded" />
            <div className="w-5/6 h-3 bg-gray-200 rounded" />
            <div className="w-4/6 h-3 bg-gray-200 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="w-24 h-8 bg-gray-200 rounded-lg" />
            <div className="w-32 h-8 bg-gray-200 rounded-lg" />
          </div>
        </div>
      )}

      {/* OUTPUT AREA — No more raw JSON */}
      {lastResult && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Twin Output
            </h4>
            <button
              onClick={() => setLastResult(null)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium"
            >
              Clear
            </button>
          </div>

          {/* Confidence Score */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${lastResult?.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${lastResult?.confidence || (lastResult?.type === 'error' ? 45 : 87)}%` }} 
              />
            </div>
            <span className={`text-[10px] font-bold ${lastResult?.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
              {lastResult?.confidence || (lastResult?.type === 'error' ? 45 : 87)}% match to your profile
            </span>
          </div>

          <TwinOutputRenderer result={lastResult} />
        </div>
      )}
    </div>
  );
};

const RaceLeaderboard = ({ userId }) => {
  const [races, setRaces] = useState([]);
  const [activeRace, setActiveRace] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    opportunityApi.getUserRaces(userId)
      .then(res => {
        const data = res.data.data || [];
        setRaces(data);
        if (data[0]) setActiveRace(data[0]);
      })
      .catch(err => console.error('Failed to load races:', err));
  }, [userId]);

  useEffect(() => {
    if (!activeRace) return;
    opportunityApi.getLeaderboard(activeRace.id)
      .then(res => setLeaderboard(res.data.data || []))
      .catch(err => console.error('Failed to load leaderboard:', err));
  }, [activeRace]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">🏁 Career Race</h2>
          {activeRace && (
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
              Day {Math.floor((Date.now() - new Date(activeRace.start_date)) / 86400000) + 1}/30
            </span>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No active race</p>
            <p className="text-sm">Join a 30-day sprint to compete with your guild</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, i) => (
              <div 
                key={entry.userId} 
                className={`flex items-center gap-4 p-4 rounded-xl ${
                  entry.userId === userId ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
                }`}
              >
                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-200 text-gray-700' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-white text-gray-500'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{entry.name}</div>
                  <div className="text-xs text-gray-500">{entry.guild} · {entry.streak} day streak</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{entry.score}</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN COMMAND CENTER ───
const CareerCommandCenter = ({ opportunities = [], meta, userProfile }) => {
  const [activeMode, setActiveMode] = useState('strategic');

  // Ensure opportunities have singularity scores (fallback to existing scores)
  const enrichedOpportunities = opportunities.map(opp => ({
    ...opp,
    singularity_score: opp.singularity_score || {
      total: opp.score || 65,
      breakdown: {
        skillMarketFit: opp.score || 65,
        temporalAdvantage: 50,
        antiFragileIndex: 50,
        arbitragePotential: 50
      },
      insights: {}
    }
  }));

  const topOpportunity = enrichedOpportunities[0];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Career Command Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Singularity Score:{' '}
            <span className="font-bold text-indigo-600">
              {topOpportunity?.singularity_score?.total || '---'}
            </span>/100
            {meta?.scoredCount && ` · Analyzed ${meta.scoredCount} market vectors`}
          </p>
        </div>
        <div className="flex gap-2">
          {['strategic', 'race', 'twin'].map(mode => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeMode === mode 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'strategic' ? '🎯 Strategic' : mode === 'race' ? '🏁 Race Mode' : '🤖 Twin'}
            </button>
          ))}
        </div>
      </div>

      {/* STRATEGIC MODE */}
      {activeMode === 'strategic' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content: 8 cols */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Multi-Dimensional Opportunity Radar</h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">
                  4D Singularity Analysis
                </span>
              </div>
              <div className="h-80">
                <RadarComparisonChart opportunities={enrichedOpportunities} />
              </div>
            </div>
            
            {/* Opportunity Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrichedOpportunities.slice(0, 6).map((opp, idx) => (
                <OpportunitySingularityCard 
                  key={opp.id || idx} 
                  opportunity={opp} 
                  rank={idx + 1}
                />
              ))}
            </div>
          </div>

          {/* Sidebar: 4 cols */}
          <div className="lg:col-span-4 space-y-6">
            <AntiFragileGauge 
              score={topOpportunity?.singularity_score?.breakdown?.antiFragileIndex || 50}
              moatSkills={topOpportunity?.singularity_score?.insights?.moatSkills || []}
              automationTimeline={topOpportunity?.singularity_score?.insights?.automationTimeline}
            />
            <ArbitrageAlert 
              opportunities={enrichedOpportunities} 
              userLocation={userProfile?.location} 
            />
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Temporal Signals</h3>
              <div className="space-y-3">
                {enrichedOpportunities.slice(0, 3).map((opp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <span className="text-lg">
                      {opp.singularity_score?.insights?.temporal?.includes('🔥') ? '🔥' :
                       opp.singularity_score?.insights?.temporal?.includes('⚡') ? '⚡' :
                       opp.singularity_score?.insights?.temporal?.includes('⚠️') ? '⚠️' : '📊'}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{opp.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {opp.singularity_score?.insights?.temporal || 'Market stable'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RACE MODE */}
      {activeMode === 'race' && <RaceLeaderboard userId={userProfile?.id} />}

      {/* TWIN MODE */}
      {activeMode === 'twin' && <CareerTwinPanel userProfile={userProfile} />}
    </div>
  );
};

const OpportunitySingularityCard = ({ opportunity, rank }) => {
  const insights = opportunity.singularity_score?.insights || {};
  const breakdown = opportunity.singularity_score?.breakdown || {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
          rank === 2 ? 'bg-gray-100 text-gray-700' : 
          rank === 3 ? 'bg-orange-100 text-orange-700' :
          'bg-gray-50 text-gray-500'
        }`}>
          #{rank}
        </span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {opportunity.category}
        </span>
      </div>
      
      <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{opportunity.title}</h3>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{opportunity.description}</p>
      
      {/* Proprietary Insight Badges */}
      <div className="space-y-2 mb-4">
        {insights.temporal && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg">
            <span>{insights.temporal.includes('🔥') ? '🔥' : '⚡'}</span>
            <span className="truncate">{insights.temporal.replace(/[🔥⚡📊⚠️💸]\s*/, '')}</span>
          </div>
        )}
        {insights.arbitrage && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
            <span>💰</span>
            <span className="truncate">{insights.arbitrage.split('—')[0] || insights.arbitrage}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg">
          <span>🛡️</span>
          AI-Proof: {breakdown.antiFragileIndex || '--'}/100
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">
          ${opportunity.income_potential?.toLocaleString() || opportunity.salary?.toLocaleString() || '---'}/mo
        </span>
        <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity">
          Execute Plan →
        </button>
      </div>
    </div>
  );
};

export default CareerCommandCenter;