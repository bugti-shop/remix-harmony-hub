import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Suppress known React DOM reconciliation errors (e.g. portal removal race conditions)
    // These are non-fatal and don't affect user experience
    if (error?.message?.includes('removeChild') || error?.message?.includes('insertBefore')) {
      return {};
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleClearAndReload = () => {
    // Clear any potentially corrupted cache
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = i18n.t.bind(i18n);
      const isRepeatedError = this.state.errorCount > 2;

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          
          <h3 className="text-xl font-bold mb-2">
            {t('errorBoundary.somethingWentWrong', 'Something went wrong')}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {isRepeatedError
              ? t('errorBoundary.repeatedError', 'This error keeps occurring. Try clearing the cache or going back to home.')
              : t('errorBoundary.unexpectedError', 'An unexpected error occurred. Please try again.')}
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={this.handleRetry} variant="default" className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('errorBoundary.tryAgain', 'Try Again')}
            </Button>
            
            <Button onClick={this.handleGoHome} variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              {t('errorBoundary.goHome', 'Go to Home')}
            </Button>

            {isRepeatedError && (
              <Button onClick={this.handleClearAndReload} variant="ghost" className="w-full text-xs text-muted-foreground">
                {t('errorBoundary.clearCache', 'Clear cache & reload')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper for components that might crash
export const SafeComponent = ({ 
  children, 
  fallback 
}: { 
  children: ReactNode; 
  fallback?: ReactNode 
}) => {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};
