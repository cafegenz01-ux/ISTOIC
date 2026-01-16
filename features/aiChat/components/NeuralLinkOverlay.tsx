import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Brain, Radio, Activity, Zap, Shield, Volume2 } from 'lucide-react';
import { type NeuralLinkStatus } from '../../../services/neuralLink';
import { useFeatures } from '../../../contexts/FeatureContext';
import { useLiveSession } from '../../../contexts/LiveSessionContext';
import { Dialog } from '../../../components/ui/Dialog';
import { VoiceSelector } from './VoiceSelector';

interface NeuralLinkOverlayProps {
  isOpen: boolean;
  status: NeuralLinkStatus;
  personaMode: 'hanisah' | 'stoic';
  transcriptHistory: Array<{ role: 'user' | 'model'; text: string }>;
  interimTranscript: { role: 'user' | 'model'; text: string } | null;
  onTerminate: () => void;
  onMinimize: () => void;
  analyser?: AnalyserNode | null;
  activeTool?: string | null;
}

const statusCopy: Record<NeuralLinkStatus, { label: string; tone: string }> = {
  IDLE: { label: 'Idle', tone: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[color:var(--border)]' },
  CONNECTING: { label: 'Connecting', tone: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[color:var(--accent)]/30' },
  ACTIVE: { label: 'Live', tone: 'bg-[var(--success)]/10 text-[var(--success)] border-[color:var(--success)]/40' },
  ERROR: { label: 'Error', tone: 'bg-[var(--danger)]/10 text-[var(--danger)] border-[color:var(--danger)]/40' },
  RECONNECTING: { label: 'Reconnecting', tone: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[color:var(--warning)]/40' },
  THINKING: { label: 'Thinking', tone: 'bg-[var(--accent-2)]/10 text-[var(--accent-2)] border-[color:var(--accent-2)]/40' },
  SPEAKING: { label: 'Speaking', tone: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[color:var(--accent)]/40' }
};

export const NeuralLinkOverlay: React.FC<NeuralLinkOverlayProps> = ({
  isOpen,
  status,
  personaMode,
  transcriptHistory,
  interimTranscript,
  onTerminate,
  onMinimize,
  analyser,
  activeTool
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [level, setLevel] = useState(0);

  const { micMode, setMicMode, currentVoice, changeVoice, engine, setEngine } = useLiveSession();
  const { isFeatureEnabled } = useFeatures();
  const isVisualEngineEnabled = isFeatureEnabled('VISUAL_ENGINE');

  useEffect(() => {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let raf: number;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      setLevel(avg);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [transcriptHistory, interimTranscript]);

  const personaChip = useMemo(
    () => (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[color:var(--border)] text-[var(--text)]">
        {personaMode === 'hanisah' ? <Flame size={16} /> : <Brain size={16} />}
        <span className="text-[12px] font-semibold uppercase">{personaMode === 'hanisah' ? 'Hanisah Voice' : 'Stoic Voice'}</span>
      </div>
    ),
    [personaMode]
  );

  if (!isOpen) return null;

  const statusStyle = statusCopy[status] || statusCopy.IDLE;

  return (
    <Dialog open={isOpen} onClose={onMinimize} size="full" title="Neural Link">
      <div className="flex flex-col gap-4 h-full bg-[var(--bg)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[color:var(--border)] pb-3">
          <div className="flex flex-wrap items-center gap-3">
            {personaChip}
            <div className={`px-3 py-1.5 rounded-full border ${statusStyle.tone} text-[12px] font-semibold uppercase`}>
              <span className="inline-flex items-center gap-2">
                <Radio size={14} /> {statusStyle.label}
              </span>
            </div>
            {activeTool && (
              <div className="px-3 py-1.5 rounded-full border border-[color:var(--accent)] text-[var(--accent)] text-[12px] font-semibold uppercase">
                <Shield size={14} /> Tool: {activeTool.replace(/_/g, ' ')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEngine('GEMINI_REALTIME')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                engine === 'GEMINI_REALTIME'
                  ? 'bg-[var(--accent)] text-[var(--on-accent-color)] border-transparent'
                  : 'bg-[var(--surface-2)] text-[var(--text)] border-[color:var(--border)]'
              }`}
            >
              <Zap size={14} className="inline mr-1" /> Fast
            </button>
            <button
              onClick={() => setEngine('HYDRA_HYBRID')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                engine === 'HYDRA_HYBRID'
                  ? 'bg-[var(--accent)] text-[var(--on-accent-color)] border-transparent'
                  : 'bg-[var(--surface-2)] text-[var(--text)] border-[color:var(--border)]'
              }`}
            >
              <Shield size={14} className="inline mr-1" /> Stable
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 flex flex-col h-[60vh] md:h-[55vh] border border-[color:var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center gap-3">
                <Volume2 size={16} className="text-[var(--text-muted)]" />
                <div className="w-28 h-2 rounded-full bg-[var(--surface)] border border-[color:var(--border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.min(100, Math.round((level / 255) * 100))}%` }}
                  ></div>
                </div>
                <span className="text-[12px] text-[var(--text-muted)]">{Math.round(level)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)]">Mic Mode</span>
                <select
                  value={micMode}
                  onChange={(e) => setMicMode(e.target.value as any)}
                  className="bg-[var(--surface)] border border-[color:var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text)]"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="ISOLATION">Isolation</option>
                  <option value="HIGH_FIDELITY">Hi-Fi</option>
                </select>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scroll">
              {transcriptHistory.map((item, idx) => (
                <div key={`${item.role}-${idx}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl border text-sm leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-[var(--accent)] text-[var(--on-accent-color)] border-[color:var(--accent)]/40'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border-[color:var(--border)]'
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
              {interimTranscript && (
                <div className={`flex ${interimTranscript.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] px-4 py-3 rounded-2xl border border-[color:var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]">
                    {interimTranscript.text}
                    <span className="inline-block w-2 h-4 ml-1 align-middle bg-[var(--accent)] animate-pulse"></span>
                  </div>
                </div>
              )}
              {!interimTranscript && !transcriptHistory.length && (
                <div className="text-center text-[var(--text-muted)] text-[12px]">Say something to start the link.</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider">Voice</span>
                <button
                  onClick={() => setShowVoiceSelector(true)}
                  className="text-[12px] font-semibold text-[var(--accent)] hover:underline"
                >
                  {currentVoice}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider">Visual</span>
                <span className={`px-2 py-1 rounded-full text-[11px] border ${isVisualEngineEnabled ? 'text-[var(--success)] border-[color:var(--success)]/50' : 'text-[var(--text-muted)] border-[color:var(--border)]'}`}>
                  {isVisualEngineEnabled ? 'Enabled' : 'Off'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onMinimize}
                className="flex-1 h-12 rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] text-[var(--text)] font-semibold hover:border-[color:var(--accent)] transition-all"
              >
                Minimize
              </button>
              <button
                onClick={onTerminate}
                className="flex-1 h-12 rounded-xl bg-[var(--danger)] text-[var(--on-accent-color)] font-semibold shadow hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Activity size={16} className="animate-pulse" /> End
              </button>
            </div>
          </div>
        </div>
      </div>

      {showVoiceSelector && <VoiceSelector currentVoice={currentVoice} onSelect={(v) => { changeVoice(v); setShowVoiceSelector(false); }} onClose={() => setShowVoiceSelector(false)} />}
    </Dialog>
  );
};
