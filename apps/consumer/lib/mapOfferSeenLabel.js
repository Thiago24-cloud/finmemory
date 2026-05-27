/**
 * Recência de preço no mapa — texto tipo "Visto há X min" + tom visual (radar de ofertas).
 */

/** @typedef {'fresh' | 'warm' | 'cold' | 'unknown'} MapOfferSeenTone */

/**
 * @param {string | null | undefined} iso
 * @returns {{ text: string; tone: MapOfferSeenTone; className: string; iconClassName: string }}
 */
export function getMapOfferSeenPresentation(iso) {
  if (!iso) {
    return {
      text: '',
      tone: 'unknown',
      className: '',
      iconClassName: '',
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      text: '',
      tone: 'unknown',
      className: '',
      iconClassName: '',
    };
  }

  const diffMs = Date.now() - d.getTime();
  const safeMs = diffMs < 0 ? 0 : diffMs;
  const mins = Math.floor(safeMs / 60000);
  const hours = Math.floor(safeMs / 3600000);

  let text;
  if (mins < 1) text = 'Visto agora';
  else if (mins < 60) text = `Visto há ${mins} min`;
  else if (hours < 48) text = `Visto há ${hours} h`;
  else {
    text = `Visto em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  }

  /** ≤60 min: quente · ≤6 h: recente · resto: conferir */
  let tone;
  if (mins <= 60) tone = 'fresh';
  else if (hours < 6) tone = 'warm';
  else tone = 'cold';

  const byTone = {
    fresh: {
      className: 'text-emerald-600',
      iconClassName: 'text-emerald-500',
    },
    warm: {
      className: 'text-amber-700',
      iconClassName: 'text-amber-600',
    },
    cold: {
      className: hours >= 12 ? 'text-gray-400 opacity-80' : 'text-gray-500',
      iconClassName: hours >= 12 ? 'text-gray-400' : 'text-gray-500',
    },
    unknown: { className: 'text-gray-400', iconClassName: 'text-gray-400' },
  };

  return {
    text,
    tone,
    className: byTone[tone]?.className || '',
    iconClassName: byTone[tone]?.iconClassName || '',
  };
}
