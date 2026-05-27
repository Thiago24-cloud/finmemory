import { cn } from '../../lib/utils';

/**
 * Gráfico de comparação (mês vs mês, categorias, etc.).
 * Placeholder: substitua pelo componente exportado do Lovable (ex: recharts, chart.js).
 *
 * @param {Array<{ label: string, value: number, color?: string }>} data - Série principal
 * @param {Array<{ label: string, value: number, color?: string }>} [compareData] - Série para comparação (opcional)
 * @param {string} [title] - Título do gráfico
 * @param {string} [className]
 */
export function ComparisonChart({ data = [], compareData, title, className }) {
  const max = Math.max(
    ...data.map((d) => d.value),
    ...(compareData || []).map((d) => d.value),
    1
  );

  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-card-lovable', className)}>
      {title && <h3 className="text-lg font-semibold text-[#333] mb-4">{title}</h3>}
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-[#666] text-sm">Nenhum dado para exibir</p>
        ) : (
          data.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-[#666] w-24 truncate">{item.label}</span>
              <div className="flex-1 h-6 bg-[#f0f0f0] rounded overflow-hidden">
                <div
                  className="h-full rounded bg-[#2ECC49]"
                  style={{ width: `${Math.min(100, (item.value / max) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-[#333] w-16 text-right">
                {typeof item.value === 'number' ? `R$ ${item.value.toFixed(0)}` : item.value}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
