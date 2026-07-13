'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Package,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';

export function MerchantPreparoSection({ products = [] }) {
  const [selectedId, setSelectedId] = useState('');
  const [porcoes, setPorcoes] = useState('10');
  const [breakdown, setBreakdown] = useState([]);
  const [produtoNome, setProdutoNome] = useState('');
  const [hasInsufficient, setHasInsufficient] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadBreakdown = useCallback(async () => {
    if (!selectedId) {
      setBreakdown([]);
      return;
    }
    setLoading(true);
    try {
      const qty = parseInt(porcoes, 10) || 10;
      const qs = new URLSearchParams({
        produto: selectedId,
        porcoes: String(qty),
      });
      const res = await fetch(`${painelApi.preparo}?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setBreakdown(json.breakdown || []);
        setProdutoNome(json.produto?.nome || '');
        setHasInsufficient(Boolean(json.has_insufficient));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, porcoes]);

  useEffect(() => {
    void loadBreakdown();
  }, [loadBreakdown]);

  const menuProducts = products.filter((p) => p.status_disponivel !== false && p.active !== false);

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={CalendarCheck}
        title="Preparo"
        description="Planeje porções e verifique insumos no estoque."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Item do cardápio</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecione…</option>
            {menuProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Porções planejadas</label>
          <input
            type="number"
            min="1"
            max="500"
            value={porcoes}
            onChange={(e) => setPorcoes(e.target.value)}
            className="w-full max-w-[140px] rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : selectedId && breakdown.length === 0 ? (
        <SkipCard className="border-dashed shadow-subtle">
          <SkipCardContent className="p-8 text-center">
            <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground m-0">
              Este item não possui insumos vinculados. Associe um insumo no cardápio ou cadastre composições.
            </p>
          </SkipCardContent>
        </SkipCard>
      ) : breakdown.length > 0 ? (
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <h3 className="font-bold m-0 mb-3 flex justify-between">
              <span>{produtoNome}</span>
              <span className="text-sm font-normal text-muted-foreground">{porcoes} porções</span>
            </h3>
            {hasInsufficient ? (
              <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive m-0">Insumos insuficientes para a quantidade planejada.</p>
              </div>
            ) : null}
            <ul className="space-y-2 list-none p-0 m-0">
              {breakdown.map((item) => (
                <li
                  key={item.insumo_id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    item.sufficient ? 'border-border bg-muted/30' : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  {item.sufficient ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium m-0">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground m-0 mt-0.5">
                      {item.per_portion} {item.unit}/porção · Necessário: <strong>{item.needed}</strong> · Disponível:{' '}
                      <strong>{item.available}</strong> {item.unit}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SkipCardContent>
        </SkipCard>
      ) : null}
    </div>
  );
}
