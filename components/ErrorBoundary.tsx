
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
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
  
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

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
      if(confirm("FACTORY RESET: This will clear all app configuration, cached chats, and local settings to fix corruption. Your Vault data should persist if backed up. Proceed?")) {
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
        <div className="h-full w-full flex items-center justify-center p-6 animate-fade-in bg-[#f8f9fa] dark:bg-[#050505] overflow-y-auto">
          <div className={`glass-card-3d p-8 max-w-lg w-full shadow-[0_0_50px_rgba(220,38,38,0.1)] flex flex-col items-center text-center ${isGeminiFatal ? 'border-amber-500/30 bg-amber-950/[0.05]' : 'border-red-500/30 bg-red-950/[0.05]'}`}>
            
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse-slow ${isGeminiFatal ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {isGeminiFatal ? <ZapOff size={40} strokeWidth={1.5} /> : <AlertTriangle size={40} strokeWidth={1.5} />}
            </div>
            
            <h2 className={`text-2xl font-black uppercase italic tracking-tighter mb-2 leading-none ${isGeminiFatal ? 'text-amber-500' : 'text-red-500'}`}>
              {isGeminiFatal ? 'RESOURCE DEPLETED' : 'CRITICAL FAILURE'}
            </h2>
            <p className={`text-[10px] tech-mono font-bold uppercase tracking-[0.3em] mb-6 ${isGeminiFatal ? 'text-amber-400/70' : 'text-red-400/70'}`}>
              MODULE: {viewName || 'KERNEL'} // {isGeminiFatal ? 'QUOTA_LIMIT' : 'RUNTIME_EXCEPTION'}
            </p>
            
            <div className={`w-full bg-black/80 p-0 rounded-xl border mb-6 text-left relative overflow-hidden group flex flex-col ${isGeminiFatal ? 'border-amber-500/20' : 'border-red-500/20'}`}>
                <div className={`flex items-center justify-between p-3 border-b ${isGeminiFatal ? 'border-amber-500/10 bg-amber-500/5' : 'border-red-500/10 bg-red-500/5'}`}>
                    <div className="flex items-center gap-2 text-white/50">
                        <Terminal size={12} />
                        <span className="text-[8px] font-black uppercase tracking-widest">DIAGNOSTIC_TRACE</span>
                    </div>
                    <button onClick={this.handleCopyError} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-[9px] font-bold uppercase text-neutral-400 hover:text-white">
                        {copied ? <Check size={10} className="text-green-500"/> : <Copy size={10}/>}
                        {copied ? 'COPIED' : 'COPY'}
                    </button>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto custom-scroll">
                    <p className="text-[11px] font-mono break-words leading-relaxed text-red-300 font-bold mb-3 border-b border-white/5 pb-3">{displayMessage}</p>
                    <pre className="text-[9px] font-mono text-neutral-500 whitespace-pre-wrap leading-relaxed">{stackTrace}</pre>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={this.handleReload} className={`w-full py-3.5 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-95 ${isGeminiFatal ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}>
                  <RefreshCw size={14} /> SYSTEM REBOOT
                </button>
                <button onClick={this.handleReset} className="w-full py-3.5 bg-zinc-800 text-neutral-400 hover:text-white hover:bg-zinc-700 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-95 border border-white/5">
                  <ShieldAlert size={14} /> FACTORY RESET
                </button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  }
}
