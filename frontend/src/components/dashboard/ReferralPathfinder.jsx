import React, { useState, useEffect, useCallback } from 'react';
import { referralApi } from '../../api/referralApi';
import './ReferralPathfinder.css';

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'direct', label: 'Direct' }
];

export const ReferralPathfinder = () => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [message, setMessage] = useState(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [tone, setTone] = useState('professional');
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [linkedInConnected, setLinkedInConnected] = useState(false);

  const loadTargets = useCallback(async () => {
    try {
      const { data } = await referralApi.getTargets();
      setTargets(data.data || []);
    } catch (err) {
      console.error('Targets load failed', err);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const connectLinkedIn = async () => {
    try {
      const { data } = await referralApi.getLinkedInAuthUrl();
      if (data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else if (data.data?.fallback) {
        setShowImport(true);
        setError('LinkedIn API restricted. Please use CSV import.');
      }
    } catch (err) {
      setError('LinkedIn connection failed. Use CSV import instead.');
      setShowImport(true);
    }
  };

  const importCSV = async () => {
    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',');
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = vals[i]?.trim());
        return obj;
      });

      await referralApi.importCSV(rows);
      setShowImport(false);
      setCsvText('');
      alert('Connections imported successfully!');
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const findPaths = async () => {
    if (!company.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedPath(null);
    setMessage(null);

    try {
      const { data } = await referralApi.findPaths(company.trim(), role.trim());
      setPaths(data.data || []);
      if (data.data?.length === 0) {
        setError(`No network paths found to ${company}. Try adding more connections or a different company.`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Pathfinding failed.');
    } finally {
      setLoading(false);
    }
  };

  const addTarget = async () => {
    if (!company.trim()) return;
    try {
      await referralApi.addTarget(company.trim(), role.trim());
      loadTargets();
    } catch (err) {
      console.error('Add target failed', err);
    }
  };

  const draftMessage = async (path) => {
    setSelectedPath(path);
    setMessageLoading(true);
    
    const bridge = path.bestBridge || path.path?.[path.path.length - 2];
    const target = path.path?.[path.path.length - 1];
    
    if (!bridge || !target) {
      setMessageLoading(false);
      return;
    }

    const context = {
      userName: 'You',
      bridgeName: bridge.name,
      bridgeTitle: bridge.title,
      bridgeCompany: bridge.company,
      targetCompany: target.company,
      targetRole: role,
      mutualInterests: bridge.skills?.filter(s => 
        // Mock: we'd need user skills from profile
        true
      ),
      userProject: 'a career platform project'
    };

    try {
      const { data } = await referralApi.draftMessage(context, tone);
      setMessage(data.data);
    } catch (err) {
      setMessage({
        text: `Hi ${bridge.name},\n\nI noticed you're at ${target.company} and would love to learn about your experience. Would you be open to a brief chat?\n\nBest,`,
        disclaimer: 'Template fallback',
        contextUsed: { fallback: true }
      });
    } finally {
      setMessageLoading(false);
    }
  };

  const copyMessage = () => {
    if (message?.text) {
      navigator.clipboard.writeText(message.text);
    }
  };

  const sendViaLinkedIn = (profileUrl) => {
    if (!profileUrl) return;
    const linkedInMsg = encodeURIComponent(message?.text || '');
    window.open(`${profileUrl}?message=${linkedInMsg}`, '_blank');
  };

  return (
    <div className="rp-container">
      <div className="rp-header">
        <h1>🌐 Referral Pathfinder</h1>
        <p>Turn your network into warm intros. No cold messages.</p>
      </div>

      {/* Connection Status */}
      <div className="rp-connect-bar">
        {!linkedInConnected ? (
          <>
            <button onClick={connectLinkedIn} className="rp-btn rp-btn-linkedin">
              🔗 Connect LinkedIn
            </button>
            <button onClick={() => setShowImport(!showImport)} className="rp-btn rp-btn-secondary">
              📁 Import CSV
            </button>
          </>
        ) : (
          <span className="rp-connected">✅ LinkedIn connected</span>
        )}
      </div>

      {/* CSV Import */}
      {showImport && (
        <div className="rp-import">
          <p>Paste CSV: name,title,company,linkedin_url,email,skills</p>
          <textarea
            rows={6}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="John Doe,Senior Eng,Stripe,https://linkedin.com/in/johndoe,john@email.com,React,Node"
          />
          <button onClick={importCSV} className="rp-btn rp-btn-primary">Import</button>
        </div>
      )}

      {/* Targets */}
      {targets.length > 0 && (
        <div className="rp-targets">
          <h3>Your Targets</h3>
          <div className="rp-target-chips">
            {targets.map(t => (
              <button 
                key={t.id} 
                className="rp-chip"
                onClick={() => { setCompany(t.company_name); setRole(t.role_title || ''); }}
              >
                {t.company_name} {t.role_title && `• ${t.role_title}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="rp-search">
        <input
          placeholder="Target company (e.g. Stripe)"
          value={company}
          onChange={e => setCompany(e.target.value)}
        />
        <input
          placeholder="Role (optional)"
          value={role}
          onChange={e => setRole(e.target.value)}
        />
        <button onClick={findPaths} disabled={loading} className="rp-btn rp-btn-primary">
          {loading ? 'Mapping network...' : 'Find Paths'}
        </button>
        <button onClick={addTarget} className="rp-btn rp-btn-secondary">⭐ Save Target</button>
      </div>

      {error && <div className="rp-error">{error}</div>}

      {/* Paths */}
      {paths.length > 0 && (
        <div className="rp-paths">
          <h3>Network Paths to {company}</h3>
          
          {paths.map((path, idx) => {
            const bridge = path.bestBridge || path.path?.[path.path.length - 2];
            const target = path.path?.[path.path.length - 1];
            const score = path.bridgeScore || {};
            
            return (
              <div key={idx} className={`rp-path ${selectedPath === path ? 'rp-path-active' : ''}`}>
                <div className="rp-path-visual">
                  {path.path?.map((node, i) => (
                    <React.Fragment key={i}>
                      <div className="rp-node">
                        <div className="rp-node-name">{node.name || 'You'}</div>
                        <div className="rp-node-meta">{node.title || 'Your network'}</div>
                        {node.company && <div className="rp-node-company">@{node.company}</div>}
                      </div>
                      {i < path.path.length - 1 && <div className="rp-arrow">→</div>}
                    </React.Fragment>
                  ))}
                </div>

                {bridge && (
                  <div className="rp-bridge-card">
                    <div className="rp-bridge-header">
                      <h4>🎯 Best Bridge: {bridge.name}</h4>
                      <div className="rp-likelihood">
                        Response Likelihood: <strong>{Math.round((score.likelihood || 0) * 100)}%</strong>
                      </div>
                    </div>
                    
                    {score.reasons?.length > 0 && (
                      <ul className="rp-reasons">
                        {score.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                      </ul>
                    )}

                    <div className="rp-tone-select">
                      <label>Message tone:</label>
                      <select value={tone} onChange={e => setTone(e.target.value)}>
                        {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    <div className="rp-actions">
                      <button 
                        onClick={() => draftMessage(path)} 
                        className="rp-btn rp-btn-primary"
                        disabled={messageLoading && selectedPath === path}
                      >
                        {messageLoading && selectedPath === path ? 'Drafting...' : '💬 Draft Message'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Generated Message */}
                {selectedPath === path && message && (
                  <div className="rp-message">
                    <div className="rp-message-text">{message.text}</div>
                    <div className="rp-message-meta">
                      {message.disclaimer && <span className="rp-disclaimer">{message.disclaimer}</span>}
                      <div className="rp-message-actions">
                        <button onClick={copyMessage} className="rp-btn rp-btn-small">📋 Copy</button>
                        <button 
                          onClick={() => sendViaLinkedIn(bridge?.profile_url)}
                          className="rp-btn rp-btn-small rp-btn-linkedin"
                        >
                          📧 Open LinkedIn
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};