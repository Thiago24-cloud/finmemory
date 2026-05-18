/** UX do mascote — delays e classes CSS (ver globals.css). */
export const CHARACTER_BUBBLE_DELAY_MS = 500;
export const CHARACTER_CLICK_DEBOUNCE_MS = 400;

/** @typedef {'float-idle' | 'duolingo-bounce'} AnimationProfile */

/**
 * Classe CSS do personagem conforme perfil + interação.
 * @param {string} [animationProfile]
 * @param {boolean} isBouncing
 */
export function mascotAnimationClass(animationProfile, isBouncing) {
  if (isBouncing) return 'finmemory-char-bounce';
  switch (animationProfile) {
    case 'float-idle':
      return 'finmemory-char-idle';
    default:
      return 'finmemory-char-idle';
  }
}

/**
 * Mapeia animation_trigger legado → animation_profile.
 * @param {string} [trigger]
 * @returns {AnimationProfile}
 */
export function animationProfileFromTrigger(trigger) {
  switch (trigger) {
    case 'bounce_celebrate':
    case 'duolingo-bounce':
      return 'duolingo-bounce';
    case 'float_idle':
    case 'lean_forward':
    case 'worry_sway':
    case 'float-idle':
    default:
      return 'float-idle';
  }
}
