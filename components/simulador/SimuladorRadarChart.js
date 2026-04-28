'use client';

function formatBrl(n) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  } catch {
    return `R$ ${Number(n).toFixed(2)}`;
  }
}

/**
 * Gráfico de linha (SVG) — radar de saldo no mês.
 */
export function SimuladorRadarChart({
  points,
  gaps = [],
  stressMode,
  onDayFocus,
  baselineMonthlyExpense = 0,
  uncertaintyBands = [],
  firstNegativeDay = null,
}) {
  if (!points?.length) return null;

  const w = 320;
  const h = 148;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const vals = points.map((p) => p.balance);
  let lo = Math.min(...vals, 0);
  let hi = Math.max(...vals, lo + 1);
  const pad = (hi - lo) * 0.1 || 80;
  lo -= pad;
  hi += pad;

  const xFor = (i) => padL + (i / Math.max(1, points.length - 1)) * innerW;
  const yFor = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

  const linePts = points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.balance).toFixed(1)}`);
  const pathLine = `M ${linePts.join(' L ')}`;
  const pathArea = `${pathLine} L ${xFor(points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L ${xFor(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const baselineY =
    Number.isFinite(Number(baselineMonthlyExpense)) && baselineMonthlyExpense > 0
      ? yFor(Number(baselineMonthlyExpense))
      : null;

  const gapRects = (gaps || []).map((g, idx) => {
    const i0 = Math.max(0, g.from - 1);
    const i1 = Math.min(points.length - 1, g.to - 1);
    const x0 = xFor(i0);
    const x1 = xFor(i1);
    return (
      <rect
        key={`gap-${idx}`}
        x={x0}
        y={padT}
        width={Math.max(2, x1 - x0)}
        height={innerH}
        fill="url(#simGapGrad)"
        opacity={0.4}
      />
    );
  });
  const uncertaintyRects = (uncertaintyBands || []).map((u, idx) => {
    const i = Math.max(0, Math.min(points.length - 1, Number(u.day || 1) - 1));
    const x = xFor(i) - 2;
    const intensity = Math.max(0.08, Math.min(0.55, Number(u.opacity) || 0.12));
    return (
      <rect
        key={`unc-${idx}`}
        x={x}
        y={padT}
        width={4}
        height={innerH}
        fill={`rgba(251,146,60,${intensity})`}
        rx={2}
      />
    );
  });

  const labelIdx = [0, Math.floor((points.length - 1) * 0.33), Math.floor((points.length - 1) * 0.66), points.length - 1];

  const markerDays = (() => {
    const minI = vals.indexOf(Math.min(...vals));
    const out = [{ i: minI, danger: true }];
    const supportIdx = points.findIndex((p) => p.events?.some((e) => String(e.label).includes('Rede')));
    if (supportIdx >= 0) out.push({ i: supportIdx, danger: false });
    return out.filter((m, j, a) => a.findIndex((x) => x.i === m.i) === j).slice(0, 3);
  })();

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-full h-auto min-h-[148px]"
        role="img"
        aria-label="Radar de saldo previsto no mês"
      >
        <defs>
          <linearGradient id="simLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="simAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(168,85,247,0.45)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </linearGradient>
          <linearGradient id="simGapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(239,68,68,0.28)" />
            <stop offset="100%" stopColor="rgba(239,68,68,0.06)" />
          </linearGradient>
          <filter id="simGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gapRects}
        {uncertaintyRects}

        {baselineY != null && (
          <line
            x1={padL}
            y1={baselineY}
            x2={padL + innerW}
            y2={baselineY}
            stroke="rgba(161,161,170,0.8)"
            strokeDasharray="4 4"
            strokeWidth={1.2}
          />
        )}

        <path d={pathArea} fill="url(#simAreaGrad)" stroke="none" />
        <path
          d={pathLine}
          fill="none"
          stroke="url(#simLineGrad)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#simGlow)"
          style={{ transition: 'd 280ms ease, stroke 180ms ease' }}
        />

        {markerDays.map((m) => {
          const p = points[m.i];
          if (!p) return null;
          const cx = xFor(m.i);
          const cy = yFor(p.balance);
          return (
            <g key={`mk-${m.i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={m.danger ? 5 : 4}
                fill={m.danger ? '#f87171' : '#c084fc'}
                stroke="#09090b"
                strokeWidth={1.5}
                className="cursor-pointer"
                onClick={() => onDayFocus?.(p.day)}
              />
            </g>
          );
        })}

        {labelIdx.map((i) => (
          <text key={`lb-${i}`} x={xFor(i)} y={h - 6} textAnchor="middle" className="fill-zinc-500 text-[9px] font-medium">
            dia {points[i]?.day}
          </text>
        ))}

        <text x={padL} y={14} className="fill-zinc-400 text-[9px]">
          {stressMode ? 'Cenário: sem entradas incertas' : 'Saldo previsto'}
        </text>
        {baselineY != null && (
          <text x={padL + innerW} y={Math.max(10, baselineY - 4)} textAnchor="end" className="fill-zinc-500 text-[9px]">
            Baseline 3m: {formatBrl(baselineMonthlyExpense)}
          </text>
        )}
        {firstNegativeDay != null ? (
          <text x={padL + 2} y={h - 16} className="fill-red-300 text-[9px] font-medium">
            Burn rate: caixa negativo no dia {firstNegativeDay}
          </text>
        ) : null}
      </svg>
      <p className="text-center text-[10px] text-zinc-500 mt-1">
        Mínimo no mês: {formatBrl(Math.min(...vals))}
      </p>
    </div>
  );
}
