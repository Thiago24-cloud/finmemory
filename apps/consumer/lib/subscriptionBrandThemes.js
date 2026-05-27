/**
 * Temas de marca para compromissos / assinaturas (logos via mesmo proxy dos cartões).
 * @see components/dashboard/SubscriptionBrandAvatar.jsx
 * @see lib/bankThemes.js
 */

const DEFAULT_THEME = {
  key: 'default',
  label: null,
  domain: null,
  logoUrl: null,
  bgColor: '#1e293b',
  textColor: '#f8fafc',
  ringColor: 'rgba(148, 163, 184, 0.35)',
  logoScale: 1,
};

/** Ordem: padrões mais específicos primeiro. */
const SUBSCRIPTION_BRANDS = [
  { key: 'netflix', match: /netflix/i, label: 'Netflix', domain: 'netflix.com', bgColor: '#E50914' },
  { key: 'spotify', match: /spotify/i, label: 'Spotify', domain: 'spotify.com', bgColor: '#1DB954' },
  {
    key: 'amazon',
    match: /amazon|prime\s*video|amzn/i,
    label: 'Amazon',
    domain: 'amazon.com',
    bgColor: '#FF9900',
  },
  { key: 'disney', match: /disney\+?|disney\s*plus/i, label: 'Disney+', domain: 'disneyplus.com', bgColor: '#113CCF' },
  { key: 'hbo', match: /hbo\s*max|\bhbo\b|\bmax\s*stream/i, label: 'Max', domain: 'max.com', bgColor: '#002BE7' },
  { key: 'globoplay', match: /globoplay|globo\s*play/i, label: 'Globoplay', domain: 'globoplay.globo.com', bgColor: '#FF2D55' },
  { key: 'youtube', match: /youtube\s*premium|yt\s*premium/i, label: 'YouTube', domain: 'youtube.com', bgColor: '#FF0000' },
  {
    key: 'google',
    match: /google\s*one|google\s*storage|google\s*play|google\s*cloud|gcp/i,
    label: 'Google',
    domain: 'google.com',
    bgColor: '#4285F4',
  },
  { key: 'apple', match: /apple|icloud|itunes|apple\s*music/i, label: 'Apple', domain: 'apple.com', bgColor: '#1d1d1f' },
  { key: 'canva', match: /canva/i, label: 'Canva', domain: 'canva.com', bgColor: '#00C4CC' },
  { key: 'cursor', match: /cursor(\.com|\.sh)?/i, label: 'Cursor', domain: 'cursor.com', bgColor: '#0B0B0B' },
  { key: 'openai', match: /openai|chatgpt/i, label: 'ChatGPT', domain: 'openai.com', bgColor: '#10A37F' },
  { key: 'microsoft', match: /microsoft|xbox|office\s*365|msft/i, label: 'Microsoft', domain: 'microsoft.com', bgColor: '#0078D4' },
  { key: 'adobe', match: /adobe/i, label: 'Adobe', domain: 'adobe.com', bgColor: '#FF0000' },
  { key: 'notion', match: /notion/i, label: 'Notion', domain: 'notion.so', bgColor: '#000000' },
  { key: 'dropbox', match: /dropbox/i, label: 'Dropbox', domain: 'dropbox.com', bgColor: '#0061FF' },
  { key: 'linkedin', match: /linkedin/i, label: 'LinkedIn', domain: 'linkedin.com', bgColor: '#0A66C2' },
  { key: 'deezer', match: /deezer/i, label: 'Deezer', domain: 'deezer.com', bgColor: '#A238FF' },
  { key: 'paramount', match: /paramount/i, label: 'Paramount+', domain: 'paramountplus.com', bgColor: '#0064FF' },
  { key: 'crunchyroll', match: /crunchyroll/i, label: 'Crunchyroll', domain: 'crunchyroll.com', bgColor: '#F47521' },
  { key: 'gympass', match: /gympass/i, label: 'Gympass', domain: 'gympass.com', bgColor: '#D8385E' },
  { key: 'uber', match: /uber\s*one|uberone/i, label: 'Uber', domain: 'uber.com', bgColor: '#000000' },
  { key: 'claro', match: /claro/i, label: 'Claro', domain: 'claro.com.br', bgColor: '#DA291C' },
  { key: 'vivo', match: /vivo/i, label: 'Vivo', domain: 'vivo.com.br', bgColor: '#660099' },
  { key: 'tim', match: /\btim\b/i, label: 'TIM', domain: 'tim.com.br', bgColor: '#004691' },
  { key: 'enel', match: /enel|eletropaulo|energia|luz\b|eletric/i, label: 'Energia', domain: 'enel.com.br', bgColor: '#F59E0B' },
  { key: 'sabesp', match: /sabesp|\bágua\b|\bagua\b/i, label: 'Água', domain: 'sabesp.com.br', bgColor: '#0EA5E9' },
  { key: 'streaming', match: /streaming|tv\b|hbo|prime\b/i, label: 'Streaming', domain: 'netflix.com', bgColor: '#7C3AED' },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function brandIconUrl(domain) {
  if (!domain) return null;
  return `/api/map/store-brand-icon?d=${encodeURIComponent(domain)}`;
}

/**
 * @param {{ titulo?: string, categoria?: string }} input
 */
export function getSubscriptionBrandTheme({ titulo, categoria } = {}) {
  const hay = normalizeText(`${titulo || ''} ${categoria || ''}`);
  if (!hay) return { ...DEFAULT_THEME };

  for (const b of SUBSCRIPTION_BRANDS) {
    if (b.match.test(hay)) {
      return {
        key: b.key,
        label: b.label,
        domain: b.domain,
        logoUrl: brandIconUrl(b.domain),
        bgColor: b.bgColor,
        textColor: '#FFFFFF',
        ringColor: `${b.bgColor}66`,
        logoScale: b.logoScale ?? 1,
      };
    }
  }

  return { ...DEFAULT_THEME };
}

export { SUBSCRIPTION_BRANDS, DEFAULT_THEME };
