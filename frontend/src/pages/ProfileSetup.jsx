// frontend/src/pages/ProfileSetup.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileApiClient } from '../api/profileApi';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { opportunityApi } from '../api/opportunityApi';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  
  const [form, setForm] = useState({ 
    goal_type: 'freelance', 
    location: '', 
    time_per_week: 15 
  });
  const [manualSkills, setManualSkills] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Auto-fill email from Google if available
  useEffect(() => {
    if (user?.email && !form.email) {
      // User is logged in via Google
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Redirect happens via OAuth callback
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!user) {
    setSaveError('Please sign in first');
    return;
  }
  setSaving(true);
  setSaveError('');
  try {
    await profileApiClient.saveProfile({
      goal_type: form.goal_type,
      location: form.location,
      time_per_week: form.time_per_week
    });
    
    const allSkills = [
      ...extractedSkills,
      ...manualSkills.split(',').map(s => s.trim()).filter(Boolean)
    ];
    if (allSkills.length > 0) {
      await profileApiClient.saveSkills(allSkills);
    }
    navigate('/');
  } catch (err) {
    setSaveError(err.response?.data?.message || 'Failed to save profile');
  } finally {
    setSaving(false);
  }
};

  const handleExtractSkills = async () => {
    if (!resumeText.trim()) return;
    setLoadingAI(true);
    setAiError('');
    try {
      const res = await opportunityApi.parseResume(resumeText);
      setExtractedSkills(res.data.data.skills || []);
    } catch (err) {
      // Show actual backend error message instead of generic text
      const msg = err.response?.data?.error?.message 
        || err.response?.data?.message 
        || 'AI extraction failed. Add skills manually.';
      setAiError(msg);
    } finally {
      setLoadingAI(false);
    }
  };

  if (authLoading) return <LoadingSpinner />;

  // ─── NOT LOGGED IN: Show Google Sign In ───
  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to LinkUP</h1>
          <p className="text-gray-500 mt-2">Sign in with Google to get your personalized opportunity radar</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>New user? <span className="font-medium text-gray-700">Google handles both sign-up and sign-in</span></p>
            <p className="mt-1">Your profile will be created automatically</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGGED IN: Show Profile Form ───
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setup Your Profile</h1>
          <p className="text-gray-500 mt-1">Welcome, {user.email}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 underline"
        >
          Sign Out
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
          <select 
            value={form.goal_type} 
            onChange={e => setForm({...form, goal_type: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="freelance">Freelance</option>
            <option value="job">Full-time Job</option>
            <option value="creator">Creator / Content</option>
            <option value="saas">SaaS / Product</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input 
            type="text" 
            value={form.location} 
            placeholder="e.g. Bangalore, Remote"
            onChange={e => setForm({...form, location: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hours per Week <span className="text-gray-400 font-normal">(affects income probability)</span>
          </label>
          <div className="flex items-center gap-3">
            <input 
              type="range" 
              min="1" 
              max="60" 
              value={form.time_per_week}
              onChange={e => setForm({...form, time_per_week: parseInt(e.target.value)})}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-sm font-bold text-blue-700 w-12 text-right">{form.time_per_week}h</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {form.time_per_week < 10 ? 'Low commitment — income probability will be limited' :
             form.time_per_week < 20 ? 'Moderate — good for side income' :
             'High commitment — optimal for rapid growth'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Skills <span className="text-gray-400 font-normal">(comma separated)</span>
          </label>
          <input 
            type="text" 
            value={manualSkills}
            onChange={e => setManualSkills(e.target.value)}
            placeholder="React, Node.js, Python, SEO..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <button 
          type="submit" 
          disabled={saving}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {saving ? 'Saving & Generating Radar...' : 'Save Profile & Generate Radar'}
        </button>
      </form>

      {/* AI Resume Parser */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">🤖 AI Resume Parser</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Optional</span>
        </div>
        
        <textarea
          value={resumeText}
          onChange={e => setResumeText(e.target.value)}
          placeholder="Paste resume text here..."
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 text-sm"
        />
        
        <button 
          onClick={handleExtractSkills}
          disabled={loadingAI || !resumeText.trim()}
          className="w-full bg-purple-600 text-white font-semibold py-2.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
        >
          {loadingAI ? 'Extracting...' : 'Extract Skills with AI'}
        </button>

        {aiError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{aiError}</p>}

        {extractedSkills.length > 0 && (
          <div className="pt-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Extraacted Skills:</p>
            <div className="flex flex-wrap gap-2">
              {extractedSkills.map((skill, i) => (
                <span key={i} className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium border border-purple-200">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;