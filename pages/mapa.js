import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import Image from 'next/image';
import {
  Search,
  Menu,
  ListChecks,
  Navigation,
  Zap,
  Camera,
  Route,
  Map,
  Wallet,
  Sparkles,
  ShoppingCart,
  ScanBarcode,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { MAP_THEMES, MAP_THEME_STORAGE_KEY } from '../lib/colors';
import { useMatchMedia } from '../lib/useMatchMedia';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { MapOverlayCategoryChips } from '../components/map/MapOverlayCategoryChips';
import { StatesUnlockPanel } from '../components/map/StatesUnlockPanel';
import { FinancePlansInline } from '../components/FinancePlansInline';
import { BRAND } from '../lib/brandTokens';
import { MAP_ARIA, MAP_PLACEHOLDERS } from '../lib/appMicrocopy';
import { CharacterWidget } from '../components/gamification/CharacterWidget';
import { useGamification } from '../hooks/useGamification';
import { MapOnboardingTutor } from '../components/onboarding/MapOnboardingTutor';
import { CacaPrecoJourney } from '../components/onboarding/CacaPrecoJourney';
import {
  shouldForceCacaPrecoJourney,
  isCacaPrecoJourneyDoneLocal,
} from '../lib/onboarding/cacaPrecoJourneyStorage';

const MapaPrecos = dynamic(() => import('../components/MapaPrecos'), { ssr: false });

/** Mapa em tela cheia; UI flutuante — só para alinhar GPS/carrinho no Leaflet. */
const MAP_MAP_PADDING_TOP_PX = 0;
/** Altura aproximada da faixa flutuante (safe area + barra pesquisa + fila de chips — mobile em 2 linhas). */
/** Faixa superior (busca + chips + mascote compacto). */
const MAP_OVERLAY_TOP_LOGGED_PX = 228;
const MAP_OVERLAY_TOP_GUEST_PX = 56;

function formatCurrencyBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(2).replace('.', ',');
}

function formatDistancePtBr(meters) {
  const n = Number(meters);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return `${Math.round(n)} m`;
  return `${(n / 1000).toFixed(1).replace('.', ',')} km`;
}

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/mapa', permanent: false } };
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
    console.error('[mapa getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/mapa', permanent: false } };
  }
}

export default function MapaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: gamification, loading: gamificationLoading } = useGamification();
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showStatesPanel, setShowStatesPanel] = useState(false);
  const [mapThemeId, setMapThemeId] = useState('verde');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  /** Padrão "Todos" (como referência DIA) — mapa mostra todas as ofertas/pontos até filtrar. */
  const [promoOnly, setPromoOnly] = useState(false);
  const [mapChipSelection, setMapChipSelection] = useState('todos');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [chipsShouldHide, setChipsShouldHide] = useState(false);
  const searchInputRef = useRef(null);
  const narrowScreen = useMatchMedia('(max-width: 767px)');
  const parsedPlanningItems = searchQuery
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const planningMode = parsedPlanningItems.length > 0;
  const [planningSummary, setPlanningSummary] = useState(null);
  const [planningActionRequest, setPlanningActionRequest] = useState({ id: 0, mode: '' });
  const [planningIntelExpanded, setPlanningIntelExpanded] = useState(false);
  const [planningListaSheetOpen, setPlanningListaSheetOpen] = useState(false);
  /** Tem de vir antes de `showMapLanding` — senão TDZ no bundle (“Cannot access … before initialization”). */
  const [mapLandingOpen, setMapLandingOpen] = useState(false);
  const dismissMapLanding = useCallback(() => {
    try {
      sessionStorage.setItem('finmemory_map_landing_dismissed', '1');
    } catch {
      /* ignore */
    }
    setMapLandingOpen(false);
  }, []);

  const wazeUi = router.isReady && router.query.waze === '1';
  const mapPaddingTopPx = MAP_MAP_PADDING_TOP_PX;
  const mapOverlayTopPx = session ? MAP_OVERLAY_TOP_LOGGED_PX : MAP_OVERLAY_TOP_GUEST_PX;
  /** Onboarding em tela cheia: mapa não monta até o utilizador escolher (evita mapa “por baixo”). */
  const showMapLanding = Boolean(session && mapLandingOpen && !wazeUi);

  /** Lista vinda de /shopping-list (?lista=manga,pera) — preenche o planejador de compras. */
  const listaParamAppliedRef = useRef(null);
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.lista;
    if (typeof raw !== 'string' || !raw.trim()) return;
    if (listaParamAppliedRef.current === raw) return;
    listaParamAppliedRef.current = raw;
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (parts.length) setSearchQuery(parts.join(', '));
  }, [router.isReady, router.query.lista]);

  // "Como quer começar?" é opt-in: só abre se vier via ?landing=1 (ex: link do perfil/settings).
  // Não é mais a entrada obrigatória do fluxo principal.
  useEffect(() => {
    if (!session || wazeUi) { setMapLandingOpen(false); return; }
    if (!router.isReady) return;
    if (router.query.landing === '1') {
      setMapLandingOpen(true);
    } else {
      setMapLandingOpen(false);
    }
  }, [session, wazeUi, router.isReady, router.query.landing]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(MAP_THEME_STORAGE_KEY);
      if (saved === 'claro') {
        setMapThemeId('padrao');
        window.localStorage.setItem(MAP_THEME_STORAGE_KEY, 'padrao');
        return;
      }
      if (saved && MAP_THEMES.some((t) => t.id === saved)) setMapThemeId(saved);
    }
  }, []);

  const wazeThemeAppliedRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || router.query.waze !== '1' || wazeThemeAppliedRef.current) return;
    wazeThemeAppliedRef.current = true;
    setMapThemeId('waze');
  }, [router.isReady, router.query.waze]);

  useEffect(() => {
    if (router.query.shared === '1') {
      setShowSharedBanner(true);
      const t = setTimeout(() => setShowSharedBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [router.query.shared]);

  const handleSelectMapTheme = (id) => {
    setMapThemeId(id);
    if (typeof window !== 'undefined') window.localStorage.setItem(MAP_THEME_STORAGE_KEY, id);
    setShowMenuSheet(false);
  };

  const handleDetailOpenChange = useCallback((open) => {
    setIsDetailOpen(Boolean(open));
  }, []);
  const handleDetailExpandedChange = useCallback((expanded) => {
    setIsDetailExpanded(Boolean(expanded));
  }, []);

  useEffect(() => {
    let t;
    if (isDetailOpen) {
      // Aguarda 1 frame para a abertura do sheet começar e só então oculta os chips.
      t = window.setTimeout(() => setChipsShouldHide(true), 40);
    } else {
      setChipsShouldHide(false);
    }
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [isDetailOpen]);

  const removePlanningItem = useCallback((item) => {
    setSearchQuery((prev) => {
      const parts = String(prev || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((x) => x !== item);
      return parts.join(', ');
    });
  }, []);

  const planningIntelPeek = useMemo(() => {
    if (!planningSummary) {
      return {
        headline: 'A calcular a melhor opção para a sua lista…',
        sub: null,
        savingsLine: null,
      };
    }
    const one = planningSummary.oneStore;
    const cheap = planningSummary.cheapest;
    const ic = planningSummary.itemsCount || 0;
    if (one?.storeName) {
      const pct = one.coveragePct ?? Math.round((one.coveredItems / Math.max(ic, 1)) * 100);
      let savingsLine = null;
      if (cheap?.total != null && one.total != null && cheap.total < one.total - 0.05) {
        savingsLine = `Economize até R$ ${formatCurrencyBRL(one.total - cheap.total)} com rota em ${
          cheap.storesCount || 1
        } mercado(s)`;
      }
      return {
        headline: `Melhor opção combinada: ${one.storeName}`,
        sub: `R$ ${formatCurrencyBRL(one.total)} · ${pct}% da lista`,
        savingsLine,
      };
    }
    if (cheap?.total != null) {
      return {
        headline: 'Menor preço total (vários mercados)',
        sub: `R$ ${formatCurrencyBRL(cheap.total)}`,
        savingsLine: null,
      };
    }
    return {
      headline: 'Poucos preços na área visível',
      sub: 'Arraste o mapa ou aproxime para ver mais lojas',
      savingsLine: null,
    };
  }, [planningSummary]);

  const planningBottomPadPx =
    session && !showMapLanding && planningMode && !isDetailExpanded
      ? planningIntelExpanded
        ? 320
        : 168
      : 0;

  useEffect(() => {
    if (!planningMode) {
      setPlanningIntelExpanded(false);
      setPlanningListaSheetOpen(false);
    }
  }, [planningMode]);

  const characterSignals = useMemo(
    () => ({
      context: 'map',
      loading: gamificationLoading,
      streakCurrent: gamification?.streak_current ?? 0,
    }),
    [gamificationLoading, gamification?.streak_current]
  );

  const mapTutorUserId =
    session?.user?.supabaseId || session?.user?.email || null;
  const forceCacaPrecoJourney = router.isReady && shouldForceCacaPrecoJourney(router.query);
  const cacaPrecoJourneyDone =
    mapTutorUserId && !forceCacaPrecoJourney && isCacaPrecoJourneyDoneLocal(mapTutorUserId);
  const showCacaPrecoJourney = Boolean(
    session && !showMapLanding && !wazeUi && (!cacaPrecoJourneyDone || forceCacaPrecoJourney)
  );
  const showMapOnboardingTutor = Boolean(
    session && !showMapLanding && !isDetailOpen && !wazeUi && !showCacaPrecoJourney
  );

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>
      <div
        className={`finmemory-map-google-chrome fixed inset-0 z-40 w-full h-full ${showMapLanding ? 'bg-[#0f0f0f]' : 'bg-[#e8e4de]'}`}
      >
        {!showMapLanding ? (
          <div className="absolute inset-0 w-full h-full">
            <MapaPrecos
              mapThemeId={mapThemeId}
              searchQuery={debouncedSearch}
              promoOnly={promoOnly}
              wazeUi={wazeUi}
              planningMode={planningMode}
              planningItems={parsedPlanningItems}
              onPlanningSummaryChange={setPlanningSummary}
              planningActionRequest={planningActionRequest}
              headerOffsetPx={mapPaddingTopPx}
              overlayTopPx={mapOverlayTopPx}
              planningBottomPadPx={planningBottomPadPx}
              onDetailOpenChange={handleDetailOpenChange}
              onDetailExpandedChange={handleDetailExpandedChange}
            />
          </div>
        ) : null}

        {showMapLanding ? (
          <div
            className="absolute inset-0 z-[60] flex flex-col bg-[#0f0f0f] px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-landing-title"
          >
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#39FF14]">
                FinMemory
              </p>
              <h2
                id="map-landing-title"
                className="mt-3 text-center text-[1.75rem] font-bold leading-tight tracking-tight text-white"
              >
                Como quer começar?
              </h2>
              <p className="mt-3 text-center text-sm leading-relaxed text-zinc-500">
                Escolha por onde começar — pode mudar depois pelo menu ou pelo mapa.
              </p>

              <div className="mt-10 flex flex-col gap-4">
                <Link
                  href="/add-receipt"
                  onClick={dismissMapLanding}
                  className="group flex min-h-[5.25rem] items-center gap-4 rounded-2xl border border-[#2ECC49]/35 bg-[#141414] px-5 py-4 no-underline shadow-[0_0_0_1px_rgba(46,204,73,0.12)] transition-colors hover:border-[#2ECC49]/55 hover:bg-[#181818]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2ECC49]/12 ring-1 ring-[#2ECC49]/25">
                    <Camera className="h-6 w-6 text-[#39FF14]" aria-hidden />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-base font-bold text-white">Escanear nota fiscal</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500 group-hover:text-zinc-400">
                      Organizar gastos e histórico a partir do código da nota.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/shopping-list"
                  onClick={dismissMapLanding}
                  className="group flex min-h-[5.25rem] items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#141414] px-5 py-4 no-underline transition-colors hover:border-[#2ECC49]/30 hover:bg-[#181818]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                    <ShoppingCart className="h-6 w-6 text-[#2ECC49]" aria-hidden />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-base font-bold text-white">Lista de compras</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500 group-hover:text-zinc-400">
                      Monte a lista e depois veja ofertas no mapa com um toque.
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={dismissMapLanding}
                  className="group flex min-h-[5.25rem] w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#141414] px-5 py-4 text-left transition-colors hover:border-[#2ECC49]/30 hover:bg-[#181818]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2ECC49]/10 ring-1 ring-[#2ECC49]/20">
                    <Map className="h-6 w-6 text-[#39FF14]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white">Ver o mapa de preços</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500 group-hover:text-zinc-400">
                      Explorar ofertas e mercados perto de si — direto no radar.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSharedBanner && (
          <div
            className="absolute left-4 right-4 z-30 bg-[#2ECC49] text-white px-4 py-2.5 rounded-xl text-center text-sm font-medium shadow-lg"
            style={{ top: mapOverlayTopPx + 8 }}
          >
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {session && !showMapLanding ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-stretch pt-[max(8px,env(safe-area-inset-top))] px-3"
            aria-label="Controles do mapa"
          >
            <div
              className={`flex w-full max-w-full flex-col gap-2 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex-row md:items-center md:gap-2 ${
                isDetailExpanded ? 'pointer-events-none -translate-y-2 opacity-0' : 'pointer-events-auto translate-y-0 opacity-100'
              }`}
              aria-hidden={isDetailExpanded}
            >
              <button
                type="button"
                onClick={() => setShowMenuSheet(true)}
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#3c4043] shadow-[0_1px_3px_rgba(60,64,67,0.25)] transition-colors hover:bg-[#f8f9fa] md:inline-flex"
                aria-label={wazeUi ? MAP_ARIA.plannerMenuWaze : MAP_ARIA.plannerMenu}
                title={wazeUi ? 'Waze dos preços' : undefined}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 w-full flex-1 md:w-auto md:max-w-[min(380px,42vw)]">
                <div className="flex w-full items-stretch overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-[0_1px_3px_rgba(60,64,67,0.18)] focus-within:ring-2 focus-within:ring-primary/35">
                  <button
                    type="button"
                    onClick={() => setShowMenuSheet(true)}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center border-r border-[#dadce0] bg-white text-[#3c4043] transition-colors hover:bg-[#f8f9fa] md:hidden"
                    aria-label={wazeUi ? MAP_ARIA.menuMobileWaze : 'Menu'}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <input
                    ref={searchInputRef}
                    type="search"
                    enterKeyHint="search"
                    placeholder={
                      planningMode
                        ? MAP_PLACEHOLDERS.planningList
                        : narrowScreen
                          ? MAP_PLACEHOLDERS.searchShort
                          : MAP_PLACEHOLDERS.searchLong
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setMapChipSelection('custom');
                    }}
                    className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-1 text-[15px] leading-snug text-[#202124] placeholder-[#70757a] focus:outline-none md:py-2.5 md:pl-3.5 md:text-sm"
                    aria-label={MAP_ARIA.searchMap}
                  />
                  <div className="flex shrink-0 items-center border-l border-[#dadce0] pr-1.5 pl-0">
                    <button
                      type="button"
                      onClick={() => searchInputRef.current?.focus()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#f1f3f4] md:h-9 md:w-9"
                      aria-label="Buscar"
                    >
                      <Search className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" strokeWidth={2} />
                    </button>
                    <div className="h-4 w-px shrink-0 bg-[#dadce0]" aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('finmemory-map-request-location'));
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 md:h-9 md:w-9"
                      aria-label={MAP_ARIA.locateMe}
                      title={MAP_ARIA.locateMe}
                    >
                      <Navigation className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`min-w-0 w-full md:flex-1 transition-all ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  chipsShouldHide
                    ? 'pointer-events-none max-h-0 -translate-y-1 overflow-hidden opacity-0'
                    : 'max-h-24 translate-y-0 opacity-100'
                } ${narrowScreen ? 'duration-200' : 'duration-300'}`}
                aria-hidden={chipsShouldHide}
              >
                <MapOverlayCategoryChips
                  mapsMobileLayout={narrowScreen}
                  promoOnly={promoOnly}
                  setPromoOnly={setPromoOnly}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  mapChipSelection={mapChipSelection}
                  setMapChipSelection={setMapChipSelection}
                />
              </div>

              {planningMode ? (
                <div className="pointer-events-auto flex w-full flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanningListaSheetOpen(true)}
                    className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-[11px] font-bold tracking-tight text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,0.12)] transition-colors hover:bg-[#f8f9fa]"
                  >
                    <span className="truncate">
                      [ {parsedPlanningItems.length}{' '}
                      {parsedPlanningItems.length === 1 ? 'item ativo' : 'itens ativos'} ▾ ]
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-[10px] font-bold text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,0.12)] transition-colors hover:bg-[#f8f9fa]"
                    title="Limpar lista do mapa"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Limpar
                  </button>
                </div>
              ) : null}

              {!isDetailExpanded ? (
                <div className="pointer-events-auto w-full">
                  <CharacterWidget signals={characterSignals} variant="map" />
                </div>
              ) : null}
            </div>
          </div>
        ) : !session ? (
          <header className="pointer-events-auto absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 sm:px-4 rounded-b-2xl border-b border-border bg-secondary/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
            <Link href="/" className="flex items-center gap-2 shrink-0 no-underline">
              <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="object-contain rounded-lg" />
              <span className="font-bold text-lg text-[#F0F4FF]">FinMemory</span>
            </Link>
            <span className="flex-1 text-xs text-[#8899AA] hidden sm:block">Planejador de compras em tempo real</span>
            <Link href="/login?callbackUrl=/mapa"
              className="min-h-[40px] py-2 px-4 rounded-full bg-primary text-[#0A0E1A] font-bold text-sm hover:bg-primary/90 transition-colors no-underline">
              Entrar
            </Link>
            <Link href="/dashboard"
              className="min-h-[40px] py-2 px-3 rounded-full border border-[#1E2A3A] bg-card text-[#F0F4FF] font-medium text-sm hover:bg-[#1E2A3A] transition-colors no-underline">
              Gastos
            </Link>
          </header>
        ) : null}

        <Sheet open={showMenuSheet && !showMapLanding} onOpenChange={setShowMenuSheet}>
          <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto bg-card border-[#1E2A3A] text-foreground">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-xl font-bold text-center text-foreground">FinMemory no mapa</SheetTitle>
              <p className="text-sm text-muted-foreground text-center">
                Compras e preços em tempo real — atalhos e aparência do mapa.
              </p>
            </SheetHeader>
            <div className="flex flex-col gap-2 mb-6">
              <Link href="/dashboard" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-[#1E2A3A] no-underline transition-colors">
                <ListChecks className="h-5 w-5 text-primary" />
                Gastos e análise
              </Link>
              <Link href="/mapa-quick-add" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm font-semibold text-sky-400 hover:bg-sky-500/10 no-underline transition-colors">
                <Zap className="h-5 w-5 text-sky-400" />
                Curadoria rápida (progresso ao vivo)
              </Link>
              <Link href="/admin/quick-add" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm font-semibold text-violet-400 hover:bg-violet-500/10 no-underline transition-colors">
                <Zap className="h-5 w-5 text-violet-400" />
                Quick Add (pipeline escuro)
              </Link>
              <Link href="/listas" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-[#1E2A3A] no-underline transition-colors">
                Listas salvas
              </Link>
              <Link href="/shopping-list" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-[#1E2A3A] no-underline transition-colors">
                Lista de compras compartilhada
              </Link>
              <Link href="/scan-product" onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 no-underline transition-colors">
                <ScanBarcode className="h-5 w-5 shrink-0" aria-hidden />
                Consultar preço (código de barras)
              </Link>
            </div>
            <p className="text-sm font-semibold text-foreground mb-3">Tema do mapa</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MAP_THEMES.map((theme) => (
                <button key={theme.id} type="button" onClick={() => handleSelectMapTheme(theme.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                    mapThemeId === theme.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-[#1E2A3A] bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="w-full h-14 rounded-xl shadow-inner" style={{ backgroundColor: theme.preview }} />
                  <span className="font-semibold text-sm text-foreground">{theme.name}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {session && !showMapLanding && planningMode && !isDetailExpanded ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-[22] px-3"
            style={{ bottom: 'calc(4.35rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              className={`pointer-events-auto mx-auto w-full max-w-lg overflow-hidden rounded-t-2xl border shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
                wazeUi
                  ? 'border-[#2a2d3a] bg-[#13161f]/95 text-[#f3f4f6]'
                  : 'border-white/10 bg-[#12141a]/94 text-foreground'
              }`}
            >
              <button
                type="button"
                onClick={() => setPlanningIntelExpanded((e) => !e)}
                className="flex w-full flex-col gap-1 border-b border-white/10 px-3 pb-2.5 pt-2 text-left"
              >
                <span className="mx-auto h-1 w-9 rounded-full bg-white/25" aria-hidden />
                <div className="flex items-start gap-2 pt-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-snug text-white">{planningIntelPeek.headline}</p>
                    {planningIntelPeek.sub ? (
                      <p className="mt-0.5 text-xs font-semibold text-primary">{planningIntelPeek.sub}</p>
                    ) : null}
                    {planningIntelPeek.savingsLine ? (
                      <p className="mt-1 text-[11px] leading-snug text-zinc-400">{planningIntelPeek.savingsLine}</p>
                    ) : null}
                  </div>
                  {planningIntelExpanded ? (
                    <ChevronUp className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                  ) : (
                    <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                  )}
                </div>
              </button>

              <div className="flex items-center justify-center gap-2 border-b border-white/5 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'money' }))
                  }
                  disabled={!planningSummary?.cheapest}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-emerald-400 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Foco economia — ver rota no mapa"
                  aria-label="Foco economia"
                >
                  <Wallet className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'time' }))
                  }
                  disabled={!planningSummary?.oneStore}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-sky-400 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Foco tempo — maior cobertura em um mercado"
                  aria-label="Foco tempo"
                >
                  <Route className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'quality' }))
                  }
                  disabled={!planningSummary?.quality}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-violet-400 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Foco qualidade — itens diferenciados"
                  aria-label="Foco qualidade"
                >
                  <Sparkles className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {planningIntelExpanded ? (
                <div className="max-h-[48vh] space-y-2 overflow-y-auto px-3 pb-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'money' }))
                    }
                    disabled={!planningSummary?.cheapest}
                    className={`w-full rounded-xl border px-3 py-3 text-left ${
                      wazeUi ? 'border-[#2a2d3a] bg-[#0c0f16]' : 'border-white/10 bg-black/30'
                    } ${planningSummary?.cheapest ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      <p className="text-xs font-bold text-white">Economia (melhor combinação)</p>
                      {planningSummary?.cheapest?.badge ? (
                        <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          {planningSummary.cheapest.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">
                      Menor preço total:{' '}
                      {planningSummary?.cheapest
                        ? `R$ ${formatCurrencyBRL(planningSummary.cheapest.total)}`
                        : 'calculando...'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {planningSummary?.cheapest
                        ? `${planningSummary.cheapest.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.cheapest.storesCount} mercado(s).`
                        : 'Buscando melhor combinação por item...'}
                    </p>
                    {planningSummary?.cheapest?.actionLabel ? (
                      <p className="mt-1 text-[10px] font-medium text-emerald-300">{planningSummary.cheapest.actionLabel}</p>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'time' }))
                    }
                    disabled={!planningSummary?.oneStore}
                    className={`w-full rounded-xl border px-3 py-3 text-left ${
                      wazeUi ? 'border-[#2a2d3a] bg-[#0c0f16]' : 'border-white/10 bg-black/30'
                    } ${planningSummary?.oneStore ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-sky-400" />
                      <p className="text-xs font-bold text-white">Cobertura (um mercado)</p>
                      {planningSummary?.oneStore?.badge ? (
                        <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                          {planningSummary.oneStore.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">
                      Tudo em 1 lugar:{' '}
                      {planningSummary?.oneStore
                        ? `R$ ${formatCurrencyBRL(planningSummary.oneStore.total)}`
                        : 'calculando...'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {planningSummary?.oneStore
                        ? `${planningSummary.oneStore.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.oneStore.storeName}.`
                        : 'Buscando loja com maior cobertura da sua lista...'}
                    </p>
                    {planningSummary?.oneStore ? (
                      <p className="mt-1 text-[10px] font-medium text-sky-300">
                        {planningSummary.oneStore.actionLabel}
                        {planningSummary.oneStore.distanceMeters != null
                          ? ` • ${formatDistancePtBr(planningSummary.oneStore.distanceMeters)}`
                          : ''}
                        {planningSummary.oneStore.exclusivesCount > 0
                          ? ` • ${planningSummary.oneStore.exclusivesCount} item(ns) exclusivo(s)`
                          : ''}
                      </p>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'quality' }))
                    }
                    disabled={!planningSummary?.quality}
                    className={`w-full rounded-xl border px-3 py-3 text-left ${
                      wazeUi ? 'border-[#2a2d3a] bg-[#0c0f16]' : 'border-white/10 bg-black/30'
                    } ${planningSummary?.quality ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      <p className="text-xs font-bold text-white">Itens diferenciados</p>
                      {planningSummary?.quality?.badge ? (
                        <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                          {planningSummary.quality.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">
                      Curadoria premium:{' '}
                      {planningSummary?.quality ? `R$ ${formatCurrencyBRL(planningSummary.quality.total)}` : 'calculando...'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {planningSummary?.quality
                        ? `${planningSummary.quality.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.quality.storeName}.`
                        : 'Buscando melhor loja para itens diferenciados...'}
                    </p>
                    {planningSummary?.quality ? (
                      <p className="mt-1 text-[10px] font-medium text-violet-300">
                        {planningSummary.quality.actionLabel}
                        {planningSummary.quality.distanceMeters != null
                          ? ` • ${formatDistancePtBr(planningSummary.quality.distanceMeters)}`
                          : ''}
                        {planningSummary.quality.exclusivesCount > 0
                          ? ` • ${planningSummary.quality.exclusivesCount} item(ns) exclusivo(s)`
                          : ''}
                      </p>
                    ) : null}
                  </button>

                  <div
                    className={`rounded-xl border px-3 py-2 text-[11px] ${
                      wazeUi ? 'border-[#2a2d3a] bg-[#0c0f16] text-[#d1d5db]' : 'border-white/10 bg-black/25 text-zinc-300'
                    }`}
                    style={
                      wazeUi
                        ? undefined
                        : {
                            borderColor: BRAND.primarySoftBorder,
                            background: 'rgba(0,0,0,0.2)',
                            color: BRAND.primaryText,
                          }
                    }
                  >
                    <FinancePlansInline
                      className="m-0"
                      emphasize
                      showLink
                      linkClassName="font-semibold text-primary no-underline hover:underline"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <Sheet open={planningListaSheetOpen && !showMapLanding} onOpenChange={setPlanningListaSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] overflow-y-auto rounded-t-3xl border-[#1E2A3A] bg-card px-5 pb-8 pt-4 text-foreground"
          >
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="text-lg font-bold">Itens ativos no mapa</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Remova itens tocando no X ou edite tudo na barra de busca no topo.
              </p>
            </SheetHeader>
            <div className="flex flex-wrap gap-2">
              {parsedPlanningItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removePlanningItem(item)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    aria-label={`Remover ${item}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setPlanningListaSheetOpen(false);
                searchInputRef.current?.focus();
              }}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Editar na barra de busca
            </button>
          </SheetContent>
        </Sheet>

        {/* Botão flutuante: estados bloqueados */}
        {session && !showMapLanding && (
          <button
            type="button"
            onClick={() => setShowStatesPanel(true)}
            className={`absolute right-3 z-30 flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-[12px] font-bold text-[#202124] shadow-[0_1px_3px_rgba(60,64,67,0.2)] transition-colors hover:bg-[#f8f9fa] pointer-events-auto ${
              planningMode && !isDetailExpanded ? 'bottom-[calc(11.5rem+env(safe-area-inset-bottom))]' : 'bottom-[5.5rem]'
            }`}
            aria-label="Ver estados desbloqueados"
          >
            <span>🗺️</span>
            <span>Estados</span>
            <span className="text-[10px] font-black text-amber-500">SP ✅</span>
          </button>
        )}

        <StatesUnlockPanel open={showStatesPanel} onClose={() => setShowStatesPanel(false)} />

        <CacaPrecoJourney
          userId={mapTutorUserId}
          userName={session?.user?.name}
          enabled={showCacaPrecoJourney}
        />

        <MapOnboardingTutor
          userId={mapTutorUserId}
          userName={session?.user?.name}
          enabled={showMapOnboardingTutor}
        />

      </div>
    </>
  );
}
