'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { CheckCircle2, Instagram, Loader2, Search, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';
import { getMapProductImageSrcForImg } from '../../lib/mapImageProxy';
import { displayPromoProductName } from '../../lib/mapOfferDisplay';
import FilterChips from './FilterChips';

export type EstablishmentSheetOffer = {
  id: string | number;
  product_name?: string | null;
  store_name?: string | null;
  price?: number | null;
  promo_image_url?: string | null;
  category?: string | null;
  observed_at?: string | null;
  created_at?: string | null;
  source?: string | null;
};

export type EstablishmentSheetPromotion = {
  id: string;
  product_name?: string | null;
  store_name?: string | null;
  promo_price?: number | string | null;
  original_price?: number | string | null;
  unit?: string | null;
  category?: string | null;
  product_image_url?: string | null;
  valid_until?: string | null;
  created_at?: string | null;
  club_price?: number | string | null;
};

type SheetSnap = 'collapsed' | 'mid' | 'full';

type NormalizedProduct = {
  key: string;
  confirmId: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  categoryRaw: string;
  lastSeenAt: string;
  unit?: string;
  clubPrice?: number;
  cardType: 'price_points' | 'agent_promotion' | 'encarte';
};

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'all', label: 'Todos', emoji: '🛒' },
  { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { id: 'laticinios', label: 'Laticínios', emoji: '🥛' },
  { id: 'carnes', label: 'Carnes', emoji: '🥩' },
  { id: 'mercearia', label: 'Mercearia', emoji: '🛍️' },
  { id: 'limpeza', label: 'Limpeza', emoji: '🧴' },
  { id: 'hortifruti', label: 'Hortifruti', emoji: '🍎' },
  { id: 'congelados', label: 'Congelados', emoji: '🧊' },
  { id: 'higiene', label: 'Higiene', emoji: '🪥' },
];

function categoryEmojiFromRaw(categoryRaw: string): string {
  const id = inferCategoryPill(categoryRaw);
  const hit = CATEGORIES.find((c) => c.id === id);
  return hit?.emoji ?? CATEGORIES.find((c) => c.id === 'mercearia')?.emoji ?? '🛍️';
}

function ProductCardThumb({ categoryRaw, imageUrl }: { categoryRaw: string; imageUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const img = imageUrl ? getMapProductImageSrcForImg(imageUrl) : '';
  const emoji = categoryEmojiFromRaw(categoryRaw);
  if (!img || failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-zinc-800 text-[2.25rem] leading-none"
        aria-hidden
      >
        {emoji}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function inferCategoryPill(raw: string): string {
  const c = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!c) return 'mercearia';
  if (/bebida|refriger|cervej|cerveja|agua|água|suco|vinho|vodka|whisky|energet/.test(c)) return 'bebidas';
  if (/latic|leite|queijo|iogurte|manteiga|requeij/.test(c)) return 'laticinios';
  if (/carne|aves|peixe|frango|su[ií]no|bov|lingui|hamburg/.test(c)) return 'carnes';
  if (/limpeza|detergente|desinfet|lavagem|amaciante|agua sanitaria|água sanit/.test(c)) return 'limpeza';
  if (/hortifr|frut|verdur|legume|verdura|salada/.test(c)) return 'hortifruti';
  if (/congelad|freezer|sorvete|gelad/.test(c)) return 'congelados';
  if (/higiene|sabon|shampoo|papel higien|absorvent|escova|creme dental/.test(c)) return 'higiene';
  if (/mercearia|gra[oó]|arroz|feijao|feijão|massa|oleo|óleo|acucar|açúcar|sal\b|cafe|café/.test(c)) return 'mercearia';
  return 'mercearia';
}

function buildNormalizedList(
  offers: EstablishmentSheetOffer[],
  promotions: EstablishmentSheetPromotion[],
  storeNameHint: string
): NormalizedProduct[] {
  const hint = String(storeNameHint || '').trim();
  const out: NormalizedProduct[] = [];
  for (const o of offers || []) {
    const pid = String(o.id);
    const lastSeen = String(o.observed_at || o.created_at || new Date().toISOString());
    const src = String(o.source || '');
    const isAgent = src === 'agent_promotions';
    const storeForName = String(o.store_name || hint || '').trim();
    out.push({
      key: `off:${pid}`,
      confirmId: pid,
      name: displayPromoProductName(String(o.product_name ?? ''), storeForName).slice(0, 120),
      price: Number(o.price) || 0,
      imageUrl: o.promo_image_url ? String(o.promo_image_url) : undefined,
      categoryRaw: String(o.category || ''),
      lastSeenAt: lastSeen,
      cardType: isAgent ? 'agent_promotion' : 'price_points',
    });
  }
  for (const p of promotions || []) {
    const id = String(p.id);
    const last = String(p.valid_until || p.created_at || new Date().toISOString());
    const promo = Number(p.promo_price);
    const orig = p.original_price != null && p.original_price !== '' ? Number(p.original_price) : undefined;
    const storeForName = String(p.store_name || hint || '').trim();
    out.push({
      key: `enc:${id}`,
      confirmId: id,
      name: displayPromoProductName(String(p.product_name ?? ''), storeForName).slice(0, 120),
      price: Number.isFinite(promo) ? promo : 0,
      originalPrice: Number.isFinite(orig) ? orig : undefined,
      imageUrl: p.product_image_url ? String(p.product_image_url) : undefined,
      categoryRaw: String(p.category || ''),
      lastSeenAt: last,
      unit: p.unit ? String(p.unit) : undefined,
      clubPrice: p.club_price != null && p.club_price !== '' ? Number(p.club_price) : undefined,
      cardType: 'encarte',
    });
  }
  return out;
}

function formatBrl(n: number) {
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function getRecencyBadge(lastSeenAt: string) {
  let diffMinutes = differenceInMinutes(new Date(), new Date(lastSeenAt));
  if (!Number.isFinite(diffMinutes) || diffMinutes < 0) diffMinutes = 0;
  if (diffMinutes < 60) {
    return {
      label: `Visto há ${diffMinutes} min`,
      className: 'text-emerald-400 bg-emerald-400/10',
    };
  }
  if (diffMinutes < 720) {
    return {
      label: `Visto há ${Math.floor(diffMinutes / 60)}h`,
      className: 'text-amber-400 bg-amber-400/10',
    };
  }
  return {
    label: 'Há mais de 12h',
    className: 'text-zinc-500 bg-zinc-800',
  };
}

function confirmLockKey(appUserId: string, confirmId: string) {
  return `finmemory_price_confirm_lock_${appUserId}_${confirmId}`;
}

function isConfirmLocked(appUserId: string | null | undefined, confirmId: string) {
  if (!appUserId || typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(confirmLockKey(appUserId, confirmId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setConfirmLock(appUserId: string, confirmId: string) {
  try {
    window.localStorage.setItem(confirmLockKey(appUserId, confirmId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export type EstablishmentDetailSheetProps = {
  open: boolean;
  store: { id: string; name?: string | null; address?: string | null; photo_url?: string | null } | null;
  offers: EstablishmentSheetOffer[];
  promotions: EstablishmentSheetPromotion[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onVisualMetrics?: (m: {
    bottomInsetPx: number;
    translatePct?: number;
    snap?: string;
    isDragging?: boolean;
  }) => void;
  canConfirmPrice: boolean;
  appUserId?: string | null;
  onOfferSeenUpdated?: (offerId: string, observedAt: string) => void;
};

export default function EstablishmentDetailSheet({
  open,
  store,
  offers,
  promotions,
  loading,
  error,
  onClose,
  onVisualMetrics,
  canConfirmPrice,
  appUserId,
  onOfferSeenUpdated,
}: EstablishmentDetailSheetProps) {
  const [vh, setVh] = useState(640);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const [confirmed, setConfirmed] = useState(() => new Set<string>());
  const [busyId, setBusyId] = useState<string | null>(null);
  const y = useMotionValue(400);
  const draggingRef = useRef(false);
  const snapRef = useRef<SheetSnap>('mid');
  const dragBase = useRef(0);

  useEffect(() => {
    const r = () => setVh(typeof window !== 'undefined' ? window.innerHeight : 640);
    r();
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const collapsedY = useMemo(() => Math.max(0, vh - 120), [vh]);
  const midY = useMemo(() => Math.max(0, vh - Math.round(vh * 0.6)), [vh]);
  const fullY = 0;

  const yForSnap = useCallback(
    (s: SheetSnap) => {
      if (s === 'full') return fullY;
      if (s === 'mid') return midY;
      return collapsedY;
    },
    [collapsedY, midY]
  );

  const reportMetrics = useCallback(
    (yy: number, dragging: boolean) => {
      const bottomInsetPx = Math.max(0, Math.round(vh - yy));
      onVisualMetrics?.({
        bottomInsetPx,
        snap: snapRef.current,
        isDragging: dragging,
        translatePct: vh > 0 ? (yy / vh) * 100 : 0,
      });
    },
    [onVisualMetrics, vh]
  );

  /** Evita setState + invalidateSize no Leaflet a cada frame do spring (quebra _leaflet_pos). */
  const metricsRafRef = useRef<number | null>(null);
  const lastReportedBottomRef = useRef<number | null>(null);

  const scheduleMetricsFromY = useCallback(() => {
    if (metricsRafRef.current != null) return;
    metricsRafRef.current = requestAnimationFrame(() => {
      metricsRafRef.current = null;
      const latest = y.get();
      const bottomInsetPx = Math.max(0, Math.round(vh - latest));
      const prev = lastReportedBottomRef.current;
      if (prev != null && Math.abs(bottomInsetPx - prev) < 12 && !draggingRef.current) {
        return;
      }
      lastReportedBottomRef.current = bottomInsetPx;
      reportMetrics(latest, draggingRef.current);
    });
  }, [vh, y, reportMetrics]);

  useLayoutEffect(() => {
    if (!open) return;
    snapRef.current = snap;
    const target = yForSnap(snap);
    y.set(target);
    reportMetrics(target, false);
  }, [open, snap, yForSnap, y, reportMetrics]);

  const lastStoreIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastStoreIdRef.current = null;
      lastReportedBottomRef.current = null;
      setSearch('');
      setCat('all');
      setSnap('mid');
      snapRef.current = 'mid';
      onVisualMetrics?.({ bottomInsetPx: 0, snap: 'closed', isDragging: false });
    }
  }, [open, onVisualMetrics]);

  useEffect(() => {
    if (!open) return undefined;
    const target = yForSnap(snap);
    const c = animate(y, target, {
      type: 'spring',
      stiffness: 300,
      damping: 32,
      onComplete: () => {
        lastReportedBottomRef.current = null;
        reportMetrics(y.get(), false);
      },
    });
    return () => c.stop();
  }, [open, snap, y, yForSnap, reportMetrics]);

  useLayoutEffect(() => {
    if (!open || !store?.id) return;
    if (lastStoreIdRef.current === store.id) return;
    lastStoreIdRef.current = store.id;
    const t = yForSnap('mid');
    y.set(t);
    snapRef.current = 'mid';
    setSnap('mid');
  }, [open, store?.id, yForSnap, y]);

  const storeNameHint = String(store?.name || '');
  const normalized = useMemo(
    () => buildNormalizedList(offers, promotions, storeNameHint),
    [offers, promotions, storeNameHint]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return normalized.filter((p) => {
      if (cat !== 'all' && inferCategoryPill(p.categoryRaw) !== cat) return false;
      if (q.length < 2) return true;
      return p.name.toLowerCase().includes(q) || p.categoryRaw.toLowerCase().includes(q);
    });
  }, [normalized, search, cat]);
  const filterChipItems = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        icon: c.emoji,
      })),
    []
  );

  const promoCount = normalized.length;

  const onPanStart = useCallback(() => {
    draggingRef.current = true;
    dragBase.current = y.get();
  }, [y]);

  const onPan = useCallback((_: unknown, info: { offset: { y: number } }) => {
    const next = Math.min(collapsedY, Math.max(fullY, dragBase.current + info.offset.y));
    y.set(next);
    scheduleMetricsFromY();
  }, [collapsedY, fullY, y, scheduleMetricsFromY]);

  const onPanEnd = useCallback(() => {
    draggingRef.current = false;
    const cur = y.get();
    const snaps = [
      { s: 'full' as const, v: fullY },
      { s: 'mid' as const, v: midY },
      { s: 'collapsed' as const, v: collapsedY },
    ];
    const nearest = snaps.reduce((a, b) => (Math.abs(b.v - cur) < Math.abs(a.v - cur) ? b : a));
    snapRef.current = nearest.s;
    setSnap(nearest.s);
    animate(y, nearest.v, {
      type: 'spring',
      stiffness: 300,
      damping: 32,
      onComplete: () => {
        lastReportedBottomRef.current = null;
        reportMetrics(y.get(), false);
      },
    });
  }, [fullY, midY, collapsedY, y, reportMetrics]);

  const handleConfirm = async (p: NormalizedProduct) => {
    if (!store?.id || !canConfirmPrice) {
      toast.error('Faça login para confirmar o preço na loja.');
      return;
    }
    if (appUserId && isConfirmLocked(appUserId, p.confirmId)) {
      toast.message('Já confirmado nas últimas 24h. Obrigado!');
      return;
    }
    setBusyId(p.key);
    try {
      const res = await fetch('/api/map/confirm-offer-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: p.confirmId, storeId: store.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível confirmar');
      const iso = data.observed_at || new Date().toISOString();
      onOfferSeenUpdated?.(p.confirmId, iso);
      setConfirmed((prev) => new Set(prev).add(p.key));
      if (appUserId) setConfirmLock(appUserId, p.confirmId);
      if (data.awarded && data.xp_awarded) {
        toast.success(`+${data.xp_awarded} XP — Obrigado por colaborar!`);
      } else if (data.reason === 'already_today') {
        toast.message('Você já confirmou esta oferta hoje. Valeu!');
      } else {
        toast.success('Obrigado! A data do preço foi atualizada para todos.');
      }
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.72 },
        colors: ['#f97316', '#10b981', '#ffffff', '#fbbf24'],
        ticks: 200,
        gravity: 1.2,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setBusyId(null);
    }
  };

  if (!open || !store) return null;

  const logo = store.photo_url?.trim() || '';

  return (
    <>
      {snap === 'full' ? (
        <button
          type="button"
          aria-label="Fechar"
          className="fixed inset-0 z-[1003] border-0 bg-black/60 p-0"
          onClick={() => setSnap('mid')}
        />
      ) : null}

      <motion.div
        role="dialog"
        aria-modal={snap === 'full'}
        className="fixed inset-x-0 bottom-0 z-[1004] flex max-h-none flex-col rounded-t-2xl border border-zinc-800/50 bg-zinc-950/95 shadow-[0_-12px_48px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:backdrop-blur-xl"
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          y,
          touchAction: snap === 'full' ? 'pan-y' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <motion.div
          className="flex shrink-0 flex-col pt-2"
          onPanStart={onPanStart}
          onPan={onPan}
          onPanEnd={onPanEnd}
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-zinc-600" />
          <div className="flex items-start gap-3 px-4 pb-2">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">🏪</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate text-base font-semibold leading-tight text-zinc-100">{store.name}</h2>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Fechar"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {store.address ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{store.address}</p>
              ) : null}
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-left text-xs font-medium text-orange-400 hover:text-orange-300"
                onClick={() => setSnap((s) => (s === 'collapsed' ? 'mid' : 'collapsed'))}
              >
                {promoCount} promoç{promoCount === 1 ? 'ão' : 'ões'} em destaque
                <span className="text-zinc-500" aria-hidden>
                  ▾
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3">
          <div className="sticky top-0 z-10 -mx-1 shrink-0 bg-zinc-950/95 px-1 pb-2 pt-1 supports-[backdrop-filter]:backdrop-blur-md">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos neste local..."
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                data-sheet-no-drag
              />
            </div>
          </div>

          <FilterChips
            chips={filterChipItems}
            activeChipId={cat}
            onChange={setCat}
            className="finmemory-waze-scroll shrink-0"
            ariaLabel="Filtros por categoria"
          />

          <div className="min-h-0 flex-1 overflow-y-auto pb-6" data-sheet-no-drag style={{ touchAction: 'pan-y' }}>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              </div>
            ) : error ? (
              <p className="px-2 py-6 text-center text-sm text-red-400">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-zinc-500">Nenhum produto com estes filtros.</p>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-2 px-1"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.04 } },
                }}
              >
                {filtered.map((p) => {
                  const badge = getRecencyBadge(p.lastSeenAt);
                  const locked = Boolean(appUserId && isConfirmLocked(appUserId, p.confirmId));
                  const done = confirmed.has(p.key) || locked;
                  const busy = busyId === p.key;
                  return (
                    <motion.article
                      key={p.key}
                      variants={{
                        hidden: { opacity: 0, y: 16 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/80"
                    >
                      <span
                        className={`absolute right-1.5 top-1.5 z-[1] max-w-[56%] truncate rounded px-1.5 py-0.5 text-[9px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-zinc-800">
                        <ProductCardThumb categoryRaw={p.categoryRaw} imageUrl={p.imageUrl} />
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-200">{p.name}</p>
                        {p.originalPrice != null && p.originalPrice > p.price ? (
                          <p className="text-xs text-zinc-500 line-through">De {formatBrl(p.originalPrice)}</p>
                        ) : null}
                        <p className="text-lg font-bold leading-tight text-orange-400">
                          {formatBrl(p.price)}
                          {p.unit ? (
                            <span className="text-xs font-normal text-zinc-400"> /{p.unit}</span>
                          ) : null}
                        </p>
                        {p.clubPrice != null && Number.isFinite(p.clubPrice) && p.clubPrice > 0 ? (
                          <p className="text-[10px] text-zinc-500">Clube {formatBrl(p.clubPrice)}</p>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canConfirmPrice || busy || done}
                          onClick={() => handleConfirm(p)}
                          className={`mt-auto flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                            done
                              ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                              : 'border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 opacity-80" />
                          )}
                          {done ? 'Confirmado ✓' : 'Confirmar preço'}
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">Seu impacto na comunidade</p>
              <p className="mt-1 text-sm text-zinc-400">
                Confirmações contam para o ranking semanal e XP (máx. 1 por oferta/dia).
              </p>
              <a
                href="https://instagram.com/finmemory.oficial"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-orange-400"
              >
                <Instagram className="h-3.5 w-3.5" />
                Ver novidades no Instagram
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
