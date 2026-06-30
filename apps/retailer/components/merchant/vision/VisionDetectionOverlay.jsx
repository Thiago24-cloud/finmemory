'use client';

/**
 * Feedback visual: verde = detecção local instantânea; âmbar = processando na nuvem.
 *
 * @param {{ phase: 'idle'|'local'|'server'|'error'|'success', label?: string }} props
 */
export function VisionDetectionOverlay({ phase, label }) {
  const border =
    phase === 'local' || phase === 'success'
      ? 'border-[#39FF14] shadow-[0_0_24px_rgba(57,255,20,0.45)]'
      : phase === 'server'
        ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
        : phase === 'error'
          ? 'border-red-500'
          : 'border-white/25';

  const badge =
    phase === 'local'
      ? { text: 'Local · instantâneo', className: 'bg-[#39FF14]/20 text-[#39FF14]' }
      : phase === 'server'
        ? { text: 'Nuvem · processando', className: 'bg-amber-500/20 text-amber-200' }
        : phase === 'success'
          ? { text: 'Estoque atualizado', className: 'bg-[#39FF14]/20 text-[#39FF14]' }
          : null;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-4 rounded-xl border-2 transition-all duration-200 ${border}`}
      />
      {badge ? (
        <div
          className={`pointer-events-none absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
        >
          {badge.text}
          {label ? ` · ${label}` : ''}
        </div>
      ) : null}
    </>
  );
}
