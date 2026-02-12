import Link from 'next/link';
import {
  RefreshCw,
  BarChart3,
  Tags,
  Camera,
  Settings,
  FileText,
  MapPin,
  Share2,
  PenLine,
  Users,
  List,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Ações rápidas – Estilo Whoosh: 3 principais em destaque (Sync, Escanear, Mapa), demais em scroll.
 */
export function QuickActions({ onSync, syncing, userIdReady = true, className }) {
  const syncDisabled = syncing || !userIdReady;
  const primaryBtn = 'flex flex-col items-center gap-1.5 min-w-[80px] snap-start hover:-translate-y-0.5 transition-transform';
  const secondaryBtn = 'flex flex-col items-center gap-2 min-w-[64px] snap-start hover:-translate-y-0.5 transition-transform';

  return (
    <div className={cn('overflow-x-auto scrollbar-hide -mx-5 px-5', className)}>
      {/* Linha principal: Sync, Escanear, Mapa – fácil alcance com uma mão */}
      <div className="flex gap-3 mb-4 justify-center">
        <button
          type="button"
          onClick={syncDisabled ? undefined : onSync}
          disabled={syncDisabled}
          title={!userIdReady ? 'Preparando sua conta...' : 'Sincronizar e-mails'}
          className={cn(primaryBtn, 'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0')}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-[#e8f5e9] text-[#28a745] hover:bg-[#c8e6c9]">
            <RefreshCw className={cn('h-7 w-7', syncing && 'animate-spin')} />
          </div>
          <span className="text-xs font-medium text-[#333] whitespace-nowrap">Sincronizar</span>
        </button>
        <Link href="/add-receipt" className={cn(primaryBtn, 'no-underline text-inherit')}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-[#e8f5e9] text-[#28a745] hover:bg-[#c8e6c9]">
            <Camera className="h-7 w-7" />
          </div>
          <span className="text-xs font-medium text-[#333] whitespace-nowrap">Escanear</span>
        </Link>
        <Link href="/mapa" className={cn(primaryBtn, 'no-underline text-inherit')}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-card-lovable bg-[#e3f2fd] text-[#1976d2] hover:bg-[#bbdefb]">
            <MapPin className="h-7 w-7" />
          </div>
          <span className="text-xs font-medium text-[#333] whitespace-nowrap">Mapa</span>
        </Link>
      </div>
      {/* Demais ações em scroll horizontal – minimalista */}
      <div className="flex gap-3 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">

        <Link href="/share-price" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Preço</span>
        </Link>

        <Link href="/manual-entry" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <PenLine className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Gasto</span>
        </Link>
        <Link href="/partnership" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Parceria</span>
        </Link>
        <Link href="/shopping-list" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <List className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Lista</span>
        </Link>
        <Link href="/reports" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Relatórios</span>
        </Link>
        <Link href="/categories" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Tags className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Categorias</span>
        </Link>
        <Link href="/settings" className={cn(secondaryBtn, 'no-underline text-inherit')}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb]">
            <Settings className="h-5 w-5" />
          </div>
          <span className="text-xs text-[#666] whitespace-nowrap">Ajustes</span>
        </Link>
      </div>
    </div>
  );
}
