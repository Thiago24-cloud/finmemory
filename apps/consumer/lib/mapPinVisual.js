/**
 * Visual unificado mapa: mesma “família de cor” no pin e no rótulo (evita pin colorido + nome genérico).
 */

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export function parseHex(hex) {
  const s = String(hex || '').trim();
  const m = s.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mistura cor com branco (t=1 → cor pura, t=0 → branco). */
export function mixWithWhite(hex, t) {
  const rgb = parseHex(hex);
  if (!rgb) return '#ffffff';
  const k = clamp(Number(t) || 0, 0, 1);
  return rgbToHex(
    rgb.r + (255 - rgb.r) * (1 - k),
    rgb.g + (255 - rgb.g) * (1 - k),
    rgb.b + (255 - rgb.b) * (1 - k)
  );
}

/** Mistura cor com preto (t=1 → cor pura). */
export function mixWithBlack(hex, t) {
  const rgb = parseHex(hex);
  if (!rgb) return '#111827';
  const k = clamp(Number(t) || 0, 0, 1);
  return rgbToHex(rgb.r * k, rgb.g * k, rgb.b * k);
}

function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Cor de texto legível sobre fundo claro tingido pela cor do pin. */
export function readableAccentOnLightChip(mainHex) {
  const rgb = parseHex(mainHex);
  if (!rgb) return '#1e293b';
  const L = relativeLuminance(rgb);
  if (L > 0.72) return mixWithBlack(mainHex, 0.55);
  if (L < 0.28) return mainHex;
  return mainHex;
}

/**
 * Rótulo ao lado do pin estilo “Maps”: só texto na cor do pin, sem caixa — halo branco fino para legibilidade.
 * @returns {import('react').CSSProperties}
 */
export function getMapPinOpenAirLabelStyle(mainHex) {
  const text = readableAccentOnLightChip(mainHex);
  return {
    color: text,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: 0,
    margin: 0,
    textShadow:
      '-0.5px -0.5px 0 rgba(255,255,255,0.92), 0.5px -0.5px 0 rgba(255,255,255,0.92), -0.5px 0.5px 0 rgba(255,255,255,0.92), 0.5px 0.5px 0 rgba(255,255,255,0.92), 0 1px 3px rgba(0,0,0,0.18)',
  };
}
