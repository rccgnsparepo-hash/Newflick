import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Flick ErrorBoundary] Caught render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('flick_theme_v3');
      localStorage.removeItem('flick_scheme_v3');
      localStorage.removeItem('flick_accent_v3');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 w-full h-full bg-[#080a0f] text-[#f3f4f6] flex flex-col items-center justify-center p-6 font-mono z-50 select-text">
          <div className="max-w-md w-full border border-red-500/40 bg-black/80 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400 border-b border-red-500/20 pb-3">
              <div className="w-10 h-10 rounded border border-red-500/50 bg-red-950/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-red-400">
                  SYSTEM RECOVERY MODE
                </h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                  Terminal encountered an unhandled exception
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-950/20 border border-red-500/20 text-[10px] text-red-200/90 font-mono overflow-auto max-h-36 leading-relaxed">
              <p className="font-bold mb-1">
                {this.state.error?.message || 'Unknown runtime error occurred.'}
              </p>
              {this.state.error?.stack && (
                <pre className="text-[8.5px] text-zinc-500 whitespace-pre-wrap truncate">
                  {this.state.error.stack.split('\n').slice(0, 4).join('\n')}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2 px-3 bg-[#00ff66] text-black font-extrabold text-[10px] uppercase tracking-wider hover:bg-[#00ff66]/80 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>RELOAD FLICK</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="py-2 px-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-bold text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>RESET CACHE</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
