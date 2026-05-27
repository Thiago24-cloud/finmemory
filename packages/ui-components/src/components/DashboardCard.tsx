import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type DashboardCardProps = {
  title: string;
  value?: string | number | null;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
};

/** Card para métricas no dashboard (saldo, gastos do mês, etc.). */
export function DashboardCard({ title, value, subtitle, icon, className }: DashboardCardProps) {
  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-card-lovable', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#666] text-sm font-medium">{title}</span>
        {icon ? <span className="text-[#2ECC49]">{icon}</span> : null}
      </div>
      <div className="text-2xl font-bold text-[#333]">{value ?? '—'}</div>
      {subtitle ? <p className="text-[#666] text-xs mt-2">{subtitle}</p> : null}
    </div>
  );
}
