import Link from 'next/link';
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
 * Ações rápidas – Sincronizar (botão), demais como Link para navegação confiável.
 */
export function QuickActions({ onSync, syncing, userIdReady = true, className }) {
  const syncDisabled = syncing || !userIdReady;

  return (
    <div className={cn('overflow-x-auto scrollbar-hide -mx-5 px-5', className)}>
      <div className="flex gap-4 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {/* Sincronizar: botão (ação) */}
        <button
          type="button"
          onClick={syncDisabled ? undefined : onSync}
          disabled={syncDisabled}
          title={!userIdReady ? 'Preparando sua conta...' : 'Sincronizar e-mails'}
          className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-[#e8f5e9] text-[#28a745] hover:bg-[#c8e6c9]">
            <RefreshCw className={cn('h-6 w-6', syncing && 'animate-spin')} />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Sincronizar</span>
        </button>

        {/* Escanear */}
        <Link href="/add-receipt" className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform no-underline text-inherit">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-[#e8f5e9] text-[#28a745] hover:bg-[#c8e6c9]">
            <Camera className="h-6 w-6" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Escanear</span>
        </Link>

        {/* Relatórios */}
        <Link href="/reports" className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform no-underline text-inherit">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Relatórios</span>
        </Link>

        {/* Categorias */}
        <Link href="/categories" className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform no-underline text-inherit">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Tags className="h-6 w-6" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Categorias</span>
        </Link>

        {/* Extratos */}
        <Link href="/reports" className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform no-underline text-inherit">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <FileText className="h-6 w-6" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Extratos</span>
        </Link>

        {/* Ajustes */}
        <Link href="/settings" className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform no-underline text-inherit">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Settings className="h-6 w-6" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Ajustes</span>
        </Link>
      </div>
    </div>
  );
}
