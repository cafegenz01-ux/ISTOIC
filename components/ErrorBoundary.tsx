
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, ZapOff, Copy, Check, ShieldAlert } from 'lucide-react';
import { debugService } from '../services/debugService';
import { KEY_MANAGER } from '../services/geminiService';

interface ErrorBoundaryProps {
  children?: ReactNode;
  viewName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    const view = this.props.viewName || 'UNKNOWN_MODULE';
    const errStr = error.message.toLowerCase();

    // STRICT CLASSIFICATION: GEMINI FATAL ERROR
    const isGeminiFatal = (errStr.includes('429') || errStr.includes('resource_exhausted')) && 
                          errStr.includes('limit: 0');

    if (isGeminiFatal) {
        debugService.log(
            'ERROR', 
            `BOUNDARY_${view}`, 
            'FATAL_GEMINI_QUOTA', 
            'Gemini Provider marked FATAL (429/Limit:0). Triggering Kill-Switch.', 
            { 
                originalError: error.message, 
                stack: error.stack,
                componentStack: errorInfo.componentStack 
            }
        );
        KEY_MANAGER.reportFailure('GEMINI', 'UNKNOWN_KEY', error);
    } 

    // REPORT TO EXTERNAL ANALYTICS (SENTRY / FIREBASE)
    debugService.reportToExternal(error, {
        viewName: view,
        componentStack: errorInfo.componentStack,
        isFatal: isGeminiFatal
    });
    
    console.error("Uncaught error in module:", view, error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
      if(confirm("This will clear local settings and cached chats to restore the app. Vault backups stay intact. Continue?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  handleCopyError = () => {
      const { error, errorInfo } = this.state;
      const text = `Error: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`;
      navigator.clipboard.writeText(text);
      
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    const { hasError, error, errorInfo, copied } = this.state;
    const { viewName, children } = this.props;

    if (hasError) {
        const errStr = error?.message?.toLowerCase() || '';
        const isGeminiFatal = (errStr.includes('429') || errStr.includes('resource_exhausted')) && errStr.includes('limit: 0');
        const displayMessage = error?.message || "Unknown Error";
        const stackTrace = errorInfo?.componentStack || error?.stack || "No stack trace available.";

      return (
        <div className="h-full w-full flex items-center justify-center p-6 animate-fade-in bg-[var(--bg)] text-[var(--text)] overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-[color:var(--border)] bg-[var(--surface)] shadow-[0_30px_120px_rgba(0,0,0,0.35)] p-8 flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isGeminiFatal ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]'}`}>
                {isGeminiFatal ? <ZapOff size={28} strokeWidth={1.5} /> : <AlertTriangle size={28} strokeWidth={1.5} />}
              </div>
              <div className="flex-1">
                <h2 className="page-title text-[var(--text)] mb-1">Something went wrong</h2>
                <p className="body text-[var(--text-muted)]">
                  {isGeminiFatal
                    ? 'Provider limit reached temporarily. Please retry in a few seconds.'
                    : 'The interface hit an unexpected error. You can retry or clear local data if the issue persists.'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Terminal size={14} />
                  <span className="caption text-[var(--text-muted)]">Diagnostic trace</span>
                </div>
                <button
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                >
                  {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto custom-scroll space-y-3">
                <p className="text-[13px] font-semibold text-[var(--danger)] break-words">{displayMessage}</p>
                <pre className="text-[11px] font-mono text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed">{stackTrace}</pre>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--on-accent-color)] font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <RefreshCw size={16} /> Reload app
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface)] transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert size={16} /> Clear local data
              </button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  }
}
