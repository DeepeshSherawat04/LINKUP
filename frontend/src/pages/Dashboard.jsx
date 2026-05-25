// Dashboard.jsx — v2.1 SINGULARITY EDITION
// Priority: Intelligence Layer | Backward Compatible

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import RadarTable from '../components/dashboard/RadarTable';
import RadarComparisonChart from '../components/dashboard/RadarComparisonChart';
import ExplainableFactors from '../components/dashboard/ExplainableFactors';
import AISummaryPanel from '../components/dashboard/AISummaryPanel';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorBoundary from '../components/common/ErrorBoundary';
import CareerCommandCenter from '../components/dashboard/CareerCommandCenter';
import { useOpportunityRadar } from '../hooks/useOpportunity';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: opportunities, loading, error, emptyState, meta, refetch } = useOpportunityRadar();
  const [activeTab, setActiveTab] = useState('intelligence');

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 md:p-6 border border-gray-200">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4 animate-pulse" />
              <div className="h-32 bg-gray-100 rounded mb-4 animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <EmptyState
          type={error.type || 'SERVICE_ERROR'}
          title={error.title}
          description={error.message}
          action={error.action}
          actionLabel={error.ctaText || 'Try Again'}
          actionPath={error.ctaLink}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (emptyState) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <EmptyState
          type={emptyState.type}
          title={emptyState.title}
          description={emptyState.message}
          action={emptyState.action}
          actionLabel={emptyState.ctaText}
          actionPath={emptyState.ctaLink}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!opportunities?.length) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <EmptyState type="NO_MATCHES" onRetry={refetch} />
      </div>
    );
  }

  const tabs = [
    { id: 'intelligence', label: '🧠 Intelligence' },
    { id: 'overview', label: '🎯 Radar' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'comparison', label: '⚖️ Compare' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── INTELLIGENCE TAB (NEW: Command Center) ─── */}
      {activeTab === 'intelligence' && (
        <CareerCommandCenter 
          opportunities={opportunities} 
          meta={meta} 
          userProfile={user} 
        />
      )}

      {/* ─── OVERVIEW TAB (Legacy Radar View) ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {opportunities[0] && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">🏆 Top Match</span>
                {opportunities[0].category && (
                  <span className="bg-white/20 px-2 py-1 rounded-full text-xs">{opportunities[0].category}</span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">{opportunities[0].title}</h2>
              <p className="text-blue-100 text-sm mb-4 max-w-2xl">
                {opportunities[0].ai_explanation?.summary || opportunities[0].description}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="bg-white/20 px-3 py-1.5 rounded-lg">
                  Score: <strong>{opportunities[0].score}/100</strong>
                </span>
                <span className="bg-white/20 px-3 py-1.5 rounded-lg">
                  Match: <strong>{opportunities[0].skill_match_percentage}%</strong>
                </span>
                <span className="bg-white/20 px-3 py-1.5 rounded-lg">
                  Income: <strong>${opportunities[0].income_potential?.toLocaleString()}/mo</strong>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {opportunities.map((opp, index) => (
              <ErrorBoundary key={opp.id} onRetry={refetch}>
                <OpportunityCard
                  opportunity={opp}
                  rank={index + 1}
                  onSelect={() => navigate(`/plan?opportunity=${opp.id}`)}
                />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {/* ─── ANALYTICS TAB ─── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Detailed Comparison</h2>
            <RadarTable opportunities={opportunities} />
          </div>
          {opportunities.some(o => o.radar_data) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 Multi-Dimension Radar</h2>
              <RadarComparisonChart opportunities={opportunities} />
            </div>
          )}
          {opportunities.some(o => o.explainability) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">🔍 Explainability Analysis</h2>
              <ExplainableFactors opportunities={opportunities} />
            </div>
          )}
          {opportunities.some(o => o.ai_explanation) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">🤖 AI Insights</h2>
              <AISummaryPanel opportunities={opportunities} />
            </div>
          )}
        </div>
      )}

      {/* ─── COMPARISON TAB ─── */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⚖️ Side-by-Side Comparison</h2>
            <RadarTable opportunities={opportunities} />
          </div>
        </div>
      )}

      {opportunities[0]?.memory_note && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">💡 Memory:</span> {opportunities[0].memory_note}
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;