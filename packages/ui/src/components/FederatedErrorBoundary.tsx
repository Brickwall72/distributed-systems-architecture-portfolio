// File: packages/shared/ui-components/src/components/FederatedErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  remoteName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class FederatedErrorBoundary extends Component<Props, State> {
  public readonly state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[Module Federation Error] Failed to load remote module [${this.props.remoteName || 'unknown'}]`,
      error,
      errorInfo
    );
  }

  private readonly handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-5 bg-red-950/40 border border-red-800/80 rounded-xl text-red-200 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm tracking-wide text-red-300">
              Module Federation Load Failure
            </h4>
            <span className="px-2 py-0.5 bg-red-900/60 border border-red-700/50 text-[10px] font-mono text-red-200 rounded">
              {this.props.remoteName || 'Remote Service'}
            </span>
          </div>
          <p className="text-xs text-red-300/80 font-mono line-clamp-2">
            {this.state.error?.message || 'Unable to fetch remote module entry point or bundle.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1.5 text-xs font-medium bg-red-900 hover:bg-red-800 text-white rounded transition shadow"
          >
            Retry Loading Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}