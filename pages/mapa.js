import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import Image from 'next/image';
import { Search, PlusCircle, Menu, ListChecks, Navigation, Zap } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { MAP_THEMES, MAP_THEME_STORAGE_KEY } from '../lib/colors';
import { useMatchMedia } from '../lib/useMatchMedia';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { MapOverlayCategoryChips } from '../components/map/MapOverlayCategoryChips';

const MapaPrecos = dynamic(() => import('../components/MapaPrecos'), { ssr: false });

/** Mapa em tela cheia; UI flutuante — só para alinhar GPS/carrinho no Leaflet. */
const MAP_MAP_PADDING_TOP_PX = 0;
/** Altura aproximada da faixa flutuante (safe area + barra pesquisa + fila de chips — mobile em 2 linhas). */
const MAP_OVERLAY_TOP_LOGGED_PX = 132;
const MAP_OVERLAY_TOP_GUEST_PX = 56;

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
  const searchInputRef = useRef(null);
  const narrowScreen = useMatchMedia('(max-width: 767px)');

  const wazeUi = router.isReady && router.query.waze === '1';
  const mapPaddingTopPx = MAP_MAP_PADDING_TOP_PX;
  const mapOverlayTopPx = session ? MAP_OVERLAY_TOP_LOGGED_PX : MAP_OVERLAY_TOP_GUEST_PX;

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

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>
      <div className="fixed inset-0 w-full h-full bg-[#e8e4de]">
        <div className="absolute inset-0 w-full h-full">
          <MapaPrecos
            mapThemeId={mapThemeId}
            searchQuery={debouncedSearch}
            promoOnly={promoOnly}
            wazeUi={wazeUi}
            headerOffsetPx={mapPaddingTopPx}
            overlayTopPx={mapOverlayTopPx}
          />
        </div>

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
            <div className="pointer-events-auto flex w-full max-w-full flex-col gap-2 md:flex-row md:items-center md:gap-2">
              <button
                type="button"
                onClick={() => setShowMenuSheet(true)}
                className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(60,64,67,0.28)] transition-colors md:inline-flex ${
                  wazeUi
                    ? 'bg-[#303134] text-[#e5e5e5] shadow-black/40 hover:bg-[#3c4043]'
                    : 'border border-[#dadce0] bg-white text-gray-800 hover:bg-gray-50'
                }`}
                aria-label={wazeUi ? 'Menu do planejador (modo Waze dos preços)' : 'Menu do planejador de compras'}
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
                    aria-label={wazeUi ? 'Menu (Waze dos preços)' : 'Menu'}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <input
                    ref={searchInputRef}
                    type="search"
                    enterKeyHint="search"
                    placeholder={narrowScreen ? 'Pesquise aqui' : 'Pesquise produtos, lojas ou região'}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setMapChipSelection('custom');
                    }}
                    className={`min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-1 text-[15px] leading-snug focus:outline-none md:py-2.5 md:pl-3.5 md:text-sm ${
                      wazeUi ? 'text-[#e8eaed] placeholder-[#9aa0a6]' : 'text-[#202124] placeholder-[#5f6368]'
                    }`}
                    aria-label="Pesquisar no mapa"
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
                      aria-label="Ir para a minha localização no mapa"
                      title="Minha localização"
                    >
                      <Navigation className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-w-0 w-full md:flex-1">
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
                href="/share-price"
                onClick={() => setShowMenuSheet(false)}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/80 no-underline"
              >
                <PlusCircle className="h-5 w-5 text-emerald-600" />
                Compartilhar preço
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

        <BottomNav />
      </div>
    </>
  );
}
