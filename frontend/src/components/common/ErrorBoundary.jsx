// ErrorBoundary.jsx — UPGRADED v2.0
// Priority 4: Production-grade error handling with user-friendly recovery

import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorId: null,
      timestamp: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      error,
      errorId: `ERR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console for debugging
    console.error('ErrorBoundary caught:', error, errorInfo);

    // In production, you could send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      console.log('Error reported:', this.state.errorId);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
    if (this.props.onRetry) this.props.onRetry();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId, timestamp } = this.state;
      const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch');
      const isTimeoutError = error?.message?.includes('timeout') || error?.message?.includes('timed out');

      // Determine error type for better messaging
      let errorConfig = {
        icon: '⚠️',
        title: 'Something went wrong',
        message: 'An unexpected error occurred while loading this section.',
        suggestion: 'Try refreshing the page or go back to the dashboard.',
        primaryAction: 'Try Again',
        primaryHandler: this.handleRetry,
        showDetails: true
      };

      if (isNetworkError) {
        errorConfig = {
          icon: '📡',
          title: 'Connection Lost',
          message: 'Unable to connect to our servers. Please check your internet connection.',
          suggestion: 'Check your connection and try again.',
          primaryAction: 'Retry Connection',
          primaryHandler: this.handleRetry,
          showDetails: false
        };
      } else if (isTimeoutError) {
        errorConfig = {
          icon: '⏱️',
          title: 'Request Timed Out',
          message: 'This operation took too long to complete. Our servers may be busy.',
          suggestion: 'Please wait a moment and try again.',
          primaryAction: 'Try Again',
          primaryHandler: this.handleRetry,
          showDetails: false
        };
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-100">
              <span className="text-3xl">{errorConfig.icon}</span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-2">{errorConfig.title}</h2>

            {/* Message */}
            <p className="text-gray-500 mb-2 text-sm">{errorConfig.message}</p>
            <p className="text-xs text-gray-400 mb-6">{errorConfig.suggestion}</p>

            {/* Error Details (collapsible) */}
            {errorConfig.showDetails && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 mb-2 select-none">
                  Technical Details
                </summary>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono break-all">
                  <p className="mb-1"><span className="font-semibold">Error:</span> {error?.message || 'Unknown error'}</p>
                  <p className="mb-1"><span className="font-semibold">ID:</span> {errorId}</p>
                  <p><span className="font-semibold">Time:</span> {new Date(timestamp).toLocaleString()}</p>
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center flex-wrap">
              <button 
                onClick={errorConfig.primaryHandler}
                className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
              >
                {errorConfig.primaryAction}
              </button>

              <button 
                onClick={this.handleReload}
                className="bg-gray-100 text-gray-700 font-medium px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reload Page
              </button>

              <button 
                onClick={this.handleGoHome}
                className="bg-white text-gray-600 font-medium px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Go Home
              </button>
            </div>

            {/* Support hint */}
            <p className="text-[11px] text-gray-400 mt-6">
              If this keeps happening, contact support with Error ID: <span className="font-mono text-gray-500">{errorId}</span>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;