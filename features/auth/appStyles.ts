/**
 * Application-Wide Styling System
 * Consistent with login/auth design for all modules
 * Supports dark/light mode and custom color themes
 */
export const appStyles = {
  // Card & Container Styles (matching authStyles)
  card: "bg-[color:var(--surface)] rounded-[var(--radius-xl)] p-7 sm:p-8 shadow-[var(--shadow-soft)] relative",
  cardCompact: "bg-[color:var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-6 shadow-[var(--shadow-soft)] relative",
  cardMinimal: "bg-[color:var(--surface)] rounded-[var(--radius-md)] p-3 sm:p-4 shadow-[var(--shadow-soft)] relative",
  
  // Typography Styles
  title: "text-[22px] font-semibold text-[color:var(--text)] tracking-tight",
  titleLarge: "text-3xl md:text-4xl font-black tracking-tight text-[color:var(--text)]",
  subtitle: "text-sm text-[color:var(--text-muted)] mt-1",
  label: "text-xs font-semibold text-[color:var(--text-muted)]",
  body: "text-sm text-[color:var(--text)]",
  bodyMuted: "text-sm text-[color:var(--text-muted)]",
  
  // Input Styles (matching authStyles)
  input:
    "w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-xl)] px-4 py-4 text-sm font-semibold text-[color:var(--text)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--ring)]/30 outline-none transition-all placeholder:text-[color:var(--text-muted)]/70 min-h-[48px]",
  inputIconWrap:
    "w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-3 pl-11 text-sm font-semibold text-[color:var(--text)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--ring)]/30 outline-none transition-all placeholder:text-[color:var(--text-muted)]/70",
  inputError: "border-[color:var(--danger)] focus:border-[color:var(--danger)] focus:ring-[color:var(--danger)]/20",
  textarea:
    "w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-3 text-sm font-semibold text-[color:var(--text)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--ring)]/30 outline-none transition-all placeholder:text-[color:var(--text-muted)]/70 resize-none",
  
  // Button Styles (matching authStyles)
  buttonPrimary:
    "w-full py-3.5 bg-[color:var(--primary)] text-[color:var(--primary-contrast)] rounded-[var(--radius-xl)] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[var(--shadow-soft)] hover:brightness-95 active:scale-[0.99] disabled:opacity-60 min-h-[48px]",
  buttonSecondary:
    "w-full py-3.5 bg-[color:var(--surface-2)] text-[color:var(--text)] rounded-[var(--radius-xl)] font-semibold text-sm flex items-center justify-center gap-2 shadow-[var(--shadow-soft)] border border-[color:var(--border)] hover:border-[color:var(--primary)]/40 active:scale-[0.99] disabled:opacity-60 min-h-[48px]",
  buttonGhost:
    "w-full py-2.5 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text)] flex items-center justify-center gap-2 transition-colors",
  buttonCompact:
    "px-4 py-2 bg-[color:var(--surface-2)] text-[color:var(--text)] rounded-[var(--radius-md)] font-semibold text-xs flex items-center justify-center gap-2 border border-[color:var(--border)] hover:border-[color:var(--primary)]/40 active:scale-[0.98] disabled:opacity-60 min-h-[40px]",
  
  // Alert Styles (matching authStyles)
  alertError:
    "p-3 bg-[color:var(--danger)]/10 border border-[color:var(--danger)]/30 rounded-[var(--radius-md)] text-[color:var(--danger)] text-xs font-semibold text-center mb-4 flex items-center justify-center gap-2",
  alertInfo:
    "p-3 bg-[color:var(--info)]/10 border border-[color:var(--info)]/30 rounded-[var(--radius-md)] text-[color:var(--info)] text-xs font-semibold text-center mb-4",
  alertSuccess:
    "p-3 bg-[color:var(--success)]/10 border border-[color:var(--success)]/30 rounded-[var(--radius-md)] text-[color:var(--success)] text-xs font-semibold text-center mb-4",
  alertWarning:
    "p-3 bg-[color:var(--warning)]/10 border border-[color:var(--warning)]/30 rounded-[var(--radius-md)] text-[color:var(--warning)] text-xs font-semibold text-center mb-4",
  
  // Modal Styles
  modalOverlay: "fixed inset-0 bg-[color:var(--bg)]/80 backdrop-blur-sm z-[9998]",
  modalContent: "bg-[color:var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-strong)] border border-[color:var(--border)] p-6 sm:p-8 max-w-md w-full mx-4",
  modalHeader: "mb-6 space-y-2",
  modalFooter: "mt-6 flex items-center justify-end gap-3 pt-6 border-t border-[color:var(--border)]",
  
  // Badge Styles
  badge: "px-3 py-1 rounded-full text-xs font-semibold",
  badgeSuccess: "bg-[color:var(--success)]/10 text-[color:var(--success)] border border-[color:var(--success)]/30",
  badgeError: "bg-[color:var(--danger)]/10 text-[color:var(--danger)] border border-[color:var(--danger)]/30",
  badgeWarning: "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border border-[color:var(--warning)]/30",
  badgeInfo: "bg-[color:var(--info)]/10 text-[color:var(--info)] border border-[color:var(--info)]/30",
  badgeNeutral: "bg-[color:var(--surface-2)] text-[color:var(--text-muted)] border border-[color:var(--border)]",
  
  // Section Styles
  section: "space-y-4",
  sectionTitle: "text-lg font-semibold text-[color:var(--text)] mb-4",
  sectionSubtitle: "text-sm text-[color:var(--text-muted)] mb-6",
  
  // List Styles
  listItem: "p-3 rounded-[var(--radius-md)] bg-[color:var(--surface-2)] border border-[color:var(--border)] hover:border-[color:var(--primary)]/40 transition-all",
  listItemActive: "p-3 rounded-[var(--radius-md)] bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/30 text-[color:var(--primary)]",
  
  // Divider
  divider: "h-px bg-[color:var(--border)] my-4",
  
  // Container
  container: "w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10",
  containerCompact: "w-full max-w-4xl mx-auto px-4 sm:px-6",
  
  // Page Layout
  page: "h-full w-full overflow-y-auto flex flex-col px-4 pt-safe pb-safe md:px-8 lg:px-10 animate-fade-in relative z-10",
  pageHeader: "mb-8",
  pageContent: "flex-1 space-y-6",
  
  // Grid
  grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  gridCompact: "grid grid-cols-1 sm:grid-cols-2 gap-3",
};
