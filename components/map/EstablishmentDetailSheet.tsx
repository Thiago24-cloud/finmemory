'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
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

/** Snaps internos — três alturas estilo Google Maps (vaul). */
type SheetSnap = 'collapsed' | 'mid' | 'full';

const Z_OVERLAY = 1099;
const Z_SHEET = 1100;

/** Frações da viewport visível (0–1), alinhadas ao uso em `MapMobileBottomSheet`. */
const SNAP_COLLAPSED = 0.2;
const SNAP_MID = 0.52;
const SNAP_FULL = 0.94;

const SNAP_POINTS = [SNAP_COLLAPSED, SNAP_MID, SNAP_FULL] as const;

function fractionForSnap(s: SheetSnap): number {
  if (s === 'full') return SNAP_FULL;
  if (s === 'mid') return SNAP_MID;
  return SNAP_COLLAPSED;
}

function nearestSnapFromFraction(f: number): SheetSnap {
  let best: SheetSnap = 'mid';
  let bestD = Infinity;
  for (const s of ['collapsed', 'mid', 'full'] as const) {
    const v = fractionForSnap(s);
    const d = Math.abs(f - v);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Nomes esperados por `MapaPrecosLeaflet` / padding do mapa. */
function mapSnapForParent(s: SheetSnap): string {
  if (s === 'full') return 'full';
  if (s === 'mid') return 'half';
  return 'peek';
}

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
  onOfferSeenUpdated?: (offerId: string, observedAt: string, retiredFromList?: boolean) => void;
  onToggleCart?: (product: NormalizedProduct) => void;
  isCartSelected?: (product: NormalizedProduct) => boolean;
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
  onToggleCart,
  isCartSelected,
}: EstablishmentDetailSheetProps) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const [confirmed, setConfirmed] = useState(() => new Set<string>());
  /** Ofertas retiradas do mapa após confirmação (encarte / agente); price_points não usa isto. */
  const [retiredConfirmIds, setRetiredConfirmIds] = useState(() => new Set<string>());
  const [busyId, setBusyId] = useState<string | null>(null);

  const snapRef = useRef<SheetSnap>('mid');
  snapRef.current = snap;

  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayFullRef = useRef(0.52);
  overlayFullRef.current = 0.52;

  const setOverlayBg = useCallback((opacity: number) => {
    const el = overlayRef.current;
    if (el) el.style.backgroundColor = `rgba(0,0,0,${Math.max(0, Math.min(1, opacity))})`;
  }, []);

  const reportMetricsForSnap = useCallback(
    (s: SheetSnap) => {
      const fraction = fractionForSnap(s);
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      const bottomInsetPx = vh > 0 ? Math.round(fraction * vh) : 0;
      onVisualMetrics?.({
        bottomInsetPx,
        snap: mapSnapForParent(s),
        isDragging: false,
        translatePct: vh > 0 ? ((vh - bottomInsetPx) / vh) * 100 : 0,
      });
    },
    [onVisualMetrics]
  );

  const handleSetActiveSnapPoint = useCallback(
    (fraction: number | null) => {
      if (fraction === null || fraction === undefined) {
        setOverlayBg(0);
        onClose();
        return;
      }
      const next = nearestSnapFromFraction(fraction);
      snapRef.current = next;
      setSnap(next);
      setOverlayBg(next === 'full' ? overlayFullRef.current : next === 'mid' ? 0.22 : 0.12);
      reportMetricsForSnap(next);
    },
    [onClose, setOverlayBg, reportMetricsForSnap]
  );

  const onDrag = useCallback(
    (_e: unknown, percentageDragged: number) => {
      setOverlayBg(percentageDragged * overlayFullRef.current);
    },
    [setOverlayBg]
  );

  const onRelease = useCallback(
    (_e: unknown, releasedOpen: boolean) => {
      if (!releasedOpen) setOverlayBg(0);
    },
    [setOverlayBg]
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setCat('all');
      setSnap('mid');
      snapRef.current = 'mid';
      setOverlayBg(0);
      onVisualMetrics?.({ bottomInsetPx: 0, snap: 'closed', isDragging: false });
    }
  }, [open, onVisualMetrics, setOverlayBg]);

  useEffect(() => {
    if (!open) return;
    if (snap === 'full') setOverlayBg(overlayFullRef.current);
    else if (snap === 'mid') setOverlayBg(0.22);
    else setOverlayBg(0.12);
  }, [open, snap, setOverlayBg]);

  useEffect(() => {
    if (open) reportMetricsForSnap(snap);
  }, [open, snap, reportMetricsForSnap]);

  const lastStoreIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !store?.id) return;
    if (lastStoreIdRef.current === store.id) return;
    lastStoreIdRef.current = store.id;
    snapRef.current = 'mid';
    setSnap('mid');
  }, [open, store?.id]);

  const storeNameHint = String(store?.name || '');
  useEffect(() => {
    setRetiredConfirmIds(new Set());
    setConfirmed(new Set());
  }, [store?.id]);

  const normalized = useMemo(() => {
    const base = buildNormalizedList(offers, promotions, storeNameHint);
    return base.filter((row) => !retiredConfirmIds.has(row.confirmId));
  }, [offers, promotions, storeNameHint, retiredConfirmIds]);

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
      const retired = Boolean(data.retired_from_list);
      onOfferSeenUpdated?.(p.confirmId, iso, retired);
      if (retired) {
        setRetiredConfirmIds((prev) => new Set(prev).add(p.confirmId));
      }
      setConfirmed((prev) => new Set(prev).add(p.key));
      if (appUserId) setConfirmLock(appUserId, p.confirmId);
      if (data.awarded && data.xp_awarded) {
        toast.success(`+${data.xp_awarded} XP — Obrigado por colaborar!`);
      } else if (data.reason === 'already_today') {
        toast.message('Você já confirmou esta oferta hoje. Valeu!');
      } else if (retired) {
        toast.success('Oferta confirmada e retirada da lista para todos.');
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
  const activeSnapPoint = fractionForSnap(snap);

  const sheetSurface = [
    'rounded-t-[24px]',
    'border-t border-zinc-800/50',
    'bg-zinc-950/98',
    'shadow-[0_-12px_48px_rgba(0,0,0,0.45)]',
    'supports-[backdrop-filter]:backdrop-blur-xl',
    'outline-none focus:outline-none',
  ].join(' ');

  return (
    <Drawer.Root
      open={open}
      onClose={() => {
        setOverlayBg(0);
        onClose();
      }}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={handleSetActiveSnapPoint}
      dismissible
      modal={false}
      onDrag={onDrag}
      onRelease={onRelease}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          ref={overlayRef}
          className="fixed inset-0"
          style={{
            zIndex: Z_OVERLAY,
            backgroundColor: 'rgba(0,0,0,0)',
            pointerEvents: snap === 'full' ? 'auto' : 'none',
          }}
          onClick={() => {
            if (snap === 'full') {
              snapRef.current = 'mid';
              setSnap('mid');
            }
          }}
        />

        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))] ${sheetSurface}`}
          style={{ zIndex: Z_SHEET, height: '100dvh' }}
          aria-label="Detalhes do estabelecimento"
        >
          <div
            className="flex shrink-0 cursor-grab flex-col items-center justify-center gap-1 border-b border-zinc-800/40 px-4 pb-2 pt-3 active:cursor-grabbing select-none"
            style={{ touchAction: 'none' }}
          >
            <div className="h-1 w-11 shrink-0 rounded-full bg-zinc-600" aria-hidden />
            <span className="text-center text-[10px] font-medium leading-tight text-zinc-500">
              {snap === 'collapsed'
                ? 'Arraste para cima para ver produtos'
                : snap === 'mid'
                  ? 'Arraste para expandir ou recolher'
                  : 'Arraste para baixo para ver o mapa'}
            </span>
          </div>

          <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800/40 px-4 pb-3 pt-2">
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
                onClick={() =>
                  setSnap((s) => (s === 'collapsed' ? 'mid' : s === 'mid' ? 'collapsed' : 'mid'))
                }
              >
                {promoCount} promoç{promoCount === 1 ? 'ão' : 'ões'} em destaque
                <span className="text-zinc-500" aria-hidden>
                  ▾
                </span>
              </button>
            </div>
          </div>

          <div
            className="finmemory-waze-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-6"
            style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="sticky top-0 z-10 -mx-1 bg-zinc-950/95 px-1 pb-2 pt-1 supports-[backdrop-filter]:backdrop-blur-md">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produtos neste local..."
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </div>
              <FilterChips
                chips={filterChipItems}
                activeChipId={cat}
                onChange={setCat}
                className="finmemory-waze-scroll mt-2"
                ariaLabel="Filtros por categoria"
              />
            </div>

            <div className="pt-1">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                </div>
              ) : error ? (
                <p className="px-2 py-6 text-center text-sm text-red-400">{error}</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-zinc-500">Nenhum produto com estes filtros.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-1">
                  {filtered.map((p) => {
                    const badge = getRecencyBadge(p.lastSeenAt);
                    const locked = Boolean(appUserId && isConfirmLocked(appUserId, p.confirmId));
                    const done = confirmed.has(p.key) || locked;
                    const busy = busyId === p.key;
                    const inCart = Boolean(isCartSelected?.(p));
                    return (
                      <article
                        key={p.key}
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
                          {onToggleCart ? (
                            <button
                              type="button"
                              onClick={() => onToggleCart(p)}
                              className={`mt-1 flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                                inCart
                                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                                  : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-300'
                              }`}
                            >
                              {inCart ? '✓ Na cesta' : '+ Cesta'}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
