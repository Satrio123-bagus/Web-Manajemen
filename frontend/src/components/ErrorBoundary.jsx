import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * ErrorBoundary - Catches React component errors and displays fallback UI
 * Prevents white screen crashes and provides user recovery options
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    const errorCount = this.state.errorCount + 1;
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Send to error tracking service (e.g., Sentry, DataDog)
    this.logErrorToService(error, errorInfo, errorCount);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] React Error:', error);
      console.error('[ErrorBoundary] Error Info:', errorInfo);
    }
  }

  logErrorToService = (error, errorInfo, count) => {
    try {
      // Future: integrate with Sentry, DataDog, or your error tracking service
      const errorPayload = {
        timestamp: new Date().toISOString(),
        message: error?.toString(),
        stack: errorInfo?.componentStack,
        count,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Uncomment when error tracking service is configured:
      // fetch('/api/errors/log', { method: 'POST', body: JSON.stringify(errorPayload) });

      console.warn('[ErrorBoundary] Error logged:', errorPayload);
    } catch (err) {
      console.error('[ErrorBoundary] Failed to log error:', err);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 
                     flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md">
            {/* Error Icon */}
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex justify-center mb-6"
            >
              <AlertTriangle className="w-16 h-16 text-red-500" />
            </motion.div>

            {/* Error Card */}
            <div className="bg-slate-800/50 backdrop-blur-xl border border-red-500/30 rounded-lg p-6 mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">⚠️ Oops!</h1>
              <p className="text-gray-300 mb-4">
                Terjadi kesalahan yang tidak terduga pada aplikasi.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-slate-900 rounded p-3 mb-4 border border-red-500/20">
                  <p className="text-red-400 text-sm font-mono break-words">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                        Stack Trace
                      </summary>
                      <pre className="text-gray-500 text-xs mt-2 overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Error Count */}
              {this.state.errorCount > 1 && (
                <p className="text-yellow-400 text-sm mb-4">
                  ⚠️ Error terulang {this.state.errorCount}x
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleReset}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 
                           rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Lagi
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleGoHome}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 
                           rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Kembali ke Dashboard
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleReload}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 
                           rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Halaman
              </motion.button>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-500 text-xs mt-6">
              Error ID: {new Date().getTime()}
            </p>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
