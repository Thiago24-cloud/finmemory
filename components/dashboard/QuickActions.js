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
export function QuickActions({ onSync, syncing, className }) {
  const router = useRouter();

  const actions = [
    {
      icon: <RefreshCw className={cn('h-6 w-6', syncing && 'animate-spin')} />,
      label: 'Sincronizar',
      onClick: onSync,
      isPositive: true,
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
            onClick={action.onClick}
            disabled={syncing && action.label === 'Sincronizar'}
            className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform"
          >
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-dark',
                action.isPositive
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {action.icon}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
