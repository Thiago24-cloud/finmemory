'use client';

import {
  AlertTriangle,
  DollarSign,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Zap,
} from 'lucide-react';
import { SkipButton } from './SkipButton';
import { SkipCard, SkipCardContent } from './SkipCard';
import { cn } from '../../../lib/skip/cn';

function formatBrl(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Dashboard no estilo Skip Index.tsx
 */
export function MerchantSkipDashboard({
  products = [],
  mapStatus,
  flashCount,
  onNovaVenda,
  onOpenEstoque,
  onOpenCardapio,
  onOpenMapa,
}) {
  const stockValue = products.reduce((sum, p) => {
    const price = Number(p.price || p.preco || 0);
    const qty = Number(p.quantity ?? p.estoque ?? 1);
    return sum + price * qty;
  }, 0);

  const lowStockCount = mapStatus?.low_stock_count ?? 0;

  return (
    <div className="space-y-6 animate-fade-in-up pb-8">
      <div>
        <h1 className="text-2xl font-bold mb-1 m-0">Dashboard</h1>
        <p className="text-muted-foreground text-sm m-0">Visão geral do seu negócio</p>
      </div>

      <SkipButton
        className="w-full h-14 rounded-xl text-lg font-bold gap-2"
        onClick={onNovaVenda}
      >
        <Plus className="w-6 h-6" />
        NOVA VENDA
      </SkipButton>

      <SkipCard className="bg-primary/5 border-primary/20 shadow-subtle">
        <SkipCardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Produtos no cardápio
            </span>
            <div className="p-2 rounded-lg bg-primary/15">
              <Package className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-black text-primary tracking-tight m-0">
            {formatBrl(stockValue)}
          </p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <p className="text-xs text-muted-foreground m-0">{products.length} itens cadastrados</p>
            <p className="text-xs text-muted-foreground m-0 flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              {flashCount} oferta{flashCount === 1 ? '' : 's'} relâmpago
            </p>
          </div>
        </SkipCardContent>
      </SkipCard>

      <div className="grid grid-cols-2 gap-4">
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Promoções ativas
              </span>
            </div>
            <p className="text-xl font-bold text-primary m-0">
              {mapStatus?.active_promotions ?? flashCount}
            </p>
          </SkipCardContent>
        </SkipCard>

        <SkipCard className={cn(lowStockCount > 0 && 'border-destructive/30 shadow-subtle')}>
          <SkipCardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle
                className={cn(
                  'w-4 h-4',
                  lowStockCount > 0 ? 'text-destructive' : 'text-muted-foreground'
                )}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Estoque baixo
              </span>
            </div>
            <p
              className={cn(
                'text-xl font-bold m-0',
                lowStockCount > 0 ? 'text-destructive' : 'text-foreground'
              )}
            >
              {lowStockCount}
            </p>
          </SkipCardContent>
        </SkipCard>
      </div>

      {flashCount > 0 ? (
        <SkipCard className="border-primary/20 shadow-subtle">
          <SkipCardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold m-0">Ofertas no mapa</p>
              <p className="text-xs text-muted-foreground m-0 mt-1">
                {mapStatus?.map_publications_last_7d ?? 0} publicações nos últimos 7 dias
              </p>
            </div>
            <SkipButton variant="outline" size="sm" onClick={onOpenMapa}>
              Ver preços
            </SkipButton>
          </SkipCardContent>
        </SkipCard>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <SkipButton
          variant="outline"
          className="h-16 rounded-xl flex-col gap-1"
          onClick={onOpenEstoque}
        >
          <Package className="w-5 h-5" />
          <span className="text-xs">Estoque</span>
        </SkipButton>
        <SkipButton
          variant="outline"
          className="h-16 rounded-xl flex-col gap-1"
          onClick={onOpenCardapio}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs">Cardápio</span>
        </SkipButton>
      </div>

      <SkipCard className="shadow-subtle">
        <SkipCardContent className="p-4 flex items-start gap-3">
          <Store className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium m-0">Mapa de preços</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">
              Compare preços de insumos nas redes próximas e monte sua lista de compras.
            </p>
            <SkipButton variant="ghost" size="sm" className="mt-2 px-0 h-auto" onClick={onOpenMapa}>
              Abrir mapa →
            </SkipButton>
          </div>
        </SkipCardContent>
      </SkipCard>
    </div>
  );
}
