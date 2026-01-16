import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
  Terminal,
  Layers,
  Network,
  HardDrive,
  Server,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { debugService } from '../../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../../services/geminiService';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { speakWithHanisah } from '../../services/elevenLabsService';
import { type LogEntry } from '../../types';
import { executeMechanicTool } from '../mechanic/mechanicTools';
import { IntegrityMatrix } from './components/IntegrityMatrix';
import { useFeatures } from '../../contexts/FeatureContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & UTILITIES
// ─────────────────────────────────────────────────────────────

const LABEL_CLASS = 'caption text-text-muted font-semibold';

const getStatusColor = (status: 'HEALTHY' | 'COOLDOWN' | 'UNHEALTHY') => {
  switch (status) {
    case 'HEALTHY':
      return {
        dot: 'bg-success',
        text: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/30',
      };
    case 'COOLDOWN':
      return {
        dot: 'bg-warning',
        text: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/30',
      };
    case 'UNHEALTHY':
      return {
        dot: 'bg-danger',
        text: 'text-danger',
        bg: 'bg-danger/10',
        border: 'border-danger/30',
      };
  }
};

const getLatencyStatus = (latency: number) => {
  if (latency < 200) return 'HEALTHY';
  if (latency < 1000) return 'COOLDOWN';
  return 'UNHEALTHY';
};

// ─────────────────────────────────────────────────────────────
// LIVE SPARKLINE COMPONENT
// ─────────────────────────────────────────────────────────────

const LiveSparkline: React.FC<{ data: number[]; color?:  string }> = ({
  data,
  color = 'var(--accent)',
}) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math. min(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-16" preserveAspectRatio="none" viewBox="0 0 100 100">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// ACTION BUTTON COMPONENT
// ─────────────────────────────────────────────────────────────

interface ActionButtonProps {
  label:  string;
  desc:  string;
  onClick: () => void;
  tone?: 'default' | 'accent';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  desc,
  onClick,
  tone = 'default',
}) => {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handle = async () => {
    setState('loading');
    try {
      await onClick();
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch (e) {
      setState('idle');
    }
  };

  const colors =
    tone === 'accent'
      ? 'bg-accent/20 border-accent/50 hover:bg-accent/30 text-accent'
      : 'bg-surface-2/60 border-border/50 hover:bg-surface-2 text-text';

  return (
    <button
      onClick={handle}
      disabled={state !== 'idle'}
      className={`rounded-[var(--radius-lg)] border shadow-[var(--shadow-soft)] p-4 flex flex-col gap-2 items-start hover:-translate-y-0.5 transition-all disabled:opacity-50 ${colors}`}
    >
      <span className="body-sm font-semibold">{label}</span>
      <span className="caption text-text-muted">
        {state === 'done' ? 'Completed' :  state === 'loading' ? 'Processing.. .' : desc}
      </span>
      {state === 'loading' && (
        <RefreshCw size={14} className="animate-spin mt-1" />
      )}
      {state === 'done' && <CheckCircle2 size={14} className="text-success mt-1" />}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// PROVIDER CARD COMPONENT
// ─────────────────────────────────────────────────────────────

const ProviderCard: React.FC<{ provider: ProviderStatus }> = ({ provider }) => {
  const status = provider.status as 'HEALTHY' | 'COOLDOWN' | 'UNHEALTHY';
  const tone = status === 'HEALTHY' ? 'bento-green' : status === 'COOLDOWN' ? 'bento-orange' : 'bento-red';

  return (
    <Card tone={tone as any} padding="sm" bento className="bento-card">
      <div className="bento-card-content">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bento-card-icon">
              <Server size={20} />
            </div>
            <div>
              <p className="bento-card-title text-sm">{provider.id}</p>
              <p className="bento-card-description text-xs">
                {status === 'HEALTHY' ? 'Operational' : status === 'COOLDOWN' ? 'Cooling down' : 'Issues detected'}
              </p>
            </div>
          </div>
          <div className="w-3 h-3 rounded-full bg-white" />
        </div>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN SYSTEMHEALTHVIEW COMPONENT
// ─────────────────────────────────────────────────────────────

export const SystemHealthView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<any>({
    avgLatency: 0,
    memoryMb: 0,
    errorCount: 0,
    storageBytes: 0,
  });
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const { features } = useFeatures();
  const [latencyHistory, setLatencyHistory] = useState<number[]>(
    new Array(30).fill(0)
  );
  const [memoryHistory, setMemoryHistory] = useState<number[]>(
    new Array(30).fill(0)
  );
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS' | 'INTEGRITY'>(
    'OVERVIEW'
  );
  const [isScanning, setIsScanning] = useState(false);
  const [hanisahDiagnosis, setHanisahDiagnosis] = useState<string | null>(null);
  const [realPing, setRealPing] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isStreamFrozen, setIsStreamFrozen] = useLocalStorage<boolean>(
    'kernel_stream_paused',
    false
  );
  const [cliInput, setCliInput] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // ─── Storage Calculation ───
  const calcStorage = () => {
    try {
      let total = 0;
      for (const x in localStorage) {
        if (!Object.prototype.hasOwnProperty. call(localStorage, x)) continue;
        total += (localStorage[x]. length + x.length) * 2;
      }
      setHealth((prev:  any) => ({ ...prev, storageBytes: total }));
    } catch {
      /* ignore */
    }
  };

  // ─── Repair Actions ───
  const executeRepair = async (action: string) => {
    if (action === 'HARD_RESET') {
      if (confirm('This will refresh the app. Continue?')) {
        window.location.reload();
      }
      return;
    }
    await executeMechanicTool({ args: { action } });
    if (action === 'REFRESH_KEYS') setProviders(KEY_MANAGER.getAllProviderStatuses());
    if (action === 'OPTIMIZE_MEMORY') {
      calcStorage();
      setHealth(debugService.getSystemHealth());
    }
  };

  // ─── Ping Test ───
  const handlePing = async () => {
    setRealPing(null);
    const start = Date.now();
    try {
      await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-store',
      });
      setRealPing(Date.now() - start);
    } catch {
      setRealPing(-1);
    }
  };

  // ─── Diagnostics ───
  const runDiagnostics = async () => {
    setIsScanning(true);
    setHanisahDiagnosis(null);
    try {
      const toolResultJson = await executeMechanicTool({
        args: { action: 'GET_DIAGNOSTICS' },
      });
      const prompt = `Please review these system metrics and summarize health, anomalies, and next actions in clear language.\n\n${toolResultJson}`;
      const response = await HANISAH_KERNEL.execute(
        prompt,
        'gemini-3-flash-preview',
        []
      );
      setHanisahDiagnosis(response.text || 'No response generated.');
    } catch (e:  any) {
      setHanisahDiagnosis(`Diagnostics failed: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // ─── CLI Command Handler ───
  const handleCliSubmit = async (e: React. FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim().toLowerCase();
    setCliInput('');

    if (cmd === 'clear') {
      setLogs([]);
      debugService.clear();
    } else if (cmd === 'refresh') {
      setHealth(debugService.getSystemHealth());
      setProviders(KEY_MANAGER.getAllProviderStatuses());
    } else if (cmd === 'diagnose') {
      await runDiagnostics();
    } else if (cmd === 'reload') {
      if (confirm('Reload the app? ')) window.location.reload();
    }
  };

  // ─── Effects ───
  useEffect(() => {
    setLogs(debugService.getLogs());
    calcStorage();
    const unsubscribe = debugService.subscribe((newLogs) => {
      if (! isStreamFrozen) setLogs(newLogs);
    });

    let diagInterval: any = null;
    if (features.AUTO_DIAGNOSTICS) {
      setHealth(debugService.getSystemHealth());
      setProviders(KEY_MANAGER.getAllProviderStatuses());
      diagInterval = setInterval(() => {
        const h = debugService.getSystemHealth();
        setHealth(h);
        setProviders(KEY_MANAGER.getAllProviderStatuses());
        calcStorage();
        setLatencyHistory((prev) => [...prev.slice(1), h.avgLatency]);
        setMemoryHistory((prev) => [
          ...prev.slice(1),
          h.memoryMb || 0,
        ]);
      }, 2000);
    }

    return () => {
      unsubscribe();
      if (diagInterval) clearInterval(diagInterval);
    };
  }, [features.AUTO_DIAGNOSTICS, isStreamFrozen]);

  // ─── Auto-scroll Logs ───
  useEffect(() => {
    if (isAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // ─── Filter & Search Logs ───
  const filteredLogs = logs.filter((log) => {
    const matchFilter = logFilter === 'ALL' || log.level === logFilter;
    const matchSearch =
      logSearch === '' ||
      log.message.toLowerCase().includes(logSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const healthStatus = getLatencyStatus(health.avgLatency);
  const healthColors = getStatusColor(healthStatus as any);

  return (
    <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1. 5rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] md:px-8 lg:px-12 bg-bg text-text">
      <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col gap-6">
        {/* ═════════════════════════════════════════ HEADER ═════════════════════════════════════════ */}
        <header className="flex flex-col gap-4">
          <Card tone={healthStatus === 'HEALTHY' ? "bento-green" : healthStatus === 'COOLDOWN' ? "bento-orange" : "bento-red"} padding="bento" bento className="bento-card shadow-[0_30px_100px_-60px_rgba(var(--accent-rgb),0.8)]">
            <div className="bento-card-content">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-2">
                  <p className="caption opacity-80">System Status</p>
                  <h1 className="bento-card-title text-2xl md:text-3xl">
                    Health & Diagnostics
                  </h1>
                  <p className="bento-card-description">
                    Real-time monitoring of providers, latency, and system integrity. 
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/30">
                    <div className="w-2 h-2 rounded-full bg-white" />
                    <span className="text-sm font-semibold text-white">
                      {healthStatus === 'HEALTHY'
                        ? 'All Systems Operational'
                        :  healthStatus === 'COOLDOWN'
                        ? 'Some Issues Detected'
                        : 'Critical Issues'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-border/50">
              <div className="px-3 py-1.5 rounded-full bg-surface-2 text-xs font-semibold text-text flex items-center gap-2">
                <ShieldCheck size={13} /> {providers.length} providers
              </div>
              <div className="px-3 py-1.5 rounded-full bg-surface-2 text-xs font-semibold text-text flex items-center gap-2">
                <Wifi size={13} />{' '}
                {realPing !== null
                  ? realPing === -1
                    ? 'No connectivity'
                    : `${realPing}ms ping`
                  : 'Ping idle'}
              </div>
              <div className="px-3 py-1.5 rounded-full bg-surface-2 text-xs font-semibold text-text flex items-center gap-2">
                <Activity size={13} /> {logs.length} log entries
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex mt-4 pt-4 border-t border-[color:var(--border)]/50">
              <div className="flex gap-2 bg-[var(--surface)] border border-[color:var(--border)]/50 rounded-[var(--radius-md)] p-1 shadow-[var(--shadow-soft)]">
                {[
                  { key: 'OVERVIEW', icon: <Activity size={14} />, label: 'Overview' },
                  { key:  'LOGS', icon: <Terminal size={14} />, label:  'Logs' },
                  { key: 'INTEGRITY', icon: <Layers size={14} />, label:  'Integrity' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-4 py-2 rounded-[var(--radius-sm)] caption font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'bg-[var(--accent)] text-[var(--text-invert)] shadow-[var(--shadow-bento)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {tab. icon}
                    {tab. label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </header>

        {/* ═════════════════════════════════════════ CONTENT ═════════════════════════════════════════ */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === 'OVERVIEW' && (
            <div className="bento-grid grid grid-cols-1 lg:grid-cols-12 gap-[var(--bento-gap)] h-full overflow-y-auto pb-6 custom-scroll animate-fade-in">
              <div className="lg:col-span-8 space-y-6">
                {/* Metrics Grid */}
                <div className="bento-grid grid grid-cols-1 md:grid-cols-3 gap-[var(--bento-gap)]">
                  {/* Latency Card */}
                  <Card tone="bento-blue" padding="bento" bento className="bento-card h-full">
                    <div className="bento-card-content">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="bento-card-icon">
                            <Network size={24} />
                          </div>
                          <span className="caption opacity-80">Latency</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <p className="bento-card-title mt-2">{health.avgLatency || '—'} ms</p>
                      <LiveSparkline data={latencyHistory} color="rgba(255,255,255,0.8)" />
                    </div>
                  </Card>

                  {/* Memory Card */}
                  <Card tone="bento-orange" padding="bento" bento className="bento-card h-full">
                    <div className="bento-card-content">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="bento-card-icon">
                            <HardDrive size={24} />
                          </div>
                          <span className="caption opacity-80">Memory</span>
                        </div>
                      </div>
                      <p className="bento-card-title mt-2">{health.memoryMb ?  `${health.memoryMb}MB` : '—'}</p>
                      <LiveSparkline data={memoryHistory} color="rgba(255,255,255,0.8)" />
                    </div>
                  </Card>

                  {/* Ping Card */}
                  <Card tone="bento-green" padding="bento" bento className="bento-card h-full">
                    <div className="bento-card-content">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="bento-card-icon">
                            <Wifi size={24} />
                          </div>
                          <span className="caption opacity-80">Ping</span>
                        </div>
                        <button
                          onClick={handlePing}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                          title="Test network ping"
                        >
                          <RefreshCw size={13} className="text-white/80" />
                        </button>
                      </div>
                      <p className="bento-card-title mt-2">
                        {realPing !== null ? (realPing === -1 ? 'Error' : `${realPing}ms`) : '—'}
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Providers Section */}
                <Card tone="bento-teal" padding="bento" bento className="bento-card">
                  <div className="bento-card-content">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bento-card-icon">
                        <Server size={24} />
                      </div>
                      <h3 className="bento-card-title">API Providers</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {providers.length > 0 ? (
                        providers.map((p) => <ProviderCard key={p. id} provider={p} />)
                      ) : (
                        <p className="bento-card-description col-span-full">
                          No providers loaded. 
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md: grid-cols-3 gap-4">
                  <ActionButton
                    label="Optimize Storage"
                    desc="Clear cached data"
                    onClick={() => executeRepair('OPTIMIZE_MEMORY')}
                  />
                  <ActionButton
                    label="Refresh Keys"
                    desc="Rotate API credentials"
                    onClick={() => executeRepair('REFRESH_KEYS')}
                  />
                  <ActionButton
                    label="Reload App"
                    desc="Restart session"
                    tone="accent"
                    onClick={() => executeRepair('HARD_RESET')}
                  />
                </div>
              </div>

              {/* Right Sidebar:  Diagnostics */}
              <div className="lg:col-span-4 space-y-4">
                <Card tone="bento-purple" padding="bento" bento className="bento-card flex flex-col h-full">
                  <div className="bento-card-content flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bento-card-icon">
                        <Stethoscope size={24} />
                      </div>
                      <h3 className="bento-card-title">AI Diagnostics</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scroll mb-4">
                      {hanisahDiagnosis ?  (
                        <Markdown className="prose dark:prose-invert prose-sm max-w-none text-sm text-white/90">
                          {hanisahDiagnosis}
                        </Markdown>
                      ) : (
                        <p className="bento-card-description">
                          Run diagnostics to see a summary. 
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={runDiagnostics}
                      disabled={isScanning}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                      variant={isScanning ? 'subtle' : 'primary'}
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Running... 
                        </>
                      ) : (
                        <>
                          <Stethoscope size={14} />
                          Run Diagnostics
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ─── LOGS TAB ─── */}
          {activeTab === 'LOGS' && (
            <Card className="h-full flex flex-col border-[color:var(--border)]/50 overflow-hidden shadow-[var(--shadow-bento)] rounded-[var(--bento-radius)] animate-fade-in">
              {/* Log Controls */}
              <div className="p-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={LABEL_CLASS}>Activity Log</span>
                  <div className="flex gap-1 bg-surface border border-border rounded-md p-0.5">
                    {['ALL', 'INFO', 'WARN', 'ERROR']. map((level) => (
                      <button
                        key={level}
                        onClick={() => setLogFilter(level)}
                        className={`px-2.5 py-1 rounded caption font-semibold transition-colors ${
                          logFilter === level
                            ? 'bg-surface-2 text-text'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <button
                    onClick={() => setIsStreamFrozen(!isStreamFrozen)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                    title={isStreamFrozen ?  'Resume stream' : 'Pause stream'}
                  >
                    {isStreamFrozen ? (
                      <Eye size={16} className="text-text-muted" />
                    ) : (
                      <EyeOff size={16} className="text-text-muted" />
                    )}
                  </button>
                </div>
              </div>

              {/* Log List */}
              <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-2">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, idx) => {
                    const levelColor =
                      log.level === 'ERROR'
                        ? 'text-danger'
                        : log.level === 'WARN'
                        ? 'text-warning'
                        : 'text-success';
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-surface-2/50 border border-border/30 rounded-lg text-xs font-mono text-text-muted hover:bg-surface-2 transition-colors break-words"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-text-muted opacity-70 flex-shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`font-semibold flex-shrink-0 ${levelColor}`}>
                            [{log.level}]
                          </span>
                          <span className="flex-1 text-text">{log.message}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full text-center">
                    <p className="caption text-text-muted">
                      {logSearch || logFilter !== 'ALL'
                        ? 'No matching logs.'
                        : 'No logs yet. '}
                    </p>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>

              {/* CLI Input */}
              <form
                onSubmit={handleCliSubmit}
                className="border-t border-border p-4 flex items-center gap-2"
              >
                <span className="text-accent font-bold">{'>'}</span>
                <Input
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="clear | refresh | diagnose | reload"
                  className="flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="min-h-[40px]">
                  <ArrowRight size={12} />
                </Button>
              </form>
            </Card>
          )}

          {/* ─── INTEGRITY TAB ─── */}
          {activeTab === 'INTEGRITY' && (
            <div className="h-full overflow-y-auto custom-scroll pb-6 animate-fade-in">
              <Card className="border-[color:var(--border)]/50 shadow-[var(--shadow-bento)] rounded-[var(--bento-radius)]">
                <IntegrityMatrix />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};