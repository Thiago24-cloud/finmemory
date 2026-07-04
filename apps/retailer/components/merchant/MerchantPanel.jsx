'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Loader2, Package, Plus, Store, LogOut, MapPin, Zap, Boxes, Map, ListChecks, Receipt } from 'lucide-react';
import { MerchantProductForm } from './MerchantProductForm';
import { MerchantProductCard } from './MerchantProductCard';
import { MerchantOrdersSection } from './MerchantOrdersSection';
import { MerchantStripeSection } from './MerchantStripeSection';
import { MerchantInsumosSection } from './MerchantInsumosSection';
import { formatMerchantApiError, logMerchantApiFailure } from '../../lib/merchant/merchantApiErrorMessage';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { useProdutosLojaRealtime } from '../../hooks/useProdutosLojaRealtime';
import { buildConsumerMapUrl } from '../../lib/consumerAppUrl';
import { ParceirosMapFrame } from './ParceirosMapFrame';
import { MerchantListaComprasSection } from './MerchantListaComprasSection';
import { MerchantVendasSection } from './MerchantVendasSection';

const PANEL_TABS = [
  { id: 'lista', label: 'Lista', Icon: ListChecks },
  { id: 'vendas', label: 'Vendas', Icon: Receipt },
  { id: 'mapa', label: 'Mapa', Icon: Map },
  { id: 'ofertas', label: 'Ofertas', Icon: Zap },
  { id: 'insumos', label: 'Insumos', Icon: Boxes },
];

export function MerchantPanel() {
  const { data: session } = useSession();
  const [ctx, setCtx] = useState(null);
  const [products, setProducts] = useState([]);
  const [mapStatus, setMapStatus] = useState(null);
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [needsPartnerSignup, setNeedsPartnerSignup] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [panelTab, setPanelTab] = useState('ofertas');
  const [insumosCount, setInsumosCount] = useState(0);
  const [customMapEmbedUrl, setCustomMapEmbedUrl] = useState(null);

  const tryRepairLink = useCallback(async () => {
    setRepairing(true);
    setError('');
    try {
      const res = await fetch(painelApi.repairLink, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.linked) {
        setNeedsPartnerSignup(false);
        setSuccess(`Loja vinculada: ${data.store?.name || 'OK'}. Recarregando…`);
        return true;
      }
      logMerchantApiFailure('repair-link', res, data);
      setNeedsPartnerSignup(true);
      setError(
        formatMerchantApiError(
          res,
          data,
          'Sua conta é de lojista, mas ainda não há loja cadastrada. Use o formulário em /parceiros (mesmo e-mail e senha).'
        )
      );
      return false;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[MerchantPanel] repair-link', err);
      setError('Erro de rede ao sincronizar vínculo.');
      return false;
    } finally {
      setRepairing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNeedsPartnerSignup(false);
    try {
      let ctxRes = await fetch(painelApi.context);
      let ctxData = await ctxRes.json().catch(() => ({}));

      if (!ctxRes.ok && ctxData.code === 'MERCHANT_STORE_NOT_LINKED') {
        const repaired = await tryRepairLink();
        if (repaired) {
          ctxRes = await fetch(painelApi.context);
          ctxData = await ctxRes.json().catch(() => ({}));
        }
      }

      const [prodRes, mapStatusRes] = await Promise.all([
        fetch(painelApi.products),
        fetch(painelApi.mapStatus),
      ]);
      const [prodData, mapStatusData] = await Promise.all([
        prodRes.json().catch(() => ({})),
        mapStatusRes.json().catch(() => ({})),
      ]);

      if (!ctxRes.ok) {
        logMerchantApiFailure('context', ctxRes, ctxData);
        if (ctxRes.status === 404 && !ctxData.code) {
          setError(
            'API do painel não encontrada no servidor (404). Confirme o deploy recente — rotas em /api/parceiros/painel/*.'
          );
          setCtx(null);
          return;
        }
        if (ctxData.code === 'MERCHANT_STORE_NOT_LINKED') {
          setNeedsPartnerSignup(true);
        }
        setError(
          formatMerchantApiError(
            ctxRes,
            ctxData,
            'Não foi possível carregar a loja. Se você só escolheu o perfil "lojista", cadastre a loja em /parceiros.'
          )
        );
        setCtx(null);
        return;
      }
      setCtx(ctxData);
      if (!prodRes.ok) {
        logMerchantApiFailure('products', prodRes, prodData);
        setProducts([]);
        if (prodRes.status === 503) {
          setError(
            formatMerchantApiError(
              prodRes,
              prodData,
              'Banco ainda sem a tabela produtos_loja. No Supabase → SQL Editor, execute os arquivos .sql da pasta supabase/migrations (não cole código JavaScript do painel).'
            )
          );
        } else if (prodRes.status === 404 && !prodData.code) {
          setError(
            'API de produtos não encontrada no servidor (404). Confirme o deploy — /api/parceiros/painel/products.'
          );
        } else if (prodRes.status !== 403 && prodRes.status !== 404) {
          setError(
            formatMerchantApiError(prodRes, prodData, 'Erro ao listar produtos.')
          );
        }
      } else {
        setProducts(prodData.products || []);
      }

      if (mapStatusRes.ok) {
        setMapStatus(mapStatusData);
      } else {
        setMapStatus(null);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[MerchantPanel] load', err);
      setError('Erro de rede. Verifique a conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  }, [tryRepairLink]);

  useEffect(() => {
    load();
  }, [load]);

  useProdutosLojaRealtime(ctx?.store?.id, load);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(''), 6000);
    return () => clearTimeout(t);
  }, [success]);

  const onProductSaved = (data) => {
    if (data?.published) {
      const push = data?.nearby_push;
      const notified = push?.notified ?? 0;
      const eligible = push?.eligible ?? 0;
      let msg = 'Oferta relâmpago publicada no mapa (raio ~3 km).';
      if (push?.push_skipped && !push?.onesignal_configured) {
        msg += ' Push: configure OneSignal no servidor para avisar consumidores próximos.';
      } else if (notified > 0) {
        msg += ` Push enviado para ${notified} pessoa${notified === 1 ? '' : 's'} próxima${notified === 1 ? '' : 's'}.`;
      } else if (eligible === 0) {
        msg += ' Nenhum consumidor com localização recente no raio — avisos push quando abrirem o mapa.';
      } else if (push?.skipped_cooldown > 0) {
        msg += ' Consumidores no raio já foram avisados recentemente (cooldown 24h).';
      }
      setSuccess(msg);
    } else {
      setSuccess('Produto salvo no seu estoque.');
    }
    setFormOpen(false);
    void load();
  };

  const onProductUpdated = (updated) => {
    setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  };

  const publishOffersBatch = async () => {
    setPublishingBatch(true);
    setError('');
    try {
      const res = await fetch(painelApi.mapPublishBatch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ only_flash_offer: true, limit: 100 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          formatMerchantApiError(res, data, 'Não foi possível publicar ofertas no mapa.')
        );
        return;
      }
      const published = Number(data?.published || 0);
      const failed = Number(data?.failed || 0);
      const skipped = Number(data?.skipped || 0);
      setSuccess(
        `Publicação em lote concluída: ${published} publicada(s), ${failed} falha(s), ${skipped} ignorada(s).`
      );
      await load();
    } catch {
      setError('Erro de rede ao publicar ofertas em lote.');
    } finally {
      setPublishingBatch(false);
    }
  };

  const storeName = ctx?.store?.name || session?.user?.merchantStoreName || 'Sua loja';
  const flashCount = products.filter((p) => p.em_oferta).length;
  const address = ctx?.store?.address || ctx?.store?.formatted_address;
  const defaultMapEmbedUrl =
    ctx?.store?.lat != null && ctx?.store?.lng != null
      ? buildConsumerMapUrl({
          lat: ctx.store.lat,
          lng: ctx.store.lng,
          zoom: 16,
          from: 'parceiros',
          embed: true,
        })
      : buildConsumerMapUrl({ from: 'parceiros', embed: true });
  const activeTab = PANEL_TABS.find((tab) => tab.id === panelTab) || PANEL_TABS[0];
  const ActiveTabIcon = activeTab.Icon;
  const mapTabAttention = panelTab !== 'mapa';

  if (panelTab === 'mapa' && !loading) {
    const activeMapUrl = customMapEmbedUrl || defaultMapEmbedUrl;
    return (
      <div className="finmemory-light-shell fixed inset-0 z-50 flex flex-col bg-[#f8fafc]">
        <header className="z-10 shrink-0 border-b border-[#e2e8f0] bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[#39FF14]/80 font-bold m-0">
                FinMemory Parceiros
              </p>
              <h1 className="text-base font-bold m-0 truncate text-white">Mapa de preços</h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomMapEmbedUrl(null);
                setPanelTab('lista');
              }}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
            >
              Voltar ao painel
            </button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1">
          <ParceirosMapFrame mapUrl={activeMapUrl} />
        </div>
      </div>
    );
  }

  return (
    <div className="finmemory-light-shell min-h-screen bg-[#050508] text-white">
      <header className="sm:hidden sticky top-0 z-20 border-b border-[#e2e8f0] bg-white/95 backdrop-blur-xl">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[#16a34a] font-black m-0">
                FinMemory Parceiros
              </p>
              <h1 className="text-base font-black m-0 truncate text-[#0f172a]">{storeName}</h1>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/parceiros' })}
              className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {!loading ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-2 py-2">
                <p className="m-0 text-[10px] font-semibold text-[#64748b]">Produtos</p>
                <p className="m-0 text-base font-black text-[#0f172a]">{products.length}</p>
              </div>
              <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-2">
                <p className="m-0 text-[10px] font-semibold text-[#15803d]">Ofertas</p>
                <p className="m-0 text-base font-black text-[#16a34a]">{flashCount}</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelTab('mapa')}
                className={`rounded-2xl border border-[#bbf7d0] bg-white px-2 py-2 text-[#16a34a] ${
                  mapTabAttention ? 'finmemory-map-tab-attention ring-2 ring-[#22c55e]/40' : ''
                }`}
              >
                <Map className="mx-auto h-4 w-4" aria-hidden />
                <span className="mt-0.5 block text-[10px] font-bold">Mapa</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <header className="hidden sm:block border-b border-white/10 bg-[#0a0a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#39FF14]/80 font-bold m-0">
              FinMemory Parceiros
            </p>
            <h1 className="text-lg font-bold m-0 truncate flex items-center gap-2">
              <Store className="h-5 w-5 shrink-0 text-[#39FF14]" aria-hidden />
              {storeName}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/parceiros' })}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-28 sm:py-6 sm:pb-16">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" aria-label="Carregando" />
          </div>
        ) : (
          <>
            {error ? (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-4 space-y-3" role="alert">
                <p className="m-0">{error}</p>
                {needsPartnerSignup ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      href="/parceiros#cadastro"
                      className="inline-flex justify-center items-center rounded-xl bg-[#39FF14] px-4 py-2.5 font-bold text-[#050508] text-sm"
                    >
                      Cadastrar minha loja
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await tryRepairLink();
                        if (ok) void load();
                      }}
                      disabled={repairing}
                      className="inline-flex justify-center items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
                    >
                      {repairing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      Já cadastrei — sincronizar
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {success ? (
              <p className="text-sm text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl px-4 py-3 mb-4" role="status">
                {success}
              </p>
            ) : null}

            {ctx?.store?.needs_review ? (
              <p
                className="text-sm text-[#78350f] bg-[#fffbeb] border border-[#f59e0b]/45 rounded-xl px-4 py-3 mb-4 font-medium"
                role="status"
              >
                Sua loja está em <strong>análise</strong>. Você pode cadastrar produtos, mas ofertas no mapa e pedidos
                dos clientes só liberam após aprovação da equipe FinMemory.
              </p>
            ) : null}

            <div className="hidden sm:block">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <h2 className="text-sm font-bold m-0 text-white/90">Sua loja no mapa</h2>
                {address ? (
                  <p className="text-xs text-white/50 mt-2 m-0 flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                    {address}
                  </p>
                ) : (
                  <p className="text-xs text-white/40 mt-2 m-0">
                    Endereço cadastrado no signup — clientes próximos verão suas ofertas relâmpago.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
                    <Package className="h-3.5 w-3.5 text-white/50" aria-hidden />
                    {products.length} produto{products.length === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] px-3 py-1.5 font-semibold">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                    {flashCount} oferta{flashCount === 1 ? '' : 's'} relâmpago
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-3 m-0">
                  <button
                    type="button"
                    onClick={() => setPanelTab('mapa')}
                    className="text-[#39FF14] hover:underline font-semibold bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Abrir mapa de preços
                  </button>
                  {' · '}
                  Ofertas ativas aparecem por ~3 dias para quem está a até ~3 km.
                </p>
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-sm font-bold m-0 text-white/90">Visibilidade e publicação no mapa</h2>
                  <button
                    type="button"
                    onClick={() => void publishOffersBatch()}
                    disabled={publishingBatch || ctx?.store?.needs_review}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/40 text-[#39FF14] px-3 py-2 text-xs font-semibold hover:bg-[#39FF14]/10 disabled:opacity-50"
                  >
                    {publishingBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Publicar ofertas em lote
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="m-0 text-white/50">Produtos</p>
                    <p className="m-0 mt-1 font-semibold">{mapStatus?.total_products ?? products.length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="m-0 text-white/50">Prontos p/ oferta</p>
                    <p className="m-0 mt-1 font-semibold">{mapStatus?.flash_ready_products ?? flashCount}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="m-0 text-white/50">Promoções ativas</p>
                    <p className="m-0 mt-1 font-semibold">{mapStatus?.active_promotions ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="m-0 text-white/50">Publicações 7d</p>
                    <p className="m-0 mt-1 font-semibold">{mapStatus?.map_publications_last_7d ?? 0}</p>
                  </div>
                </div>
              </section>

              <MerchantStripeSection />

              <MerchantOrdersSection
                lojaId={ctx?.store?.id}
                tempoPreparoMedio={ctx?.store?.tempo_preparo_medio ?? 15}
              />
            </div>

            <div className="sm:hidden mb-4 rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dcfce7] text-[#16a34a]">
                  <ActiveTabIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Área atual</p>
                  <h2 className="m-0 text-lg font-black text-[#0f172a]">{activeTab.label}</h2>
                </div>
              </div>
            </div>

            <div className="mt-8 hidden sm:flex gap-2 border-b border-white/10 pb-px overflow-x-auto" role="tablist" aria-label="Seções do painel">
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'lista'}
                onClick={() => setPanelTab('lista')}
                className={`inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 -mb-px transition-colors ${
                  panelTab === 'lista'
                    ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <ListChecks className="h-4 w-4" aria-hidden />
                Lista
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'vendas'}
                onClick={() => setPanelTab('vendas')}
                className={`inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 -mb-px transition-colors ${
                  panelTab === 'vendas'
                    ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Receipt className="h-4 w-4" aria-hidden />
                Vendas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'mapa'}
                onClick={() => setPanelTab('mapa')}
                className={`inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 -mb-px transition-colors ${
                  panelTab === 'mapa'
                    ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5'
                    : mapTabAttention
                      ? 'finmemory-map-tab-attention border-[#22c55e]/50 text-[#16a34a] bg-[#dcfce7]/80 hover:text-[#15803d]'
                      : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Map className="h-4 w-4" aria-hidden />
                Mapa
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'ofertas'}
                onClick={() => setPanelTab('ofertas')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 -mb-px transition-colors ${
                  panelTab === 'ofertas'
                    ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Zap className="h-4 w-4" aria-hidden />
                Ofertas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'insumos'}
                onClick={() => setPanelTab('insumos')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 -mb-px transition-colors ${
                  panelTab === 'insumos'
                    ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/5'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Boxes className="h-4 w-4" aria-hidden />
                Insumos
                {insumosCount > 0 ? (
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{insumosCount}</span>
                ) : null}
              </button>
            </div>

            {panelTab === 'lista' ? (
              <div className="mt-4">
                <MerchantListaComprasSection
                  storeLat={ctx?.store?.lat}
                  storeLng={ctx?.store?.lng}
                  onOpenMap={(url) => {
                    setCustomMapEmbedUrl(url);
                    setPanelTab('mapa');
                  }}
                />
              </div>
            ) : panelTab === 'vendas' ? (
              <div className="mt-4">
                <MerchantVendasSection lojaId={ctx?.store?.id} />
              </div>
            ) : panelTab === 'insumos' ? (
              <div className="mt-4">
                <MerchantInsumosSection lojaId={ctx?.store?.id} onCountChange={setInsumosCount} />
              </div>
            ) : panelTab === 'ofertas' ? (
            <section className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold m-0">Produtos e ofertas</h2>
                {!formOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFormOpen(true);
                      setSuccess('');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Nova oferta
                  </button>
                ) : null}
              </div>

              {formOpen ? (
                <MerchantProductForm
                  onSaved={onProductSaved}
                  onCancel={() => setFormOpen(false)}
                />
              ) : null}

              {products.length === 0 && !formOpen ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-sm text-white/50 m-0">
                    Nenhum produto ainda. Toque em <strong className="text-white">Nova oferta</strong>, tire uma foto e
                    marque <strong className="text-[#39FF14]">Oferta relâmpago</strong> para aparecer no mapa.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/40 text-[#39FF14] px-4 py-2 text-sm font-semibold hover:bg-[#39FF14]/10"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Criar primeira oferta
                  </button>
                </div>
              ) : (
                <ul className="mt-4 space-y-3 list-none p-0 m-0">
                  {products.map((p) => (
                    <MerchantProductCard key={p.id} product={p} onUpdated={onProductUpdated} />
                  ))}
                </ul>
              )}
            </section>
            ) : null}
          </>
        )}
      </main>

      {!loading ? (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#e2e8f0] bg-white/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {PANEL_TABS.map((tab) => {
              const Icon = tab.Icon;
              const active = panelTab === tab.id;
              const mapAttention = tab.id === 'mapa' && mapTabAttention;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPanelTab(tab.id)}
                  className={`relative flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl px-1 text-[10px] font-bold transition-all ${
                    active
                      ? 'bg-[#dcfce7] text-[#16a34a] shadow-sm'
                      : mapAttention
                        ? 'finmemory-map-tab-attention bg-[#f0fdf4] text-[#16a34a] ring-2 ring-[#22c55e]/35 active:bg-[#dcfce7]'
                        : 'text-[#64748b] active:bg-[#f1f5f9]'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''}`} aria-hidden />
                  <span className="mt-0.5 leading-none">{tab.label}</span>
                  {tab.id === 'insumos' && insumosCount > 0 ? (
                    <span className="absolute right-2 top-1 min-w-4 rounded-full bg-[#16a34a] px-1 text-[9px] leading-4 text-white">
                      {insumosCount > 99 ? '99+' : insumosCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
