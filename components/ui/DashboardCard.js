import { cn } from '../../lib/utils';

/**
 * Card para métricas no dashboard (saldo, gastos do mês, etc.).
 * Placeholder: substitua pelo componente exportado do Lovable e conecte aos seus dados.
 *
 * @param {string} title - Ex: "Saldo Total", "Gastos do mês"
 * @param {string|number} value - Valor exibido (pode ser formatado ou número)
 * @param {string} [subtitle] - Texto auxiliar (ex: "Atualizado agora")
 * @param {React.ReactNode} [icon] - Ícone opcional
 * @param {string} [className]
 */
export function DashboardCard({ title, value, subtitle, icon, className }) {
  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-card-lovable', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#666] text-sm font-medium">{title}</span>
        {icon && <span className="text-[#667eea]">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-[#333]">{value ?? '—'}</div>
      {subtitle && <p className="text-[#666] text-xs mt-2">{subtitle}</p>}
    </div>
  );
}
