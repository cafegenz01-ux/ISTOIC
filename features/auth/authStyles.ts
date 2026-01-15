/**
 * Authentication Styles
 * Uses CSS variables for consistency with main ISTOIC theme
 */
export const authStyles = {
  // Card & Container Styles
  card: "border border-[color:var(--border)] bg-[color:var(--surface)] rounded-[var(--radius-xl)] p-7 sm:p-8 shadow-[var(--shadow-soft)] relative",
  
  // Typography Styles
  title: "text-[22px] font-semibold text-[color:var(--text)] tracking-tight",
  subtitle: "text-sm text-[color:var(--text-muted)] mt-1",
  label: "text-xs font-semibold text-[color:var(--text-muted)]",
  
  // Input Styles
  input:
    "w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-3 text-sm font-semibold text-[color:var(--text)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--ring)]/30 outline-none transition-all placeholder:text-[color:var(--text-muted)]/70",
  inputIconWrap:
    "w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-3 pl-11 text-sm font-semibold text-[color:var(--text)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--ring)]/30 outline-none transition-all placeholder:text-[color:var(--text-muted)]/70",
  inputError: "border-[color:var(--danger)] focus:border-[color:var(--danger)] focus:ring-[color:var(--danger)]/20",
  
  // Button Styles
  buttonPrimary:
    "w-full py-3.5 bg-[color:var(--primary)] text-[color:var(--primary-contrast)] rounded-[var(--radius-lg)] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[var(--shadow-soft)] hover:brightness-95 active:scale-[0.99] disabled:opacity-60",
  buttonSecondary:
    "w-full py-3.5 bg-[color:var(--surface-2)] text-[color:var(--text)] rounded-[var(--radius-lg)] font-semibold text-sm flex items-center justify-center gap-2 shadow-[var(--shadow-soft)] border border-[color:var(--border)] hover:border-[color:var(--primary)]/40 active:scale-[0.99] disabled:opacity-60",
  buttonGhost:
    "w-full py-2.5 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text)] flex items-center justify-center gap-2 transition-colors",
  linkMuted: "text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors",
  
  // Alert Styles
  alertError:
    "p-3 bg-[color:var(--danger)]/10 border border-[color:var(--danger)]/30 rounded-[var(--radius-md)] text-[color:var(--danger)] text-xs font-semibold text-center mb-4 flex items-center justify-center gap-2",
  alertInfo:
    "p-3 bg-[color:var(--info)]/10 border border-[color:var(--info)]/30 rounded-[var(--radius-md)] text-[color:var(--info)] text-xs font-semibold text-center mb-4",
  alertSuccess:
    "p-3 bg-[color:var(--success)]/10 border border-[color:var(--success)]/30 rounded-[var(--radius-md)] text-[color:var(--success)] text-xs font-semibold text-center mb-4",
};
