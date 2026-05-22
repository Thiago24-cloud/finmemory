/**
 * Paleta da landing institucional (FinMemory).
 * Fundo escuro + verde marca + texto claro para contraste AA em cards e seções.
 */
export const LANDING = {
  ink: '#0a0f1a',
  inkElevated: '#141c2e',
  inkBorder: 'rgba(255,255,255,0.12)',
  surface: '#f8fafc',
  surfaceCard: '#ffffff',
  brand: '#2ECC49',
  brandDark: '#22a83a',
  brandGlow: 'rgba(46,204,73,0.35)',
  textOnInk: '#ffffff',
  textOnInkMuted: 'rgba(255,255,255,0.82)',
  textOnInkSubtle: 'rgba(255,255,255,0.68)',
  textOnLight: '#0f172a',
  textOnLightBody: '#475569',
  textOnLightMuted: '#64748b',
};

/** Classes Tailwind reutilizáveis (landing institucional). */
export const landingClasses = {
  sectionDark: 'bg-[#0a0f1a] text-white',
  sectionLight: 'bg-[#f8fafc] text-[#0f172a]',
  sectionWhite: 'bg-white text-[#0f172a]',
  cardDark:
    'rounded-2xl border border-white/10 bg-[#141c2e] text-white shadow-lg shadow-black/20',
  cardLight:
    'rounded-2xl border border-[#e2e8f0] bg-white text-[#0f172a] shadow-sm',
  eyebrow: 'text-xs font-bold uppercase tracking-[0.2em] text-[#2ECC49]',
  titleOnDark: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight m-0',
  titleOnLight: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f172a] leading-tight m-0',
  bodyOnDark: 'text-white/80 leading-relaxed',
  bodyOnLight: 'text-[#475569] leading-relaxed',
  headingCard: 'text-lg font-bold text-white m-0',
  subheadingCard: 'font-semibold text-white text-sm m-0 mb-1',
  captionCard: 'text-white/75 text-sm leading-relaxed m-0',
};
