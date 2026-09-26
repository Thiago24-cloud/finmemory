'use client';

/**
 * Sparkline simples + resumo “paguei X, hoje Y”.
 */
export function InsumoPriceSparkline({ points = [], height = 36, className = '' }) {
  const vals = (points || [])
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length < 2) {
    return (
      <div className={`text-[10px] text-muted-foreground ${className}`}>
        Sem série suficiente para gráfico.
      </div>
    );
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 120;
  const h = height;
  const coords = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
        className="text-primary"
      />
    </svg>
  );
}

export function formatHistoryBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
