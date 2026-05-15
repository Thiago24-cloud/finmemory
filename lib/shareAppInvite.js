/**
 * Link e mensagem para missão “Convide um amigo” (Web Share / fallback).
 */

const DEFAULT_ORIGIN_FALLBACK = 'https://finmemory.com.br';

export function getInviteShareUrl() {
  const envBase = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') : '';
  if (typeof window !== 'undefined') {
    if (envBase) return `${envBase}/`;
    return `${window.location.origin}/`;
  }
  return envBase ? `${envBase}/` : `${DEFAULT_ORIGIN_FALLBACK}/`;
}

export function buildInviteSharePayload() {
  const url = getInviteShareUrl();
  const text = `Economiza nas compras com o FinMemory — baixa aqui: ${url}`;
  return {
    title: 'FinMemory',
    text,
    url,
  };
}

/**
 * Abre o seletor nativo (WhatsApp, Instagram, etc.) quando disponível.
 * @returns {Promise<'shared' | 'cancelled' | 'fallback'>}
 */
export async function shareAppInviteLink() {
  if (typeof window === 'undefined') {
    return 'cancelled';
  }

  const { title, text, url } = buildInviteSharePayload();

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const payload = { title, text, url };
      if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
        // Alguns navegadores rejeitam combinações; tenta só URL + texto curto.
        await navigator.share({ text, url });
      } else {
        await navigator.share(payload);
      }
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }

  const combined = text;
  try {
    await navigator.clipboard.writeText(combined);
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = combined;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      /* ignore */
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(combined)}`;
  window.open(wa, '_blank', 'noopener,noreferrer');

  return 'fallback';
}
