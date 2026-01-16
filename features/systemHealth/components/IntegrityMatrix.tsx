import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Info,
  ToggleLeft,
  ToggleRight,
  Zap,
  Wifi,
  Activity,
  Eye,
  Layers,
  Shield,
} from 'lucide-react';
import { debugService, type UIStatus } from '../../../services/debugService';
import { useFeatures, type SystemFeature } from '../../../contexts/FeatureContext';

// ─────────────────────────────────────────────────────────────
// STATUS COLOR MAP
// ─────────────────────────────────────────────────────────────

const STATUS_COLOR_MAP = {
  DISABLED: {
    bg: 'bg-danger/10',
    border: 'border-danger/50',
    text: 'text-danger',
    shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
  },
  UNSTABLE: {
    bg: 'bg-warning/10',
    border: 'border-warning/50',
    text: 'text-warning',
    shadow: 'shadow-[0_0_15px_rgba(240,180,38,0.15)] animate-pulse',
  },
  ACTIVE: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-success',
    shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
  },
};

// ─────────────────────────────────────────────────────────────
// UI ELEMENT NODE COMPONENT
// ─────────────────────────────────────────────────────────────

interface UIElementNodeProps {
  id: string;
  status: UIStatus;
  errors: number;
  usage: number;
  onToggle: () => void;
}

const UIElementNode: React.FC<UIElementNodeProps> = ({
  id,
  status,
  errors,
  usage,
  onToggle,
}) => {
  const colors = STATUS_COLOR_MAP[status];
  const cleanName = id.replace(/UI_|BTN_/g, '').replace(/_/g, ' ');

  return (
    <button
      onClick={onToggle}
      className={`relative p-3 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between h-24 group hover:scale-[1.02] active:scale-[0.98] ${colors.bg} ${colors.border} ${colors.text} ${colors.shadow} backdrop-blur-sm`}
      title={id}
    >
      {/* Background Icon */}
      <div className="absolute top-1.5 right-1.5 opacity-20">
        <LayoutGrid size={40} strokeWidth={0.5} />
      </div>

      {/* Error & Toggle */}
      <div className="flex justify-between items-start relative z-10">
        <div className="text-[8px] font-mono opacity-70">
          ERR: <span className={errors > 0 ? `font-bold` : ''}>{errors}</span>
        </div>
        <div className="p-1 rounded bg-current/10 text-current">
          {status === 'DISABLED' ?  (
            <ToggleLeft size={12} />
          ) : (
            <ToggleRight size={12} />
          )}
        </div>
      </div>

      {/* Label & Usage */}
      <div className="relative z-10">
        <div className="text-[9px] font-black uppercase tracking-wider truncate mb-1">
          {cleanName}
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-[7px] font-mono opacity-80">
            {usage} INTERACTIONS
          </span>
        </div>
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// FEATURE TOGGLE CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface FeatureToggleCardProps {
  id: SystemFeature;
  label: string;
  desc: string;
  icon: React.ReactNode;
  isEnabled: boolean;
  onToggle: () => void;
}

const FeatureToggleCard: React.FC<FeatureToggleCardProps> = ({
  label,
  desc,
  icon,
  isEnabled,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group text-left relative overflow-hidden ${
      isEnabled
        ? 'bg-accent/10 border-accent/30 hover:bg-accent/15'
        : 'bg-surface-2/50 border-white/5 opacity-60 hover:opacity-100'
    }`}
  >
    {isEnabled && (
      <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />
    )}

    <div className="flex items-center gap-4 relative z-10">
      <div
        className={`p-2.5 rounded-lg transition-colors ${
          isEnabled
            ? 'bg-accent text-text-invert shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]'
            : 'bg-white/5 text-text-muted'
        }`}
      >
        {icon}
      </div>
      <div>
        <h4
          className={`text-[10px] font-black uppercase tracking-widest ${
            isEnabled ? 'text-text' : 'text-text-muted'
          }`}
        >
          {label}
        </h4>
        <p className="text-[9px] text-text-muted font-mono mt-0.5">{desc}</p>
      </div>
    </div>
    <div
      className={`transition-colors relative z-10 ${isEnabled ? 'text-accent' : 'text-text-muted'}`}
    >
      {isEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
    </div>
  </button>
);

// ─────────────────────────────────────────────────────────────
// MAIN INTEGRITY MATRIX COMPONENT
// ─────────────────────────────────────────────────────────────

export const IntegrityMatrix: React.FC = () => {
  const [uiMatrix, setUiMatrix] = useState<Record<string, any>>(
    debugService.getUIMatrix()
  );
  const { features, toggleFeature } = useFeatures();

  useEffect(() => {
    const unsubscribe = debugService.subscribeUI((state) => setUiMatrix(state));
    return () => unsubscribe();
  }, []);

  const toggleUIElement = (id: string) => {
    const current = uiMatrix[id];
    const newStatus = current.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    debugService.setUIStatus(id, newStatus);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-20 bg-bg rounded-[var(--radius-xl)] border border-border/50 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.3)]">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-50 pointer-events-none" style={{backgroundImage: `url('data:image/svg+xml,<svg width=%2240%22 height=%2240%22 xmlns=%22http://www.w3.org/2000/svg%22><defs><pattern id=%22grid%22 width=%2240%22 height=%2240%22 patternUnits=%22userSpaceOnUse%22><path d=%22M 40 0 L 0 0 0 40%22 fill=%22none%22 stroke=%22rgba(255,255,255,0.05)%22 stroke-width=%220.5%22/></pattern></defs><rect width=%22100%25%22 height=%22100%25%22 fill=%22url(%2523grid)%22 /></svg>')`}} />
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none rounded-[var(--radius-xl)]" />

      {/* ═════════════════════════════════════════ SECTION 1: SYSTEM CONTROLS ═════════════════════════════════════════ */}
      <div className="mb-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-accent" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text">
              System Controls
            </h3>
          </div>
          <span className="text-[9px] font-bold bg-accent/10 text-accent px-2.5 py-1.5 rounded-full border border-accent/30">
            Status: Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureToggleCard
            id="OMNI_RACE"
            label="HYDRA OMNI-RACE"
            desc="Parallel API execution (4x bandwidth)."
            icon={<Zap size={16} />}
            isEnabled={features.OMNI_RACE}
            onToggle={() => toggleFeature('OMNI_RACE')}
          />
          <FeatureToggleCard
            id="LIVE_LINK"
            label="NEURAL LINK (AUDIO)"
            desc="WebRTC audio streaming (high battery)."
            icon={<Wifi size={16} />}
            isEnabled={features.LIVE_LINK}
            onToggle={() => toggleFeature('LIVE_LINK')}
          />
          <FeatureToggleCard
            id="VISUAL_ENGINE"
            label="CANVAS VISUALIZER"
            desc="Real-time audio graph (high GPU)."
            icon={<Eye size={16} />}
            isEnabled={features.VISUAL_ENGINE}
            onToggle={() => toggleFeature('VISUAL_ENGINE')}
          />
          <FeatureToggleCard
            id="HIGH_PERF_UI"
            label="GLASSMORPHIC ENGINE"
            desc="Blur effects & animations (high GPU)."
            icon={<Layers size={16} />}
            isEnabled={features.HIGH_PERF_UI}
            onToggle={() => toggleFeature('HIGH_PERF_UI')}
          />
          <FeatureToggleCard
            id="AUTO_DIAGNOSTICS"
            label="AUTO_MECHANIC"
            desc="Background system polling (high CPU)."
            icon={<Activity size={16} />}
            isEnabled={features.AUTO_DIAGNOSTICS}
            onToggle={() => toggleFeature('AUTO_DIAGNOSTICS')}
          />
        </div>
      </div>

      <div className="h-[1px] bg-border/50 my-8 relative z-10" />

      {/* ═════════════════════════════════════════ SECTION 2: UI GOVERNANCE MATRIX ═════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <LayoutGrid size={18} className="text-success" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text">
            UI Governance Matrix
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-text-muted font-mono">
          <Info size={12} className="text-success" />
          <span>TAP TO TOGGLE NODES</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative z-10">
        {Object.values(uiMatrix).map((el: any) => (
          <UIElementNode
            key={el.id}
            id={el.id}
            status={el.status}
            errors={el.errorCount}
            usage={el.usageCount}
            onToggle={() => toggleUIElement(el.id)}
          />
        ))}
      </div>
    </div>
  );
};