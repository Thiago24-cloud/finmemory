'use client';

import { cn } from '../../lib/utils';

export const NEED = {
  essential: { label: 'Essencial', short: 'Ess.', color: '#34d399' },
  leisure: { label: 'Lazer', short: 'Lazer', color: '#c084fc' },
  investment: { label: 'Investimento', short: 'Inv.', color: '#38bdf8' },
};

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function donutSlice(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const [x1, y1] = polar(cx, cy, rOuter, endAngle);
  const [x2, y2] = polar(cx, cy, rOuter, startAngle);
  const [x3, y3] = polar(cx, cy, rInner, startAngle);
  const [x4, y4] = polar(cx, cy, rInner, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 1 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Pizza das entradas extras por nível de necessidade (valores nominais cadastrados).
 */
export function SimuladorNecessityPie({ buckets, className }) {
  const essential = Math.max(0, Number(buckets?.essential) || 0);
  const leisure = Math.max(0, Number(buckets?.leisure) || 0);
  const investment = Math.max(0, Number(buckets?.investment) || 0);
  const total = essential + leisure + investment;

  const cx = 52;
  const cy = 52;
  const ro = 44;
  const ri = 22;

  const slices = [];
  if (total < 0.01) {
    slices.push({
      key: 'empty',
      path: donutSlice(cx, cy, ro, ri, 0, 359.99),
      fill: 'rgba(63,63,70,0.9)',
    });
  } else {
    let angle = 0;
    const parts = [
      { key: 'essential', v: essential, fill: NEED.essential.color },
      { key: 'leisure', v: leisure, fill: NEED.leisure.color },
      { key: 'investment', v: investment, fill: NEED.investment.color },
    ];
    for (const p of parts) {
      if (p.v < 0.005) continue;
      const sweep = (p.v / total) * 360;
      const end = angle + sweep;
      slices.push({
        key: p.key,
        path: donutSlice(cx, cy, ro, ri, angle, end),
        fill: p.fill,
      });
      angle = end;
    }
  }

  const fmtPct = (v) =>
    total >= 0.01 ? `${Math.round((v / total) * 100)}%` : '—';

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <svg viewBox="0 0 104 104" className="mx-auto h-28 w-28 shrink-0" aria-hidden>
        {slices.map((s) => (
          <path key={s.key} d={s.path} fill={s.fill} stroke="#18181b" strokeWidth={1} />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        <li className="flex justify-between gap-2">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NEED.essential.color }} />
            {NEED.essential.label}
          </span>
          <span className="tabular-nums text-zinc-200">{fmtPct(essential)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NEED.leisure.color }} />
            {NEED.leisure.label}
          </span>
          <span className="tabular-nums text-zinc-200">{fmtPct(leisure)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NEED.investment.color }} />
            {NEED.investment.label}
          </span>
          <span className="tabular-nums text-zinc-200">{fmtPct(investment)}</span>
        </li>
      </ul>
    </div>
  );
}
