'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Link as LinkIcon, Package, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { useBridgeContext } from './BridgeContext';
import { BridgeInsumoComprarPanel } from './BridgeInsumoComprarPanel';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';

export function BridgeCatalogo() {
  const { selectedMerchant } = useBridgeContext();
  const [insumos, setInsumos] = useState([]);
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const [demoReason, setDemoReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [selectedInsumo, setSelectedInsumo] = useState(null);

  const load = useCallback(async () => {
    if (!selectedMerchant?.store_id) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/parceiros/adm/bridge/insumos?store_id=${encodeURIComponent(selectedMerchant.store_id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setInsumos(data.insumos || []);
      setIsDemoPreview(Boolean(data.is_demo_preview));
      setDemoReason(data.demo_reason || '');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMerchant?.store_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedInsumo(null);
  }, [selectedMerchant?.store_id]);

  async function seedDemo() {
    if (!selectedMerchant?.store_id) return;
    setSeeding(true);
    setErr('');
    try {
      const res = await fetch('/api/parceiros/adm/bridge/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedMerchant.store_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gravar demo');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSeeding(false);
    }
  }

  const filtered = insumos.filter(
    (i) =>
      i.nome?.toLowerCase().includes(search.toLowerCase()) ||
      (i.ean && i.ean.includes(search)) ||
      (i.consumer_external_code && i.consumer_external_code.toLowerCase().includes(search.toLowerCase()))
  );

  function toggleInsumo(insumo) {
    setSelectedInsumo((prev) => (prev?.id === insumo.id ? null : insumo));
  }

  if (!selectedMerchant) {
    return <p className="text-sm fm-bridge-page-sub">Selecione um comerciante acima para ver o catálogo.</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl fm-bridge-page-title">Catálogo de Insumos</h1>
        <p className="fm-bridge-page-sub mt-1">
          Estoque mapeado a partir das notas fiscais. Clique em um insumo para ver onde comprá-lo perto de
          você.
        </p>
      </div>

      {isDemoPreview ? (
        <div className="fm-bridge-demo-banner px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium m-0">Preview demo (Replit)</p>
              <p className="text-xs opacity-80 m-0 mt-0.5">
                {demoReason || '9 insumos básicos — arroz, feijão, sal, óleo, açúcar e mais.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={seedDemo}
            disabled={seeding}
            className="fm-bridge-btn-primary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
          >
            {seeding ? 'Gravando…' : 'Gravar na loja'}
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          placeholder="Buscar por nome ou código..."
          className="fm-bridge-search w-full pl-9 pr-3 py-2.5 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white border border-[#e8ece9] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="fm-bridge-card border-dashed p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhum insumo encontrado</h3>
          <p className="fm-bridge-page-sub mt-1">
            As notas fiscais digitadas criarão seu catálogo automaticamente.
          </p>
        </div>
      ) : (
        <div className="fm-bridge-catalog-layout">
          {selectedInsumo ? (
            <aside className="fm-bridge-catalog-aside hidden lg:block">
              <BridgeInsumoComprarPanel
                insumo={selectedInsumo}
                onClose={() => setSelectedInsumo(null)}
              />
            </aside>
          ) : null}

          <div className="grid gap-3 min-w-0 flex-1">
            {filtered.map((insumo) => {
              const isSelected = selectedInsumo?.id === insumo.id;
              return (
                <div
                  key={insumo.id}
                  className={`fm-bridge-card overflow-hidden fm-bridge-insumo-card${isSelected ? ' is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="fm-bridge-insumo-card-btn w-full text-left"
                    onClick={() => toggleInsumo(insumo)}
                    aria-expanded={isSelected}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-semibold text-[#111827] truncate">{insumo.nome}</h3>
                          {!insumo.ativo ? (
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">Inativo</span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {insumo.ean ? (
                            <span className="fm-bridge-badge-ean">EAN: {insumo.ean}</span>
                          ) : null}
                          {insumo.consumer_external_code ? (
                            <span className="flex items-center text-xs text-[#22a83a] bg-[rgba(46,204,73,0.1)] px-1.5 py-0.5 rounded font-medium">
                              <LinkIcon className="w-3 h-3 mr-1" /> ERP: {insumo.consumer_external_code}
                            </span>
                          ) : (
                            <span className="fm-bridge-badge-erp">Sem vínculo ERP</span>
                          )}
                        </div>
                        <p className="fm-bridge-insumo-hint m-0 mt-2 flex items-center gap-1.5 text-xs text-[#22a83a]">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Toque para ver onde comprar perto de você
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                        </p>
                      </div>

                      <div className="flex sm:flex-col gap-6 sm:gap-2 items-end shrink-0 sm:text-right">
                        <div>
                          <span className="fm-bridge-stat-label block">Estoque</span>
                          <span className="font-medium text-[#111827]">
                            {insumo.quantidade_atual} {insumo.unidade}
                          </span>
                        </div>
                        <div>
                          <span className="fm-bridge-stat-label block">Custo Médio</span>
                          <span className="font-medium text-[#111827]">{fmtCurrency(insumo.custo_medio || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isSelected ? (
                    <div className="lg:hidden border-t border-[#e8ece9] p-4 pt-0">
                      <BridgeInsumoComprarPanel insumo={insumo} onClose={() => setSelectedInsumo(null)} compact />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
