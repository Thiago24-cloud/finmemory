import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import { getServerSession } from 'next-auth/next';
import { ProductBarcodeScanner } from '../components/ProductBarcodeScanner';
import { useMissionsToday } from '../components/missions/MissionsTodayContext';
import { completeDailyMission } from '../lib/completeDailyMission';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { getOpenFoodFactsImageUrl } from '../lib/productImageUrl';
import { digitsOnly, isValidRetailBarcode } from '../lib/validateGtin';
import { getScannerGeolocation, formatDistanceShortPt } from '../lib/scannerGeolocation';

const SAME_GTIN_DEBOUNCE_MS = 2500;
const READY_HINT_MS = 1800;
const SESSION_STORAGE_KEY = 'finmemory_scan_cart_session_v1';
/** Missão diária «Escaneie 3 produtos» — XP ao completar 3 passos (ver `daily_missions`). */
const SCAN_MISSION_ID = 'scan_3';
const SCAN_MISSION_TOTAL_STEPS = 3;

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/scan-product', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    if (!canUseRestrictedFeatures(session.user.email)) {
      return { redirect: { destination: '/em-breve', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[scan-product getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/scan-product', permanent: false } };
  }
}

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    const sync = () => setFine(Boolean(mq.matches));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return fine;
}

/** Cartão rápido sobre o vídeo quando o item acaba de entrar (sem ocupar o fluxo inteiro). */
function PeekScanOverlay({ item }) {
  const apiOk = item.apiOk && item.payload;
  const off = item.payload?.openFoodFacts;
  const ph = item.payload?.priceHints;
  const title = off?.name?.trim() || 'Produto';
  const delta =
    apiOk && item.payload ? lineAmountsFromPayload(item.payload).delta : null;

  return (
    <motion.div
      role="status"
      initial={{ y: 56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 32, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 pt-12 bg-gradient-to-t from-black via-black/90 to-transparent"
    >
      <div
        className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 shadow-xl ${
          apiOk ? 'bg-[#111827]/95 border-primary/40' : 'bg-red-950/95 border-red-500/45'
        }`}
      >
        <div className="text-2xl shrink-0 leading-none">{apiOk ? '✓' : '⚠️'}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-white leading-snug line-clamp-2 m-0">{title}</p>
          {apiOk && ph?.hasMapData && (
            <p className="text-[10px] text-primary font-bold mt-1 m-0 truncate">
              {mapPriceLabel(ph)}
            </p>
          )}
          {apiOk && delta != null && delta > 0 && (
            <p className="text-[10px] text-amber-400 font-bold m-0 mt-0.5">
              Δ estimado {formatBRL(delta)}
            </p>
          )}
          {!apiOk && (
            <p className="text-[11px] text-red-200 m-0 mt-1">{item.error || 'Não foi possível ler.'}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatBRL(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

function mapPriceLabel(ph) {
  if (!ph?.hasMapData || ph.bestPrice == null) return null;
  const price = formatBRL(ph.bestPrice);
  const store = ph.bestStoreName ? ` · ${ph.bestStoreName}` : '';
  if (ph.userAtSaleLocation) {
    return `No mercado onde você está: ${price}${store}`;
  }
  if (ph.locationUsed && ph.distanceM != null) {
    const dist = formatDistanceShortPt(ph.distanceM);
    return `Mais perto de você (${dist}): ${price}${store}`;
  }
  return `No mapa: ${price}${store}`;
}

function lineAmountsFromPayload(payload) {
  const ph = payload?.priceHints;
  const ref = ph?.referencePrice != null ? Number(ph.referencePrice) : null;
  const best = ph?.bestPrice != null ? Number(ph.bestPrice) : null;
  const currentDisplay =
    best != null && Number.isFinite(best)
      ? best
      : ref != null && Number.isFinite(ref)
        ? ref
        : null;
  const cheapest = best != null && Number.isFinite(best) ? best : null;
  let delta = null;
  if (
    ref != null &&
    cheapest != null &&
    Number.isFinite(ref) &&
    Number.isFinite(cheapest)
  ) {
    delta = ref - cheapest;
  }
  return { currentDisplay, cheapest, delta, ref, best };
}

export default function ScanProductPage() {
  const { data: session, status } = useSession();
  const { refresh: refreshMissions } = useMissionsToday();
  const [mode, setMode] = useState('intro');
  const [cart, setCart] = useState([]);
  const [scanFeedback, setScanFeedback] = useState('idle');
  const [toast, setToast] = useState(null);

  const [manualCode, setManualCode] = useState('');
  const [manualErr, setManualErr] = useState(null);

  const lookupBusyRef = useRef(false);
  const lastSuccessGtinAtRef = useRef({});
  const readyTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const runLookupAndEnqueue = useCallback(
    async (gtin) => {
      const now = Date.now();
      const lastOk = lastSuccessGtinAtRef.current[gtin];
      if (lastOk && now - lastOk < SAME_GTIN_DEBOUNCE_MS) {
        return;
      }
      if (lookupBusyRef.current) {
        return;
      }

      lookupBusyRef.current = true;
      setScanFeedback('reading');

      try {
        const geo = await getScannerGeolocation();
        const qs = new URLSearchParams({ gtin });
        if (geo?.lat != null && geo?.lng != null) {
          qs.set('lat', String(geo.lat));
          qs.set('lng', String(geo.lng));
        }
        const res = await fetch(`/api/product/barcode-lookup?${qs.toString()}`);
        const data = await res.json();

        let mission = null;
        if (res.ok) {
          try {
            const mRes = await fetch('/api/missions/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mission_id: SCAN_MISSION_ID, steps: 1 }),
            });
            if (mRes.ok) {
              const mJson = await mRes.json();
              mission = {
                xpAwarded: Number(mJson.xp_awarded) || 0,
                stepsDone: typeof mJson.steps_done === 'number' ? mJson.steps_done : null,
                completed: Boolean(mJson.completed),
                alreadyCompleted: Boolean(mJson.already_completed),
              };
              if (mission.xpAwarded > 0) {
                showToast(
                  `+${mission.xpAwarded} XP — Missão «Escaneie 3 produtos» concluída!`
                );
              }
              void refreshMissions({ silent: true });
            }
          } catch (_) {
            mission = null;
          }
        }

        const row = {
          id: `${gtin}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          gtin,
          payload: data,
          apiOk: res.ok,
          error: res.ok ? null : data.error || 'Erro ao consultar.',
          mission,
        };

        setCart((c) => [row, ...c]);

        if (!res.ok) {
          setScanFeedback('idle');
          return;
        }

        lastSuccessGtinAtRef.current[gtin] = Date.now();
        setScanFeedback('ready');
        if (readyTimerRef.current) window.clearTimeout(readyTimerRef.current);
        readyTimerRef.current = window.setTimeout(() => {
          setScanFeedback('idle');
          readyTimerRef.current = null;
        }, READY_HINT_MS);
      } catch (e) {
        const msg = e.message || 'Erro de rede.';
        const row = {
          id: `${gtin}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          gtin,
          payload: null,
          apiOk: false,
          error: msg,
          mission: null,
        };
        setCart((c) => [row, ...c]);
        setScanFeedback('idle');
      } finally {
        lookupBusyRef.current = false;
      }
    },
    [showToast, refreshMissions]
  );

  const onBarcode = useCallback(
    (digits) => {
      if (!digits) return;
      runLookupAndEnqueue(digits);
    },
    [runLookupAndEnqueue]
  );

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const submitManualCode = useCallback(() => {
    const d = digitsOnly(manualCode);
    if (!isValidRetailBarcode(d)) {
      setManualErr('Use 8, 12 ou 13 dígitos (EAN/UPC) com dígito verificador válido.');
      return;
    }
    setManualErr(null);
    runLookupAndEnqueue(d);
    setManualCode('');
  }, [manualCode, runLookupAndEnqueue]);

  const footerTotals = cart.reduce(
    (acc, item) => {
      if (!item.apiOk || !item.payload) return acc;
      const { currentDisplay, cheapest, delta } = lineAmountsFromPayload(item.payload);
      if (currentDisplay != null) acc.sumCurrent += currentDisplay;
      if (cheapest != null) acc.sumCheapest += cheapest;
      if (delta != null && delta > 0) acc.sumDelta += delta;
      if (currentDisplay != null || cheapest != null) acc.countPriced += 1;
      return acc;
    },
    { sumCurrent: 0, sumCheapest: 0, sumDelta: 0, countPriced: 0 }
  );

  const finalizeSession = useCallback(() => {
    if (cart.length === 0) return;
    try {
      const snapshot = {
        savedAt: new Date().toISOString(),
        items: cart.map((it) => ({
          gtin: it.gtin,
          error: it.error,
          productName: it.payload?.openFoodFacts?.name || null,
          priceHints: it.payload?.priceHints || null,
        })),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_) {
      /* */
    }
    setCart([]);
    setMode('intro');
    showToast('Sessão salva no aparelho. Você pode comparar no mapa quando quiser.');
  }, [cart, showToast]);

  const handlePrimarySave = useCallback(() => {
    finalizeSession();
  }, [finalizeSession]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Código de barras | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`
          .scan-camera-shell {
            min-height: min(52vh, 320px);
          }
          @media (min-width: 768px) {
            .scan-camera-shell {
              min-height: 340px;
            }
          }
        `}</style>
      </Head>

      <div className="min-h-screen bg-background text-foreground font-sans pb-28">
        <div className="sticky top-0 z-30 bg-background">
          <div className="flex items-center gap-3 px-5 py-4 bg-card border-b border-[#1E2A3A]">
            <Link
              href="/dashboard"
              className="min-h-[44px] inline-flex items-center gap-2 bg-card border border-[#1E2A3A] text-foreground py-2 px-4 rounded-xl text-sm font-medium hover:bg-[#1E2A3A] transition-colors no-underline"
            >
              ← Voltar
            </Link>
            <h1 className="text-foreground text-[18px] font-black m-0 flex-1">
              {mode === 'session' ? 'Sessão de carrinho' : 'Escanear produto'}
            </h1>
          </div>

          {mode === 'session' && (
            <div className="px-5 pt-3 pb-3 border-b border-[#1E2A3A]">
              <div className="scan-camera-shell relative rounded-2xl overflow-hidden border border-[#1E2A3A] bg-black max-w-lg mx-auto">
                <ProductBarcodeScanner onScan={onBarcode} continuous sessionLayout />

                {scanFeedback === 'reading' && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-6 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-black/35 px-4 py-3 backdrop-blur-[3px] border border-primary/25">
                      <div className="h-1 w-48 max-w-[85%] rounded-full bg-primary shadow-[0_0_16px_#2ECC49] animate-pulse" />
                      <p className="mt-2 text-[11px] font-black tracking-[0.2em] text-primary">LENDO CÓDIGO…</p>
                    </div>
                  </div>
                )}

                {scanFeedback === 'ready' && (
                  <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-amber-400 text-black text-[10px] font-black px-2.5 py-1 shadow-lg">
                    Próximo item
                  </div>
                )}

                <AnimatePresence>
                  {scanFeedback === 'ready' && cart[0] && (
                    <PeekScanOverlay key={cart[0].id} item={cart[0]} />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {mode === 'intro' && (
          <div className="px-5 pt-5 pb-8 max-w-lg mx-auto space-y-4">
            <div className="bg-card border border-[#1E2A3A] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                  📦
                </div>
                <div>
                  <p className="font-bold text-foreground">Identificar produto</p>
                  <p className="text-xs text-muted-foreground">Leia o código de barras EAN/UPC</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                O app identifica o item pelo código de barras e mostra o preço no mapa{' '}
                <strong className="text-foreground">mais perto de você</strong> (ou no mercado onde você está, se a
                localização estiver ativa). Também cruza com o que você já pagou nas notas.
              </p>
              <button
                type="button"
                onClick={() => setMode('session')}
                className="w-full py-4 px-6 bg-primary text-[#0A0E1A] rounded-xl text-base font-black hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Iniciar sessão de carrinho
              </button>
              <p className="text-[11px] text-muted-foreground leading-snug m-0">
                Modo supermercado: a câmera continua ativa; cada leitura entra na lista e o rodapé mostra a economia
                acumulada (quando houver dados no mapa e na sua última nota).
              </p>
            </div>
          </div>
        )}

        {mode === 'session' && (
          <div className="flex flex-col max-w-lg mx-auto min-h-[calc(100vh-8rem)]">
            {/* Lista + manual scrollável */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[11rem] space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed m-0">
                Aponte e segure até vibrar (app nativo) ou use a captura abaixo. Com localização ativa, cada leitura mostra
                o preço do produto no mercado mais próximo — ou no local da venda se você estiver no supermercado. A
                mesma barras em sequência é ignorada por {SAME_GTIN_DEBOUNCE_MS / 1000}s.
              </p>

              <div className="rounded-2xl border border-[#1E2A3A] bg-card/80 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 m-0">Digitar código (EAN / UPC)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="7891234567890"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setManualErr(null);
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#1E2A3A] bg-background text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={submitManualCode}
                    className="shrink-0 py-2.5 px-4 rounded-xl bg-primary text-[#0A0E1A] font-bold text-sm"
                  >
                    Buscar
                  </button>
                </div>
                {manualErr && <p className="text-red-400 text-xs mt-1.5">{manualErr}</p>}
              </div>

              <div>
                <p className="text-sm font-black text-foreground mb-3">Itens nesta sessão</p>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum código ainda — escaneie ou digite acima.</p>
                ) : (
                  <motion.ul layout className="list-none m-0 p-0 space-y-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {cart.map((item) => (
                        <SessionCartRow key={item.id} item={item} onRemove={removeFromCart} />
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </div>
            </div>

            {/* Rodapé economia — acima da barra fixa inferior */}
            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[45] px-4 pt-2 pb-3 bg-[#0d1219]/95 backdrop-blur-xl border-t border-[#1E2A3A] safe-area-bottom max-w-lg mx-auto rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
              <motion.div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold m-0">
                    Total referência
                  </p>
                  <p className="text-lg font-black text-foreground m-0 tabular-nums">
                    {footerTotals.countPriced ? formatBRL(footerTotals.sumCurrent) : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground m-0 mt-0.5">
                    Preço no mapa (perto de você):{' '}
                    <span className="text-primary font-bold tabular-nums">
                      {footerTotals.countPriced ? formatBRL(footerTotals.sumCheapest) : '—'}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide text-amber-600 font-bold m-0">
                    Economia estimada
                  </p>
                  <p className="text-lg font-black text-amber-500 m-0 tabular-nums">
                    {footerTotals.sumDelta > 0 ? formatBRL(footerTotals.sumDelta) : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground m-0">
                    +{cart.reduce((s, it) => s + (it.mission?.xpAwarded || 0), 0)} XP (missão scan) nesta sessão
                  </p>
                </div>
              </motion.div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handlePrimarySave}
                className="mt-3 w-full py-3.5 rounded-xl bg-primary text-[#0A0E1A] font-black text-sm disabled:opacity-40 disabled:pointer-events-none"
              >
                Finalizar / salvar compra
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div
            className="fixed left-1/2 top-[22%] z-[60] -translate-x-1/2 max-w-[min(100vw-2rem,360px)] rounded-xl bg-card border border-primary/30 px-4 py-3 text-sm text-foreground shadow-xl"
            role="status"
          >
            {toast}
          </div>
        )}
      </div>

    </>
  );
}

function SessionCartRow({ item, onRemove }) {
  const finePointer = useFinePointer();
  const { payload, apiOk, error, mission } = item;
  const off = payload?.openFoodFacts;
  const displayGtin = payload?.gtin || item.gtin;
  const fallbackImg = displayGtin ? getOpenFoodFactsImageUrl(displayGtin) : null;
  const imgSrc = off?.imageUrl || fallbackImg;

  const ph = payload?.priceHints;
  const { cheapest, delta } = apiOk && payload ? lineAmountsFromPayload(payload) : {};

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -28, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="relative rounded-2xl border border-[#1E2A3A] overflow-hidden touch-pan-y list-none"
    >
      <div className="absolute inset-y-0 left-0 w-24 bg-red-600/95 flex items-center justify-center pointer-events-none z-0">
        <span className="text-[10px] font-black text-white uppercase tracking-wide px-1 text-center leading-tight">
          Soltar
          <br />
          p/ excluir
        </span>
      </div>

      <motion.div
        drag={finePointer ? 'x' : false}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.14}
        onDragEnd={(_, info) => {
          if (finePointer && info.offset.x < -52) onRemove(item.id);
        }}
        className="relative z-[1] bg-card p-4 space-y-3"
      >
        {!apiOk || !payload ? (
          <p className="text-sm text-red-400 m-0">{error || 'Falha na consulta.'}</p>
        ) : (
          <>
            <div className="flex gap-3 items-start">
              {imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc}
                  alt=""
                  className="w-14 h-14 object-contain rounded-xl bg-background border border-[#1E2A3A] shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-background border border-[#1E2A3A] shrink-0 flex items-center justify-center text-xl">
                  📦
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-black text-foreground leading-snug m-0">
                  {off?.name || 'Produto identificado'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-mono mt-1 m-0">{displayGtin}</p>
                {off?.source === 'cosmos' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 m-0">Fonte: Cosmos Bluesoft</p>
                )}
              </div>
              <div className="shrink-0 text-right max-w-[120px]">
                {mission?.xpAwarded > 0 && (
                  <p className="text-sm font-black text-amber-500 m-0">+{mission.xpAwarded} XP</p>
                )}
                {mission && mission.xpAwarded === 0 && mission.alreadyCompleted && (
                  <p className="text-[10px] font-semibold text-muted-foreground m-0 leading-tight">
                    Missão scan já feita hoje
                  </p>
                )}
                {mission && mission.xpAwarded === 0 && !mission.alreadyCompleted && mission.stepsDone != null && (
                  <p className="text-[10px] font-bold text-amber-600 m-0">
                    Scan {mission.stepsDone}/{SCAN_MISSION_TOTAL_STEPS}
                  </p>
                )}
                {apiOk && mission === null && (
                  <p className="text-[10px] text-muted-foreground m-0">Missão: —</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center border-t border-[#1E2A3A] pt-3">
              <div>
                <p className="text-[10px] text-muted-foreground m-0">Ref. (última nota)</p>
                <p className="text-base font-black text-foreground m-0 tabular-nums">
                  {ph?.referencePrice != null ? formatBRL(ph.referencePrice) : '—'}
                </p>
                {ph?.referenceStore && (
                  <p className="text-[10px] text-muted-foreground truncate m-0">{ph.referenceStore}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground m-0">Menor geral no mapa</p>
                <p className="text-base font-black text-foreground m-0 tabular-nums">
                  {ph?.cheapestGlobal?.price != null
                    ? formatBRL(ph.cheapestGlobal.price)
                    : cheapest != null
                      ? formatBRL(cheapest)
                      : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary m-0">
                {ph?.userAtSaleLocation ? 'Preço no mercado (você está aqui)' : 'Preço no mapa perto de você'}
              </p>
              <p className="text-lg font-black text-primary m-0 tabular-nums">
                {cheapest != null ? formatBRL(cheapest) : '—'}
              </p>
              {ph?.bestStoreName ? (
                <p className="text-[11px] text-muted-foreground truncate m-0">{ph.bestStoreName}</p>
              ) : null}
              {ph?.locationUsed && ph.distanceM != null && !ph.userAtSaleLocation ? (
                <p className="text-[10px] text-muted-foreground m-0">
                  a {formatDistanceShortPt(ph.distanceM)} da sua localização
                </p>
              ) : null}
              {ph?.hasMapData && off?.name ? (
                <Link
                  href={`/mapa?lista=${encodeURIComponent(String(off.name).trim())}`}
                  className="inline-block text-[11px] font-bold text-primary mt-1 no-underline hover:underline"
                >
                  Ver no mapa de preços →
                </Link>
              ) : null}
              {!ph?.hasMapData && (
                <p className="text-[10px] text-muted-foreground m-0">
                  Sem oferta ativa no mapa para este produto agora.
                </p>
              )}
            </div>

            {delta != null && delta > 0 && (
              <p className="text-xs text-center font-bold text-amber-500 m-0">
                Δ possível: {formatBRL(delta)} vs. menor divulgado
              </p>
            )}

            {payload?.yourPurchases?.length > 0 && (
              <p className="text-[11px] text-muted-foreground m-0">
                Última compra registrada: {formatBRL(payload.yourPurchases[0].price)} em{' '}
                {payload.yourPurchases[0].estabelecimento || 'loja'}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors"
        >
          Remover da sessão
        </button>
      </motion.div>
    </motion.li>
  );
}
