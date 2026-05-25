// App.jsx
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import ExecutionPlan from './pages/ExecutionPlan';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GhostedJobPanel } from './components/dashboard/GhostedJobPanel';
import { ReferralPathfinder } from './components/dashboard/ReferralPathfinder';
import { InterviewBattleStation } from './components/dashboard/InterviewBattleStation';
import { IncomeSimulatorPanel } from './components/dashboard/IncomeSimulatorPanel';
import { SkillArbitragePanel } from './components/dashboard/SkillArbitragePanel';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <AuthProvider>
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-blue-600">LINKUP</Link>
            <div className="flex gap-6">
              <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-600">Dashboard</Link>
              <Link to="/profile" className="text-sm font-medium text-gray-600 hover:text-blue-600">Profile</Link>
              <Link to="/plan" className="text-sm font-medium text-gray-600 hover:text-blue-600">Plan</Link>
            </div>
          </div>
        </nav>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
          <Route path="/plan" element={<ProtectedRoute><ExecutionPlan /></ProtectedRoute>} />
          <Route path="/ghosted-jobs" element={<GhostedJobPanel />} />
          <Route path="/referrals" element={<ReferralPathfinder />} />
          <Route path="/interview" element={<InterviewBattleStation />} />
          <Route path="/dashboard/income" element={<IncomeSimulatorPanel />} />
          <Route path="/dashboard/arbitrage" element={<SkillArbitragePanel userSkills={user?.skills || []} />} />
        </Routes>
      </div>
    </Router>
  </AuthProvider>
);

export default App;