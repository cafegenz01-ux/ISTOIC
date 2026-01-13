export const authStyles = {
 
  card: "backdrop-blur-2xl border border-[var(--border-base)] bg-[var(--bg-card)]/90 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(var(--shadow-color),0.18)] relative overflow-hidden",
  title: "text-xl font-black text-[var(--text-main)] uppercase tracking-tight",
  subtitle: "text-[10px] text-[var(--text-muted)] font-mono mt-1 uppercase tracking-[0.2em]",
  label: "text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest ml-1",
  input:
    "w-full bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl px-5 py-4 text-sm font-semibold text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all duration-200 ease-out placeholder:text-[var(--text-muted)]",
  inputIconWrap:
    "w-full bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-2xl px-5 py-4 pl-12 text-sm font-semibold text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all duration-200 ease-out placeholder:text-[var(--text-muted)]",
  inputError: "border-[var(--accent-color)] focus:border-[var(--accent-color)]",
  buttonPrimary:
    "w-full py-4 bg-[var(--accent-color)] text-[var(--on-accent-color)] hover:brightness-110 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all duration-200 ease-out shadow-[0_12px_30px_rgba(var(--shadow-color),0.18)] active:scale-95 disabled:opacity-70",
  buttonSecondary:
    "w-full py-4 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-main)] rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 border border-[var(--border-base)] shadow-[0_12px_30px_rgba(var(--shadow-color),0.16)] transition-all duration-200 ease-out active:scale-95 disabled:opacity-70",
  buttonGhost:
    "w-full py-3 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors duration-200 ease-out",
  linkMuted: "text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors duration-200 ease-out",
  alertError:
    "p-3 bg-[var(--bg-surface)] border border-[var(--border-highlight)] rounded-xl text-[var(--accent-color)] text-xs font-bold text-center mb-4 flex items-center justify-center gap-2",
  alertInfo:
    "p-3 bg-[var(--bg-surface)] border border-[var(--border-highlight)] rounded-xl text-[var(--text-main)] text-xs font-bold text-center mb-4",
  alertSuccess:
    "p-3 bg-[var(--bg-surface)] border border-[var(--border-highlight)] rounded-xl text-[var(--accent-color)] text-xs font-bold text-center mb-4",

  card: "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]/92 p-[var(--space-6)] shadow-[var(--shadow)] backdrop-blur-xl",
  title: "text-xl font-semibold text-[var(--text-primary)] uppercase tracking-tight",
  subtitle: "text-[10px] text-[var(--text-muted)] font-mono mt-[var(--space-1)] uppercase tracking-[0.2em]",
  label: "text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest ml-[var(--space-1)]",
  input:
    "w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)] text-sm font-semibold text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.25)] outline-none transition-all placeholder:text-[var(--text-muted)]",
  inputIconWrap:
    "w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)] pl-[var(--space-6)] text-sm font-semibold text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.25)] outline-none transition-all placeholder:text-[var(--text-muted)]",
  inputError: "border-[var(--danger)] focus:border-[var(--danger)]",
  buttonPrimary:
    "w-full py-[var(--space-4)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-105 rounded-[var(--radius-md)] font-semibold uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)] transition-all duration-200 shadow-[var(--shadow)] active:scale-[0.98] disabled:opacity-60",
  buttonSecondary:
    "w-full py-[var(--space-4)] bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-[var(--radius-md)] font-semibold uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)] shadow-[var(--shadow)] active:scale-[0.98] disabled:opacity-60",
  buttonGhost:
    "w-full py-[var(--space-3)] text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)]",
  linkMuted: "text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]",
  alertError:
    "p-[var(--space-3)] bg-[var(--danger-soft)] border border-[var(--danger)] rounded-[var(--radius-sm)] text-[var(--danger)] text-xs font-semibold text-center mb-[var(--space-4)] flex items-center justify-center gap-[var(--space-2)]",
  alertInfo:
    "p-[var(--space-3)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] text-xs font-semibold text-center mb-[var(--space-4)]",
  alertSuccess:
    "p-[var(--space-3)] bg-[var(--success-soft)] border border-[var(--success)] rounded-[var(--radius-sm)] text-[var(--success)] text-xs font-semibold text-center mb-[var(--space-4)]",
};
