/**
 * Estilo visual por instituição (Open Finance) — cores aproximadas da marca.
 * @param {string | undefined} name
 * @returns {{ bg: string; text: string; ring: string; label: string }}
 */
export function getBankBrandStyle(name) {
  const n = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  if (n.includes('nubank')) {
    return {
      bg: 'linear-gradient(135deg, #820ad1 0%, #a855f7 100%)',
      text: '#ffffff',
      ring: 'rgba(168,85,247,0.45)',
      label: 'Nubank',
    };
  }
  if (n.includes('c6') || n.includes('c6 bank')) {
    return {
      bg: 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)',
      text: '#f5f5f5',
      ring: 'rgba(255,255,255,0.2)',
      label: 'C6 Bank',
    };
  }
  if (n.includes('picpay')) {
    return {
      bg: 'linear-gradient(135deg, #21c25e 0%, #11d26f 100%)',
      text: '#ffffff',
      ring: 'rgba(34,197,94,0.5)',
      label: 'PicPay',
    };
  }
  if (n.includes('bradesco')) {
    return {
      bg: 'linear-gradient(135deg, #cc092f 0%, #e11d48 100%)',
      text: '#ffffff',
      ring: 'rgba(225,29,72,0.45)',
      label: 'Bradesco',
    };
  }
  if (n.includes('itau') || n.includes('itaú')) {
    return {
      bg: 'linear-gradient(135deg, #ec7000 0%, #f59e0b 100%)',
      text: '#ffffff',
      ring: 'rgba(245,158,11,0.45)',
      label: 'Itaú',
    };
  }
  if (n.includes('inter')) {
    return {
      bg: 'linear-gradient(135deg, #ff7a00 0%, #fb923c 100%)',
      text: '#1a1a1a',
      ring: 'rgba(251,146,60,0.5)',
      label: 'Inter',
    };
  }
  if (n.includes('santander')) {
    return {
      bg: 'linear-gradient(135deg, #ec0000 0%, #ef4444 100%)',
      text: '#ffffff',
      ring: 'rgba(239,68,68,0.45)',
      label: 'Santander',
    };
  }
  return {
    bg: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    text: '#f8fafc',
    ring: 'rgba(148,163,184,0.35)',
    label: null,
  };
}
