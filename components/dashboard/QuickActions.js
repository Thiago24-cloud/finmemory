import { useRouter } from 'next/router';
import {
  RefreshCw,
  BarChart3,
  Tags,
  Camera,
  Settings,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Ações rápidas – Sincronizar (dados reais), Escanear, Relatórios, Categorias, Extratos, Ajustes.
 * Navegação via Next.js router.
 */
export function QuickActions({ onSync, syncing, userIdReady = true, className }) {
  const router = useRouter();
  const syncDisabled = syncing || !userIdReady;

  const actions = [
    {
      icon: <RefreshCw className={cn('h-6 w-6', syncing && 'animate-spin')} />,
      label: 'Sincronizar',
      onClick: onSync,
      isPositive: true,
      disabled: syncDisabled,
    },
    {
      icon: <Camera className="h-6 w-6" />,
      label: 'Escanear',
      onClick: () => router.push('/add-receipt'),
      isPositive: true,
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      label: 'Relatórios',
      onClick: () => router.push('/reports'),
    },
    {
      icon: <Tags className="h-6 w-6" />,
      label: 'Categorias',
      onClick: () => router.push('/categories'),
    },
    {
      icon: <FileText className="h-6 w-6" />,
      label: 'Extratos',
      onClick: () => router.push('/reports'),
    },
    {
      icon: <Settings className="h-6 w-6" />,
      label: 'Ajustes',
      onClick: () => router.push('/settings'),
    },
  ];

  return (
    <div className={cn('overflow-x-auto scrollbar-hide -mx-5 px-5', className)}>
      <div className="flex gap-4 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={action.disabled ? undefined : action.onClick}
            disabled={action.disabled}
            title={action.label === 'Sincronizar' && !userIdReady ? 'Preparando sua conta...' : undefined}
            className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable',
                action.isPositive
                  ? 'bg-[#e8f5e9] text-[#28a745] hover:bg-[#c8e6c9]'
                  : 'bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]'
              )}
            >
              {action.icon}
            </div>
            <span className="text-xs text-[#666] whitespace-nowrap">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
