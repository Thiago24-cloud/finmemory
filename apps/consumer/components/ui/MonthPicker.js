import { cn } from '../../lib/utils';

/**
 * Seletor de mês (dashboard/relatórios).
 * Placeholder: substitua pelo componente exportado do Lovable.
 *
 * @param {number} year - Ano selecionado (ex: 2026)
 * @param {number} month - Mês selecionado (1-12)
 * @param {(year: number, month: number) => void} onChange - Callback ao mudar
 * @param {string} [className]
 */
export function MonthPicker({ year, month, onChange, className }) {
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const current = new Date();
  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth() + 1;

  const handlePrev = () => {
    if (month <= 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };

  const handleNext = () => {
    if (month >= 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };

  const canNext = year < currentYear || (year === currentYear && month < currentMonth);

  return (
    <div className={cn('flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-2 shadow-card-lovable', className)}>
      <button type="button" onClick={handlePrev} className="p-2 rounded-lg hover:bg-[#f8f9fa] text-[#666]" aria-label="Mês anterior">
        ‹
      </button>
      <span className="font-semibold text-[#333] min-w-[120px] text-center">
        {monthNames[month - 1]} {year}
      </span>
      <button
        type="button"
        onClick={handleNext}
        disabled={!canNext}
        className="p-2 rounded-lg hover:bg-[#f8f9fa] text-[#666] disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}
