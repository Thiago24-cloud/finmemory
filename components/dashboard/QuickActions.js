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
      <div className="flex gap-4 pb-2">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={action.onClick}
            disabled={syncing && action.label === 'Sincronizar'}
            className="flex flex-col items-center gap-2 min-w-[72px]"
          >
            <div
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all',
                action.isPositive
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
