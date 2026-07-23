'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { MerchantProductForm } from './MerchantProductForm';
import { MerchantProductCard } from './MerchantProductCard';
import { MerchantInsumosSection } from './MerchantInsumosSection';
import { formatMerchantApiError, logMerchantApiFailure } from '../../lib/merchant/merchantApiErrorMessage';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { useProdutosLojaRealtime } from '../../hooks/useProdutosLojaRealtime';
import { MerchantMinhaCompraSection } from './MerchantMinhaCompraSection';
import { MerchantListaComprasSection } from './MerchantListaComprasSection';
import { MerchantVendasSection } from './MerchantVendasSection';
import { MerchantSkipPrecosMap } from './precos/MerchantSkipPrecosMap';
import { ParceirosMapFrame } from './ParceirosMapFrame';
import { MerchantMesasSection } from './restaurant/MerchantMesasSection';
import { MerchantCozinhaSection } from './restaurant/MerchantCozinhaSection';
import { MerchantCardapioSection } from './restaurant/MerchantCardapioSection';
import { MerchantQrCodesSection } from './restaurant/MerchantQrCodesSection';
import { MerchantGarcomSection } from './restaurant/MerchantGarcomSection';
import { MerchantCaixaSection } from './restaurant/MerchantCaixaSection';
import { MerchantHistoricoSection } from './restaurant/MerchantHistoricoSection';
import { MerchantTrialReportSection } from './restaurant/MerchantTrialReportSection';
import { MerchantEntregaSection } from './restaurant/MerchantEntregaSection';
import { MerchantPreparoSection } from './restaurant/MerchantPreparoSection';
import { MerchantSkipShell } from './skip/MerchantSkipShell';
import { MerchantSkipDashboard } from './skip/MerchantSkipDashboard';
import { SkipButton } from './skip/SkipButton';
import { MerchantEquipeSection } from './restaurant/MerchantEquipeSection';
import { MerchantPedidosDiretosSection } from './restaurant/MerchantPedidosDiretosSection';
import { PlanLockedNotice } from './PlanLockedNotice';
import {
  PANEL_TAB_FEATURES,
  PANEL_TAB_LABELS,
  clientCanAccessPanelTab,
  unlockPlanForFeature,
} from '../../lib/merchant/storePlans';

function planInfoFromCtx(ctx) {
  const p = ctx?.plan;
  if (!p) return null;
  return {
    planCode: p.code,
    planName: p.name,
    status: p.status,
    trialStartedAt: p.trial_started_at,
    trialEndsAt: p.trial_ends_at,
    features: p.features || [],
    accessActive: p.access_active !== false,
    gatesEnabled: p.gates_enabled !== false,
    missingSchema: Boolean(p.missing_schema),
  };
}

export function MerchantPanel() {
  const { data: session } = useSession();
  const isAdm = Boolean(session?.user?.isFinmemoryAdmin);
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
  const [panelTab, setPanelTab] = useState('mapa');
  const [listaMode, setListaMode] = useState('montar'); // montar | rota
  const [vendasMode, setVendasMode] = useState('pedidos'); // pedidos | terminal
  const [historicoMode, setHistoricoMode] = useState('validacao'); // validacao | pedidos
  const [insumosCount, setInsumosCount] = useState(0);
  /** URL do mapa consumidor com ?cesta= / ?lista= — aberto a partir da Lista. */
  const [cestaMapUrl, setCestaMapUrl] = useState(null);

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
    if (data?.menu_item || data?.source === 'cardapio') {
      setSuccess(data?.product ? 'Item do cardápio salvo.' : 'Item do cardápio criado.');
    } else if (data?.published) {
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

  const onProductDeleted = (id) => {
    setProducts((list) => list.filter((p) => p.id !== id));
    setSuccess('Item removido do cardápio.');
  };

  const storeName = ctx?.store?.name || session?.user?.merchantStoreName || 'Minha loja';
  const flashCount = products.filter((p) => p.em_oferta).length;
  const mapTabAttention = panelTab !== 'mapa';
  const planInfo = planInfoFromCtx(ctx);
  const tabAllowed = clientCanAccessPanelTab(planInfo, panelTab);
  const lockedFeatureKey = PANEL_TAB_FEATURES[panelTab] || null;
  const unlock = lockedFeatureKey ? unlockPlanForFeature(lockedFeatureKey) : null;

  const lockedNotice = !tabAllowed ? (
    <PlanLockedNotice
      featureLabel={PANEL_TAB_LABELS[panelTab] || 'Esta funcionalidade'}
      requiredPlanName={unlock?.name || 'superior'}
      currentPlanName={planInfo?.planName}
      trialEndsAt={planInfo?.trialEndsAt}
    />
  ) : null;

  if (panelTab === 'mapa' && !loading && cestaMapUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#e8e4de]">
        <div className="z-10 flex shrink-0 items-center gap-3 border-b border-[#dadce0] bg-white px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] shadow-[0_1px_3px_rgba(60,64,67,0.12)]">
          <button
            type="button"
            onClick={() => {
              setCestaMapUrl(null);
              setPanelTab('lista');
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-xs font-bold text-[#202124] hover:bg-[#f8f9fa]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar à cesta
          </button>
          <span className="text-sm font-bold text-[#202124]">Rota da cesta</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <ParceirosMapFrame mapUrl={cestaMapUrl} title="Rota de compras — FinMemory" />
        </div>
      </div>
    );
  }

  if (panelTab === 'mapa' && !loading) {
    if (!tabAllowed) {
      return (
        <MerchantSkipShell
          storeName={storeName}
          activeTab={panelTab}
          onTabChange={setPanelTab}
          onSignOut={() => signOut({ callbackUrl: '/parceiros' })}
          mapTabAttention={mapTabAttention}
        >
          <div className="animate-fade-in-up py-6">{lockedNotice}</div>
        </MerchantSkipShell>
      );
    }
    return (
      <MerchantSkipPrecosMap
        storeLat={ctx?.store?.lat}
        storeLng={ctx?.store?.lng}
        onBack={() => setPanelTab('ofertas')}
        onOpenLista={() => {
          setListaMode('montar');
          setPanelTab('lista');
        }}
      />
    );
  }

  return (
    <MerchantSkipShell
      storeName={storeName}
      activeTab={panelTab}
      onTabChange={setPanelTab}
      onSignOut={() => signOut({ callbackUrl: '/parceiros' })}
      mapTabAttention={mapTabAttention}
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
        </div>
      ) : (
        <div className="animate-fade-in-up">
          {error ? (
            <div
              className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-4 mb-4 space-y-3"
              role="alert"
            >
              <p className="m-0">{error}</p>
              {needsPartnerSignup ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href="/parceiros#cadastro"
                    className="inline-flex justify-center items-center rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground text-sm"
                  >
                    Cadastrar minha loja
                  </Link>
                  <SkipButton
                    variant="outline"
                    onClick={async () => {
                      const ok = await tryRepairLink();
                      if (ok) void load();
                    }}
                    disabled={repairing}
                  >
                    {repairing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Já cadastrei — sincronizar
                  </SkipButton>
                </div>
              ) : null}
            </div>
          ) : null}

          {success ? (
            <p
              className="text-sm text-primary bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4 m-0"
              role="status"
            >
              {success}
            </p>
          ) : null}

          {isAdm ? (
            <Link
              href="/parceiros/adm"
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 hover:bg-emerald-100 transition-colors"
            >
              <span>
                <strong className="font-bold">ADM FinMemory Compra</strong>
                <span className="block text-xs text-emerald-800/80 mt-0.5">
                  Usuários, listas, preços e alertas WhatsApp
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-emerald-700">Abrir →</span>
            </Link>
          ) : null}

          {ctx?.store?.needs_review && panelTab !== 'cardapio' ? (
            <p
              className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 font-medium m-0"
              role="status"
            >
              Sua loja está em <strong>análise</strong>. Você pode cadastrar produtos, mas ofertas no mapa e pedidos
              dos clientes só liberam após aprovação da equipe FinMemory.
            </p>
          ) : null}

          {planInfo && !planInfo.missingSchema && planInfo.status === 'trialing' && planInfo.trialEndsAt ? (
            <p
              className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 mb-4 m-0"
              role="status"
            >
              Trial <strong>{planInfo.planName || 'Gestão Completa'}</strong> até{' '}
              {new Date(planInfo.trialEndsAt).toLocaleDateString('pt-BR')}.
            </p>
          ) : null}

          {!tabAllowed ? (
            lockedNotice
          ) : panelTab === 'lista' ? (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setListaMode('montar')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    listaMode === 'montar'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Montar lista
                </button>
                <button
                  type="button"
                  onClick={() => setListaMode('rota')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    listaMode === 'rota'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Rota (estoque)
                </button>
              </div>
              {listaMode === 'montar' ? (
                <MerchantListaComprasSection
                  storeLat={ctx?.store?.lat}
                  storeLng={ctx?.store?.lng}
                  onOpenMap={(url) => {
                    if (typeof url === 'string' && url.trim()) {
                      setCestaMapUrl(url.trim());
                    }
                    setPanelTab('mapa');
                  }}
                  onOpenRota={() => setListaMode('rota')}
                />
              ) : (
                <MerchantMinhaCompraSection
                  storeLat={ctx?.store?.lat}
                  storeLng={ctx?.store?.lng}
                  onOpenMap={(url) => {
                    if (typeof url === 'string' && url.trim()) {
                      setCestaMapUrl(url.trim());
                    }
                    setPanelTab('mapa');
                  }}
                />
              )}
            </div>
          ) : panelTab === 'vendas' ? (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setVendasMode('pedidos')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    vendasMode === 'pedidos'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pedidos QR
                </button>
                <button
                  type="button"
                  onClick={() => setVendasMode('terminal')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    vendasMode === 'terminal'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Terminal
                </button>
              </div>
              {vendasMode === 'pedidos' ? (
                <MerchantPedidosDiretosSection lojaId={ctx?.store?.id} />
              ) : (
                <MerchantVendasSection lojaId={ctx?.store?.id} />
              )}
            </div>
          ) : panelTab === 'insumos' ? (
            <MerchantInsumosSection lojaId={ctx?.store?.id} onCountChange={setInsumosCount} />
          ) : panelTab === 'cozinha' ? (
            <MerchantCozinhaSection lojaId={ctx?.store?.id} />
          ) : panelTab === 'mesas' ? (
            <MerchantMesasSection />
          ) : panelTab === 'cardapio' ? (
            <MerchantCardapioSection
              products={products}
              loading={loading}
              onProductSaved={onProductSaved}
              onProductUpdated={onProductUpdated}
              onProductDeleted={onProductDeleted}
            />
          ) : panelTab === 'codigos' ? (
            <MerchantQrCodesSection storeId={ctx?.store?.id} />
          ) : panelTab === 'garcom' ? (
            <MerchantGarcomSection lojaId={ctx?.store?.id} />
          ) : panelTab === 'caixa' ? (
            <MerchantCaixaSection lojaId={ctx?.store?.id} />
          ) : panelTab === 'historico' ? (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setHistoricoMode('validacao')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    historicoMode === 'validacao'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Validação 30 dias
                </button>
                <button
                  type="button"
                  onClick={() => setHistoricoMode('pedidos')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    historicoMode === 'pedidos'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Histórico pedidos
                </button>
              </div>
              {historicoMode === 'validacao' ? (
                <MerchantTrialReportSection />
              ) : (
                <MerchantHistoricoSection />
              )}
            </div>
          ) : panelTab === 'entrega' ? (
            <MerchantEntregaSection lojaId={ctx?.store?.id} />
          ) : panelTab === 'preparo' ? (
            <MerchantPreparoSection products={products} />
          ) : panelTab === 'equipe' ? (
            <MerchantEquipeSection />
          ) : panelTab === 'ofertas' ? (
            <MerchantSkipDashboard
              products={products}
              mapStatus={mapStatus}
              flashCount={flashCount}
              onNovaVenda={() => setPanelTab('vendas')}
              onOpenEstoque={() => setPanelTab('insumos')}
              onOpenCardapio={() => setPanelTab('cardapio')}
              onOpenMapa={() => setPanelTab('mapa')}
            />
          ) : null}
        </div>
      )}
    </MerchantSkipShell>
  );
}
