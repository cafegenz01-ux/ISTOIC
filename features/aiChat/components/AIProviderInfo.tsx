import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';

interface AIProviderInfoProps {
  metadata?: {
    provider?: string;
    model?: string;
    latency?: number;
    [key: string]: any;
  };
  isHydra?: boolean;
  className?: string;
}

export const AIProviderInfo: React.FC<AIProviderInfoProps> = ({ metadata, isHydra, className = '' }) => {
  if (!metadata) return null;

  const provider = (metadata.provider || 'Unknown').toString();
  const model = (metadata.model || 'Unknown model').toString();
  const latency = metadata.latency;

  return (
    <div className={`flex items-center flex-wrap gap-2 mt-2 select-none ${className}`}>
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text)]">
        <div className="flex flex-col leading-none gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {isHydra ? 'Hydra Route' : provider}
          </span>
          <span className="text-[11px] font-semibold truncate max-w-[180px]">{model}</span>
        </div>
      </div>

      {typeof latency === 'number' && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[color:var(--border)] text-[var(--text-muted)]">
          <Clock size={10} />
          <span className="text-[10px] font-mono">{latency}ms</span>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[color:var(--border)] text-[var(--text-muted)]">
        <ShieldCheck size={10} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Protected</span>
      </div>
    </div>
  );
};
