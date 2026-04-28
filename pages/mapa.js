import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
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
  Wallet,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { MAP_THEMES, MAP_THEME_STORAGE_KEY } from '../lib/colors';
import { useMatchMedia } from '../lib/useMatchMedia';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { MapOverlayCategoryChips } from '../components/map/MapOverlayCategoryChips';
import { FinancePlansInline } from '../components/FinancePlansInline';
import { BRAND } from '../lib/brandTokens';
import { MAP_ARIA, MAP_PLACEHOLDERS } from '../lib/appMicrocopy';

const MapaPrecos = dynamic(() => import('../components/MapaPrecos'), { ssr: false });

/** Mapa em tela cheia; UI flutuante — só para alinhar GPS/carrinho no Leaflet. */
const MAP_MAP_PADDING_TOP_PX = 0;
/** Altura aproximada da faixa flutuante (safe area + barra pesquisa + fila de chips — mobile em 2 linhas). */
const MAP_OVERLAY_TOP_LOGGED_PX = 132;
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
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
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
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
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

  const wazeUi = router.isReady && router.query.waze === '1';
  const mapPaddingTopPx = MAP_MAP_PADDING_TOP_PX;
  const mapOverlayTopPx = session ? MAP_OVERLAY_TOP_LOGGED_PX : MAP_OVERLAY_TOP_GUEST_PX;

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

  /** Landing em cima do mapa: nota fiscal vs lista — não faz parte da barra de pesquisa. */
  const [mapLandingOpen, setMapLandingOpen] = useState(false);
  const dismissMapLanding = useCallback(() => {
    try {
      sessionStorage.setItem('finmemory_map_landing_dismissed', '1');
    } catch {
      /* ignore */
    }
    setMapLandingOpen(false);
  }, []);

  useEffect(() => {
    if (!session || wazeUi) {
      setMapLandingOpen(false);
      return;
    }
    if (!router.isReady) return;
    if (router.query.lista) {
      setMapLandingOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem('finmemory_map_landing_dismissed') === '1') {
        setMapLandingOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    if (searchQuery.trim().length > 0 || planningMode) {
      setMapLandingOpen(false);
      return;
    }
    setMapLandingOpen(true);
  }, [session, wazeUi, router.isReady, router.query.lista, searchQuery, planningMode]);

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

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>
      <div className="fixed inset-0 z-40 w-full h-full bg-[#e8e4de]">
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
            onDetailOpenChange={handleDetailOpenChange}
            onDetailExpandedChange={handleDetailExpandedChange}
          />
        </div>

        {session && mapLandingOpen && !wazeUi ? (
          <div
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/50 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-landing-title"
          >
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#2ECC49]">
                FinMemory
              </p>
              <h2 id="map-landing-title" className="mt-1 text-center text-xl font-bold text-gray-900">
                Como quer começar?
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">
                Isto fica por cima do mapa só para escolher o fluxo. O mapa de preços continua atrás.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/add-receipt"
                  onClick={dismissMapLanding}
                  className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-emerald-200 bg-[#eefbf1] px-4 py-3 no-underline transition-colors hover:bg-[#e3f7e9]"
                >
                  <Camera className="h-6 w-6 shrink-0 text-[#106b2a]" aria-hidden />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[#106b2a]">Escanear nota fiscal</p>
                    <p className="text-xs text-[#357a46]">Já comprei — organizar gastos e histórico.</p>
                  </div>
                </Link>
                <Link
                  href="/shopping-list"
                  onClick={dismissMapLanding}
                  className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-sky-200 bg-[#eef4ff] px-4 py-3 no-underline transition-colors hover:bg-[#e4edff]"
                >
                  <ShoppingCart className="h-6 w-6 shrink-0 text-[#0f3e9c]" aria-hidden />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[#0f3e9c]">Lista de compras</p>
                    <p className="text-xs text-[#37517f]">Montar o que falta — fotos do catálogo e depois ver no mapa.</p>
                  </div>
                </Link>
              </div>
              <button
                type="button"
                onClick={dismissMapLanding}
                className="mt-5 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Só quero ver o mapa de preços
              </button>
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

        {session ? (
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
                className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(60,64,67,0.28)] transition-colors md:inline-flex ${
                  wazeUi
                    ? 'bg-[#303134] text-[#e5e5e5] shadow-black/40 hover:bg-[#3c4043]'
                    : 'border border-[#dadce0] bg-white text-gray-800 hover:bg-gray-50'
                }`}
                aria-label={wazeUi ? MAP_ARIA.plannerMenuWaze : MAP_ARIA.plannerMenu}
                title={wazeUi ? 'Waze dos preços' : undefined}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 w-full flex-1 md:w-auto md:max-w-[min(380px,42vw)]">
                <div
                  className={`flex w-full items-stretch overflow-hidden rounded-2xl ${
                    wazeUi
                      ? 'bg-[#303134] shadow-[0_2px_8px_rgba(0,0,0,0.45)] focus-within:ring-2 focus-within:ring-[#2ecc71]/35'
                      : 'border border-[#dadce0] bg-white shadow-[0_2px_8px_rgba(60,64,67,0.12)] focus-within:ring-2 focus-within:ring-[#1a73e8]/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setShowMenuSheet(true)}
                    className={`inline-flex h-12 w-12 shrink-0 items-center justify-center border-r transition-colors md:hidden ${
                      wazeUi
                        ? 'border-[#5f6368]/55 bg-[#303134] text-[#e8eaed] hover:bg-[#3c4043]'
                        : 'border-gray-200/90 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
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
                    className={`min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-1 text-[15px] leading-snug focus:outline-none md:py-2.5 md:pl-3.5 md:text-sm ${
                      wazeUi ? 'text-[#e8eaed] placeholder-[#9aa0a6]' : 'text-[#202124] placeholder-[#5f6368]'
                    }`}
                    aria-label={MAP_ARIA.searchMap}
                  />
                  <div
                    className={`flex shrink-0 items-center pr-1.5 pl-0 ${
                      wazeUi ? 'border-l border-[#5f6368]/50' : 'border-l border-gray-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => searchInputRef.current?.focus()}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors md:h-9 md:w-9 ${
                        wazeUi ? 'text-[#9aa0a6] hover:bg-[#3c4043]' : 'text-[#5f6368] hover:bg-gray-100'
                      }`}
                      aria-label="Buscar"
                    >
                      <Search className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" strokeWidth={2} />
                    </button>
                    <div className={`h-4 w-px shrink-0 ${wazeUi ? 'bg-[#5f6368]' : 'bg-gray-300'}`} aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('finmemory-map-request-location'));
                        }
                      }}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors md:h-9 md:w-9 ${
                        wazeUi ? 'text-[#8ab4f8] hover:bg-[#3c4043]' : 'text-[#1a73e8] hover:bg-[#f1f3f4]'
                      }`}
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
                  wazeUi={wazeUi}
                  mapsMobileLayout={!wazeUi && narrowScreen}
                  promoOnly={promoOnly}
                  setPromoOnly={setPromoOnly}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  mapChipSelection={mapChipSelection}
                  setMapChipSelection={setMapChipSelection}
                />
              </div>

              {planningMode ? (
                <div
                  className={`pointer-events-auto w-full rounded-2xl border px-3 py-2.5 ${
                    wazeUi
                      ? 'border-[#2a2d3a] bg-[#13161f]/95 text-[#e5e7eb]'
                      : 'border-gray-200 bg-white/95 text-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">Radar da Lista ativo</p>
                      <p className={`truncate text-[10px] ${wazeUi ? 'text-[#9ca3af]' : 'text-gray-500'}`}>
                        Mostrando prioridades para {parsedPlanningItems.length} item(ns).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        wazeUi ? 'bg-[#222634] text-[#d1d5db]' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {parsedPlanningItems.map((item) => (
                      <span
                        key={item}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          wazeUi ? 'bg-[#222634] text-[#d1d5db]' : 'bg-[#f3f4f6] text-gray-700'
                        }`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <header
            className={`pointer-events-auto absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 sm:px-4 rounded-b-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${
              wazeUi
                ? 'border-b border-[#1e2130] bg-[#13161f]/92 backdrop-blur-md'
                : 'border-b border-gray-200/80 bg-white/92 backdrop-blur-md'
            }`}
          >
            <Link href="/" className="flex items-center gap-2 shrink-0 no-underline text-[#333]">
              <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="object-contain rounded-lg" />
              <span className="font-bold text-lg">FinMemory</span>
            </Link>
            <span className="flex-1 text-xs text-gray-500 hidden sm:block">Planejador de compras em tempo real</span>
            <Link
              href="/login?callbackUrl=/mapa"
              className="min-h-[40px] py-2 px-4 rounded-full bg-[#2ECC49] text-white font-semibold text-sm hover:bg-[#22a83a] transition-colors no-underline"
            >
              Entrar
            </Link>
            <Link
              href="/dashboard"
              className="min-h-[40px] py-2 px-3 rounded-full border border-gray-300 bg-white/80 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Gastos
            </Link>
          </header>
        )}

        <Sheet open={showMenuSheet} onOpenChange={setShowMenuSheet}>
          <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-xl font-bold text-center text-gray-900">FinMemory no mapa</SheetTitle>
              <p className="text-sm text-gray-600 text-center">
                Compras e preços em tempo real — atalhos e aparência do mapa.
              </p>
            </SheetHeader>
            <div className="flex flex-col gap-2 mb-6">
              <Link
                href="/dashboard"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 no-underline"
              >
                <ListChecks className="h-5 w-5 text-[#2ECC49]" />
                Gastos e análise
              </Link>
              <Link
                href="/mapa-quick-add"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm font-semibold text-sky-900 hover:bg-sky-100/80 no-underline"
              >
                <Zap className="h-5 w-5 text-sky-600" />
                Curadoria rápida (progresso ao vivo)
              </Link>
              <Link
                href="/admin/quick-add"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm font-semibold text-violet-900 hover:bg-violet-100/80 no-underline"
              >
                <Zap className="h-5 w-5 text-violet-600" />
                Quick Add (pipeline escuro)
              </Link>
              <Link
                href="/listas"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 no-underline"
              >
                Listas salvas
              </Link>
              <Link
                href="/shopping-list"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 no-underline"
              >
                Lista de compras compartilhada
              </Link>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-3">Tema do mapa</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MAP_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelectMapTheme(theme.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                    mapThemeId === theme.id
                      ? 'border-[#2ECC49] bg-[#E8F5E9] text-gray-900 ring-2 ring-[#2ECC49]/30'
                      : 'border-gray-200 bg-white hover:border-[#2ECC49]/50 hover:bg-[#f0fdf4]'
                  }`}
                >
                  <div className="w-full h-14 rounded-xl shadow-inner" style={{ backgroundColor: theme.preview }} />
                  <span className="font-semibold text-sm text-gray-900">{theme.name}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {session && planningMode && !isDetailExpanded ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-[18] px-3 pb-[calc(68px+env(safe-area-inset-bottom))]"
            style={{ bottom: 0 }}
          >
            <div className="pointer-events-auto mx-auto grid w-full max-w-[760px] grid-cols-1 gap-2 md:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'money' }))
                }
                disabled={!planningSummary?.cheapest}
                className={`rounded-2xl border px-3 py-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${
                  wazeUi
                    ? 'border-[#2a2d3a] bg-[#13161f] text-[#f3f4f6]'
                    : 'border-gray-200 bg-white text-gray-900'
                } ${planningSummary?.cheapest ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-bold">Foco Dinheiro</p>
                  {planningSummary?.cheapest?.badge ? (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        wazeUi ? 'bg-[#1f2937] text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {planningSummary.cheapest.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold">
                  Menor preço total:{' '}
                  {planningSummary?.cheapest
                    ? `R$ ${formatCurrencyBRL(planningSummary.cheapest.total)}`
                    : 'calculando...'}
                </p>
                <p className={`mt-0.5 text-[10px] ${wazeUi ? 'text-[#9ca3af]' : 'text-gray-500'}`}>
                  {planningSummary?.cheapest
                    ? `${planningSummary.cheapest.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.cheapest.storesCount} mercado(s).`
                    : 'Buscando melhor combinação por item...'}
                </p>
                {planningSummary?.cheapest?.actionLabel ? (
                  <p className={`mt-1 text-[10px] font-medium ${wazeUi ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {planningSummary.cheapest.actionLabel}
                  </p>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() =>
                  setPlanningActionRequest((prev) => ({ id: Number(prev.id || 0) + 1, mode: 'time' }))
                }
                disabled={!planningSummary?.oneStore}
                className={`rounded-2xl border px-3 py-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${
                  wazeUi
                    ? 'border-[#2a2d3a] bg-[#13161f] text-[#f3f4f6]'
                    : 'border-gray-200 bg-white text-gray-900'
                } ${planningSummary?.oneStore ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
              >
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-sky-500" />
                  <p className="text-xs font-bold">Foco Tempo</p>
                  {planningSummary?.oneStore?.badge ? (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        wazeUi ? 'bg-[#1f2937] text-sky-300' : 'bg-sky-50 text-sky-700'
                      }`}
                    >
                      {planningSummary.oneStore.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold">
                  Tudo em 1 lugar:{' '}
                  {planningSummary?.oneStore
                    ? `R$ ${formatCurrencyBRL(planningSummary.oneStore.total)}`
                    : 'calculando...'}
                </p>
                <p className={`mt-0.5 text-[10px] ${wazeUi ? 'text-[#9ca3af]' : 'text-gray-500'}`}>
                  {planningSummary?.oneStore
                    ? `${planningSummary.oneStore.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.oneStore.storeName}.`
                    : 'Buscando loja com maior cobertura da sua lista...'}
                </p>
                {planningSummary?.oneStore ? (
                  <p className={`mt-1 text-[10px] font-medium ${wazeUi ? 'text-sky-300' : 'text-sky-700'}`}>
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
                className={`rounded-2xl border px-3 py-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${
                  wazeUi
                    ? 'border-[#2a2d3a] bg-[#13161f] text-[#f3f4f6]'
                    : 'border-gray-200 bg-white text-gray-900'
                } ${planningSummary?.quality ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <p className="text-xs font-bold">Foco Qualidade</p>
                  {planningSummary?.quality?.badge ? (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        wazeUi ? 'bg-[#1f2937] text-violet-300' : 'bg-violet-50 text-violet-700'
                      }`}
                    >
                      {planningSummary.quality.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold">
                  Curadoria premium:{' '}
                  {planningSummary?.quality ? `R$ ${formatCurrencyBRL(planningSummary.quality.total)}` : 'calculando...'}
                </p>
                <p className={`mt-0.5 text-[10px] ${wazeUi ? 'text-[#9ca3af]' : 'text-gray-500'}`}>
                  {planningSummary?.quality
                    ? `${planningSummary.quality.coveredItems}/${planningSummary.itemsCount} itens em ${planningSummary.quality.storeName}.`
                    : 'Buscando melhor loja para itens diferenciados...'}
                </p>
                {planningSummary?.quality ? (
                  <p className={`mt-1 text-[10px] font-medium ${wazeUi ? 'text-violet-300' : 'text-violet-700'}`}>
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
            </div>
            <div
              className={`pointer-events-auto mx-auto mt-2 w-full max-w-[760px] rounded-2xl border px-3 py-2 text-[11px] ${
                wazeUi ? 'border-[#2a2d3a] bg-[#13161f] text-[#d1d5db]' : 'border-gray-200 bg-white text-gray-700'
              }`}
              style={
                wazeUi
                  ? undefined
                  : {
                      borderColor: BRAND.primarySoftBorder,
                      background: BRAND.primarySoftBg,
                      color: BRAND.primaryText,
                    }
              }
            >
              <FinancePlansInline
                className="m-0"
                emphasize
                showLink
                linkClassName="font-semibold text-[#2ECC49] no-underline hover:underline"
              />
            </div>
          </div>
        ) : null}

        <BottomNav />
      </div>
    </>
  );
}
