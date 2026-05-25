// EmptyState.jsx — UPGRADED v2.0
// Priority 4: Proper empty/error states with context-aware messaging

import { useNavigate } from 'react-router-dom';

const iconMap = {
  'database': '🗄️',
  'skills': '🎯',
  'alert': '⚠️',
  'search': '🔍',
  'login': '🔐',
  'refresh': '🔄',
  'profile': '👤',
  'error': '❌',
  'timeout': '⏱️',
  'network': '📡',
  'default': '📭'
};

const EmptyState = ({ 
  type = 'default',
  title = 'No opportunities found', 
  description = 'Complete your profile to get personalized matches.',
  action = 'profile',
  actionLabel = 'Setup Profile',
  actionPath = '/profile',
  secondaryAction,
  secondaryLabel,
  secondaryPath,
  icon,
  onRetry,
  className = ''
}) => {
  const navigate = useNavigate();
  const displayIcon = icon || iconMap[type] || iconMap['default'];

  // Context-aware configurations (Priority 4)
  const configs = {
    NO_SKILLS: {
      icon: '🎯',
      title: 'Add Your Skills First',
      description: 'We need to know your skills to find matching opportunities. Add at least 3 skills to unlock your personalized radar.',
      actionLabel: 'Go to Profile',
      actionPath: '/profile',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconBg: 'bg-amber-100'
    },
    NO_OPPORTUNITIES: {
      icon: '🗄️',
      title: 'Database Updating',
      description: 'Our opportunity database is being refreshed with the latest market data. Check back in a few minutes.',
      actionLabel: 'Refresh',
      action: 'refresh',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100'
    },
    NO_MATCHES: {
      icon: '🔍',
      title: 'No Matching Opportunities',
      description: "We couldn't find opportunities that match your current skills. Try adding more diverse skills or updating your experience level.",
      actionLabel: 'Update Profile',
      actionPath: '/profile',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      iconBg: 'bg-purple-100'
    },
    SCORING_FAILED: {
      icon: '⚠️',
      title: 'Unable to Rank Opportunities',
      description: 'Our scoring engine encountered an issue. This is usually temporary — please refresh the page or try again in a moment.',
      actionLabel: 'Try Again',
      action: 'retry',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconBg: 'bg-red-100'
    },
    AUTH_REQUIRED: {
      icon: '🔐',
      title: 'Sign In Required',
      description: 'Please sign in to see your personalized opportunity radar and AI-powered recommendations.',
      actionLabel: 'Sign In',
      actionPath: '/login',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      iconBg: 'bg-indigo-100'
    },
    AI_TIMEOUT: {
      icon: '⏱️',
      title: 'AI Analysis Timed Out',
      description: 'Our AI is processing a high volume of requests. Your analysis has been queued — please refresh in 30 seconds.',
      actionLabel: 'Refresh Now',
      action: 'refresh',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      iconBg: 'bg-orange-100'
    },
    SERVICE_ERROR: {
      icon: '📡',
      title: 'Service Temporarily Unavailable',
      description: "We're experiencing technical difficulties. Our team has been notified. Please try again shortly.",
      actionLabel: 'Retry',
      action: 'retry',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      iconBg: 'bg-gray-100'
    },
    NETWORK_ERROR: {
      icon: '📡',
      title: 'Connection Issue',
      description: 'Unable to connect to our servers. Please check your internet connection and try again.',
      actionLabel: 'Retry',
      action: 'retry',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      iconBg: 'bg-gray-100'
    }
  };

  const config = configs[type] || {
    icon: displayIcon,
    title,
    description,
    actionLabel,
    actionPath,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100'
  };

  const handleAction = () => {
    if (config.action === 'refresh' || action === 'refresh') {
      window.location.reload();
    } else if (config.action === 'retry' || action === 'retry') {
      onRetry?.();
    } else {
      navigate(config.actionPath || actionPath);
    }
  };

  return (
    <div className={`max-w-lg mx-auto text-center py-12 px-6 ${className}`}>
      <div className={`w-20 h-20 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-6 border-2 ${config.borderColor}`}>
        <span className="text-3xl">{config.icon}</span>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">{config.title}</h2>
      <p className="text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">{config.description}</p>

      <div className="flex gap-3 justify-center flex-wrap">
        <button 
          onClick={handleAction}
          className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
        >
          {config.actionLabel || actionLabel}
        </button>

        {secondaryAction && (
          <button 
            onClick={() => navigate(secondaryPath)}
            className="bg-white text-gray-700 font-medium px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {secondaryLabel}
          </button>
        )}

        {(config.action === 'retry' || action === 'retry') && (
          <button 
            onClick={() => window.location.reload()}
            className="bg-gray-100 text-gray-700 font-medium px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reload Page
          </button>
        )}
      </div>

      {/* Debug info for developers (hidden in production) */}
      {process.env.NODE_ENV === 'development' && type && (
        <p className="text-[10px] text-gray-300 mt-6">Error type: {type}</p>
      )}
    </div>
  );
};

export default EmptyState;