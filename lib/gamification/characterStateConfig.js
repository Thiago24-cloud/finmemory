/** UI por estado — humor, animação, glow (glass card). */

export const CHARACTER_STATE_CONFIG = {
  OPEN_FINANCE_ANALYZE: {
    mood_level: 'HAPPY',
    animation_profile: 'float-idle',
    animation_trigger: 'float_idle',
    ui_config: {
      balloon_side: 'right',
      background_glow_color: 'rgba(63, 165, 216, 0.22)',
      accent_class: 'from-sky-500/20 to-cyan-500/10',
      emoji: '📊',
    },
  },
  PRICE_MAP_HUNT: {
    mood_level: 'FOCUSED',
    animation_profile: 'float-idle',
    animation_trigger: 'lean_forward',
    ui_config: {
      balloon_side: 'right',
      background_glow_color: 'rgba(34, 197, 94, 0.2)',
      accent_class: 'from-emerald-500/20 to-green-600/10',
      emoji: '🗺️',
    },
  },
  META_BATIDA: {
    mood_level: 'CELEBRATING',
    animation_profile: 'float-idle',
    animation_trigger: 'bounce_celebrate',
    ui_config: {
      balloon_side: 'right',
      background_glow_color: 'rgba(234, 179, 8, 0.28)',
      accent_class: 'from-amber-400/25 to-yellow-500/15',
      emoji: '🎉',
      confetti: true,
    },
  },
  BUDGET_CRUNCH: {
    mood_level: 'WORRIED',
    animation_profile: 'float-idle',
    animation_trigger: 'worry_sway',
    ui_config: {
      balloon_side: 'right',
      background_glow_color: 'rgba(239, 68, 68, 0.18)',
      accent_class: 'from-red-500/15 to-orange-500/10',
      emoji: '😅',
    },
  },
  IDLE: {
    mood_level: 'NEUTRAL',
    animation_profile: 'float-idle',
    animation_trigger: 'float_idle',
    ui_config: {
      balloon_side: 'right',
      background_glow_color: 'rgba(99, 102, 241, 0.15)',
      accent_class: 'from-primary/15 to-primary/5',
      emoji: '💰',
    },
  },
};

/** Mascote oficial (SVG — tablet / Open Finance). */
export const MASCOT_IMAGE_SRC = '/mascot-finmemory.svg';

/** Largura exibida no app (espelha .container-personagem em globals.css). */
export const MASCOT_DISPLAY_WIDTH_PX = 130;
