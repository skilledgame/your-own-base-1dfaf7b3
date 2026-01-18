/**
 * Error Boundary Component
 * 
 * STEP 1: Catches React errors and prevents blank screens.
 * Shows error stack on screen with a Reload button.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to console for debugging
    if (error.stack) {
      console.error('[ErrorBoundary] Error stack:', error.stack);
    }
    if (errorInfo.componentStack) {
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-red-950/30 border border-red-500/50 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <h1 className="text-2xl font-bold text-red-300">App Crashed</h1>
            </div>
            
            {this.state.error && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-red-200">
                  {this.state.error.name}: {this.state.error.message}
                </h2>
                
                {this.state.error.stack && (
                  <div className="bg-black/50 rounded p-4 overflow-auto max-h-64">
                    <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {this.state.errorInfo && this.state.errorInfo.componentStack && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-200">Component Stack:</h3>
                <div className="bg-black/50 rounded p-4 overflow-auto max-h-32">
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            )}

            <Button
              onClick={this.handleReload}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
