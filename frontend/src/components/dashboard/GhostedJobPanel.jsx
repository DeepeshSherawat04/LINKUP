import React, { useState, useEffect, useCallback } from 'react';
import { ghostedJobApi } from '../../api/ghostedJobApi';
import './GhostedJobPanel.css';

const OUTCOMES = [
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' }
];

const SEVERITY_STYLES = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  info: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' }
};

const OUTCOME_COLORS = {
  hired: '#10b981', offer: '#10b981', interview: '#3b82f6',
  phone_screen: '#8b5cf6', rejected: '#ef4444', ghosted: '#64748b'
};

export const GhostedJobPanel = () => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    company: '', role: '', appliedDate: '', responseDate: '',
    outcome: 'ghosted', skills: '', hasSystemDesignProject: false,
    hasGraphql: false, readmeLength: '', hasReferral: false,
    numReactProjects: '', hasTests: false, notes: ''
  });

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await ghostedJobApi.getHistory();
      setHistory(data.data || []);
    } catch (err) {
      console.error('History load failed', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await ghostedJobApi.getStats();
      setStats(data.data);
    } catch (err) {
      console.error('Stats load failed', err);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [loadHistory, loadStats]);

  const runAnalysis = async () => {
    if (!company.trim() || !role.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await ghostedJobApi.analyze(company.trim(), role.trim());
      setAnalysis(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitOutcome = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        readmeLength: form.readmeLength ? parseInt(form.readmeLength) : null,
        numReactProjects: form.numReactProjects ? parseInt(form.numReactProjects) : 0
      };
      await ghostedJobApi.recordOutcome(payload);
      setShowForm(false);
      setForm({
        company: '', role: '', appliedDate: '', responseDate: '',
        outcome: 'ghosted', skills: '', hasSystemDesignProject: false,
        hasGraphql: false, readmeLength: '', hasReferral: false,
        numReactProjects: '', hasTests: false, notes: ''
      });
      loadHistory();
      loadStats();
      if (company && role) runAnalysis();
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const responseTime = (applied, responded) => {
    if (!applied || !responded) return '—';
    const days = Math.ceil((new Date(responded) - new Date(applied)) / 86400000);
    return `${days}d`;
  };

  return (
    <div className="gjp-container">
      {/* Header */}
      <div className="gjp-header">
        <h1>🔍 Ghosted Job Reverse-Engineer</h1>
        <p>Data no AI has. Real outcomes from the LINKUP network.</p>
      </div>

      {/* User Stats Bar */}
      {stats && (
        <div className="gjp-statsbar">
          <div className="gjp-stat">
            <span className="gjp-stat-num">{stats.total_applied}</span>
            <span className="gjp-stat-label">Applied</span>
          </div>
          <div className="gjp-stat">
            <span className="gjp-stat-num">{Math.round((stats.response_rate || 0) * 100)}%</span>
            <span className="gjp-stat-label">Response Rate</span>
          </div>
          <div className="gjp-stat">
            <span className="gjp-stat-num">{Math.round((stats.interview_rate || 0) * 100)}%</span>
            <span className="gjp-stat-label">Interview Rate</span>
          </div>
          <div className="gjp-stat">
            <span className="gjp-stat-num">{Math.round((stats.offer_rate || 0) * 100)}%</span>
            <span className="gjp-stat-label">Offer Rate</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="gjp-search">
        <input
          type="text"
          placeholder="Company (e.g. Stripe)"
          value={company}
          onChange={e => setCompany(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runAnalysis()}
        />
        <input
          type="text"
          placeholder="Role (e.g. Senior Frontend)"
          value={role}
          onChange={e => setRole(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runAnalysis()}
        />
        <button onClick={runAnalysis} disabled={loading} className="gjp-btn gjp-btn-primary">
          {loading ? 'Analyzing Network...' : 'Analyze'}
        </button>
        <button onClick={() => setShowForm(!showForm)} className="gjp-btn gjp-btn-secondary">
          {showForm ? 'Close' : '+ Log Application'}
        </button>
      </div>

      {error && <div className="gjp-error">{error}</div>}

      {/* Log Form */}
      {showForm && (
        <form onSubmit={submitOutcome} className="gjp-form">
          <h3>Log Application Outcome</h3>
          <div className="gjp-form-grid">
            <input required placeholder="Company *" value={form.company}
              onChange={e => setForm({...form, company: e.target.value})} />
            <input required placeholder="Role *" value={form.role}
              onChange={e => setForm({...form, role: e.target.value})} />
            <input required type="date" value={form.appliedDate}
              onChange={e => setForm({...form, appliedDate: e.target.value})} />
            <input type="date" value={form.responseDate}
              onChange={e => setForm({...form, responseDate: e.target.value})} />
            <select value={form.outcome}
              onChange={e => setForm({...form, outcome: e.target.value})}>
              {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input placeholder="Skills (comma separated)" value={form.skills}
              onChange={e => setForm({...form, skills: e.target.value})} />
            <input type="number" placeholder="README length (lines)" value={form.readmeLength}
              onChange={e => setForm({...form, readmeLength: e.target.value})} />
            <input type="number" placeholder="# React projects" value={form.numReactProjects}
              onChange={e => setForm({...form, numReactProjects: e.target.value})} />
          </div>
          <div className="gjp-checks">
            <label><input type="checkbox" checked={form.hasSystemDesignProject}
              onChange={e => setForm({...form, hasSystemDesignProject: e.target.checked})} /> System design project</label>
            <label><input type="checkbox" checked={form.hasGraphql}
              onChange={e => setForm({...form, hasGraphql: e.target.checked})} /> GraphQL on resume</label>
            <label><input type="checkbox" checked={form.hasReferral}
              onChange={e => setForm({...form, hasReferral: e.target.checked})} /> Employee referral</label>
            <label><input type="checkbox" checked={form.hasTests}
              onChange={e => setForm({...form, hasTests: e.target.checked})} /> Projects have tests</label>
          </div>
          <textarea placeholder="Notes (optional)" rows={2} value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})} />
          <button type="submit" className="gjp-btn gjp-btn-primary">Save to Network</button>
        </form>
      )}

      {/* Analysis Results */}
      {analysis && !analysis.error && (
        <div className="gjp-results">
          {/* Network Stats */}
          <div className="gjp-card gjp-stats">
            <h3>📊 LINKUP Network Data (n={analysis.network.totalApplicants})</h3>
            <div className="gjp-stats-grid">
              <div className="gjp-s-item">
                <div className="gjp-s-val">{Math.round((analysis.network.responseRate || 0) * 100)}%</div>
                <div className="gjp-s-label">Response Rate</div>
              </div>
              <div className="gjp-s-item">
                <div className="gjp-s-val">{analysis.network.avgTimeToReject ?? '—'}</div>
                <div className="gjp-s-label">Avg. Days to Reject</div>
              </div>
              <div className="gjp-s-item">
                <div className="gjp-s-val">{analysis.network.avgTimeToInterview ?? '—'}</div>
                <div className="gjp-s-label">Avg. Days to Interview</div>
              </div>
            </div>
          </div>

          {/* What Worked */}
          {analysis.whatWorked?.length > 0 && (
            <div className="gjp-card gjp-worked">
              <h3>🔍 What Got People Hired</h3>
              <ul>
                {analysis.whatWorked.map((item, i) => (
                  <li key={i}>
                    <span>{item.factor_name}</span>
                    <strong>+{Math.round((item.rate || 0) * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags */}
          {analysis.redFlags?.length > 0 && (
            <div className="gjp-card gjp-flags">
              <h3>⚠️ Red Flags for This Role</h3>
              <ul>
                {analysis.redFlags.map((flag, i) => (
                  <li key={i}>
                    <span>{flag.flag_name}</span>
                    <strong>{Math.round((flag.rate || 0) * 100)}% rejected</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gap Analysis */}
          {analysis.gapAnalysis && (
            <div className="gjp-card gjp-gaps">
              <h3>🎯 Your Gap vs. Hired Candidates</h3>
              <div className="gjp-gap-list">
                {analysis.gapAnalysis.map((gap, i) => {
                  const style = SEVERITY_STYLES[gap.severity] || SEVERITY_STYLES.info;
                  return (
                    <div key={i} className="gjp-gap-item" style={{ borderLeftColor: style.color, background: style.bg }}>
                      <div className="gjp-gap-top">
                        <span className="gjp-gap-name">{gap.factor}</span>
                        <span className="gjp-gap-badge" style={{ color: gap.userStatus === 'pass' ? '#10b981' : '#ef4444' }}>
                          {gap.userStatus === 'pass' ? '✅ You pass' : '❌ Risk'}
                        </span>
                      </div>
                      <div className="gjp-gap-meta">
                        {Math.round((gap.risk || 0) * 100)}% of rejections had this
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* User History at this Company */}
          {analysis.userHistory?.length > 0 && (
            <div className="gjp-card gjp-local">
              <h3>Your History Here</h3>
              {analysis.userHistory.map(h => (
                <div key={h.id} className="gjp-local-row">
                  <span className="gjp-local-date">{h.applied_date}</span>
                  <span className="gjp-local-outcome" style={{ color: OUTCOME_COLORS[h.outcome] || '#94a3b8' }}>
                    {h.outcome?.replace('_', ' ')}
                  </span>
                  {h.response_date && <span className="gjp-local-resp">({responseTime(h.applied_date, h.response_date)})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global History Table */}
      <div className="gjp-history">
        <h3>Your Application Log</h3>
        {history.length === 0 ? (
          <div className="gjp-empty">No applications tracked yet. Log your first outcome to start building intelligence.</div>
        ) : (
          <table className="gjp-table">
            <thead>
              <tr>
                <th>Company</th><th>Role</th><th>Applied</th><th>Outcome</th><th>Response</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{h.company}</td>
                  <td>{h.role}</td>
                  <td>{h.applied_date}</td>
                  <td>
                    <span className="gjp-badge" style={{ background: OUTCOME_COLORS[h.outcome] }}>
                      {h.outcome?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{responseTime(h.applied_date, h.response_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};