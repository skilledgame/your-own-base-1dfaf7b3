/**
 * Game Error Boundary
 * 
 * Prevents the entire app from crashing when game-related errors occur.
 * Catches React errors #300 (rendering with invalid state) and other game errors.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GameErrorBoundaryClass extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GameErrorBoundary] Caught error:', error);
    console.error('[GameErrorBoundary] Error info:', errorInfo);
    
    // Check if this is a transient error that should auto-recover
    // React error #300 = "Rendered fewer hooks than expected" (usually from conditional hooks or state updates during render)
    const isTransientError = error.message.includes('Cannot update') || 
                             error.message.includes('during render') ||
                             error.message.includes('Maximum update depth') ||
                             error.message.includes('Rendered more hooks') ||
                             error.message.includes('Minified React error #300') ||
                             error.message.includes('invariant=300') ||
                             error.message.includes('Rendered fewer hooks') ||
                             error.message.includes('error #300');

    if (isTransientError) {
      // For transient errors, auto-retry immediately without showing error screen
      
      // Clear the error state immediately to prevent error screen from showing
      // getDerivedStateFromError already set hasError: true, so we need to reset it
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
      
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
      }
      // Auto-retry after a short delay to let state settle
      this.retryTimeout = setTimeout(() => {
        // Force a re-render by resetting state again (in case component didn't re-render)
        this.handleReset();
      }, 100);
      return; // Don't set error state, so error screen doesn't show
    }

    // For non-transient errors, show the error screen
    this.setState({
      error,
      errorInfo,
    });

    // Log to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <GameErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function GameErrorFallback({
  error,
  errorInfo,
  onReset,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-card border border-destructive/50 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Game Error</h1>
        </div>

        <p className="text-muted-foreground">
          An error occurred while playing the game. This has been logged and we'll look into it.
        </p>

        {isDev && error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-4 space-y-2">
            <p className="font-semibold text-destructive">Error Details (Dev Mode):</p>
            <pre className="text-xs overflow-auto max-h-48 bg-background p-2 rounded">
              {error.toString()}
              {errorInfo?.componentStack && (
                <>
                  {'\n\nComponent Stack:'}
                  {errorInfo.componentStack}
                </>
              )}
            </pre>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button onClick={onReset} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button onClick={() => navigate('/')} variant="default" className="gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

// Export as functional component wrapper for easier use
export function GameErrorBoundary({ children, fallback }: Props) {
  return <GameErrorBoundaryClass fallback={fallback}>{children}</GameErrorBoundaryClass>;
}
