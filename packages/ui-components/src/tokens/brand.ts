/**
 * Tokens visuais da marca FinMemory.
 * Use estes valores em vez de hardcode para manter consistência.
 */
export const BRAND = {
  primary: '#2ECC49',
  primaryHover: '#25b340',
  primaryText: '#15803d',
  primarySoftBg: '#f3fff6',
  primarySoftBorder: '#b9f2c1',
  primarySoftHover: '#e7fbe9',
} as const;

/** Classes Tailwind para texto legível no tema escuro global (`html.dark`). */
export const APP_DARK_UI = {
  page: 'min-h-screen bg-background text-foreground',
  card: 'rounded-2xl border border-border bg-card p-4 shadow-sm',
  sectionTitle: 'text-base font-semibold text-[#2ECC49]',
  sectionLead: 'mt-1 text-sm text-foreground/80',
  label: 'text-[11px] font-semibold uppercase tracking-wide text-[#2ECC49]',
  value: 'text-sm font-semibold text-foreground',
  body: 'text-sm text-foreground/85',
  statBox: 'rounded-xl border border-border bg-secondary/60 px-3 py-2',
  btnGhost:
    'inline-flex items-center justify-center rounded-xl border border-border bg-secondary/40 px-4 py-2 text-sm font-medium text-[#2ECC49] hover:bg-secondary/70 disabled:opacity-60',
  btnPrimary:
    'inline-flex items-center justify-center rounded-xl bg-[#2ECC49] px-4 py-2 text-sm font-semibold text-white hover:bg-[#25b340] disabled:opacity-60',
} as const;

export default BRAND;
