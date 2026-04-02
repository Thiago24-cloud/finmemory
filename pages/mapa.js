import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import Image from 'next/image';
import { Search, PlusCircle, Menu, ListChecks } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { MAP_THEMES, MAP_THEME_STORAGE_KEY } from '../lib/colors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';

const MapaPrecos = dynamic(() => import('../components/MapaPrecos'), { ssr: false });

/** Altura reservada no mapa (padding-top) — cabeçalho em duas linhas estilo Maps. */
const MAP_HEADER_OFFSET_LOGGED_PX = 120;
const MAP_HEADER_OFFSET_GUEST_PX = 56;

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
  const [promoOnly, setPromoOnly] = useState(true);
  const searchInputRef = useRef(null);

  const wazeUi = router.isReady && router.query.waze === '1';
  const headerOffsetPx = session ? MAP_HEADER_OFFSET_LOGGED_PX : MAP_HEADER_OFFSET_GUEST_PX;

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

  const pillBase =
    'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border whitespace-nowrap';
  const pillInactive = wazeUi
    ? 'border-[#2a2d3a] bg-[#1a1d27] text-[#c5c5c5] hover:bg-[#252a38]'
    : 'border-gray-200/90 bg-white text-gray-700 hover:bg-gray-50 shadow-sm';
  const pillActive = wazeUi
    ? 'border-[#2ecc71] bg-[#1e2a22] text-[#2ecc71]'
    : 'border-[#2ECC49] bg-[#E8F5E9] text-[#1B5E20]';

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
            headerOffsetPx={headerOffsetPx}
          />
        </div>

        {showSharedBanner && (
          <div
            className="absolute left-4 right-4 z-30 bg-[#2ECC49] text-white px-4 py-2.5 rounded-xl text-center text-sm font-medium shadow-lg"
            style={{ top: headerOffsetPx + 8 }}
          >
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {session ? (
          <header
            className={`absolute top-0 left-0 right-0 z-20 flex flex-col border-b shadow-sm ${
              wazeUi
                ? 'border-[#1e2130] bg-[#13161f]/95 backdrop-blur-md'
                : 'border-gray-200/80 bg-white/95 backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 sm:px-4">
              <button
                type="button"
                onClick={() => setShowMenuSheet(true)}
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                  wazeUi ? 'hover:bg-[#1e2130] text-[#e5e5e5]' : 'hover:bg-gray-100 text-gray-800'
                }`}
                aria-label="Menu do planejador de compras"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div
                className={`min-w-0 flex-1 flex items-center rounded-full pl-3 pr-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border ${
                  wazeUi
                    ? 'bg-[#1e2130] border-[#2a2d3a] focus-within:ring-2 focus-within:ring-[#2ecc71]/40'
                    : 'bg-white border-gray-200/90 focus-within:ring-2 focus-within:ring-[#2ECC49]/35'
                }`}
              >
                <Search className={`h-4 w-4 shrink-0 mr-2 ${wazeUi ? 'text-[#888]' : 'text-gray-400'}`} />
                <input
                  ref={searchInputRef}
                  type="search"
                  enterKeyHint="search"
                  placeholder="Região (ex.: Grajaú) ou produto (ex.: arroz)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-sm ${
                    wazeUi ? 'text-[#f0f0f0] placeholder-[#666]' : 'text-gray-900 placeholder-gray-500'
                  }`}
                  aria-label="Buscar por região ou produto no mapa"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-3 pb-2.5 pt-0.5 sm:px-4">
              {wazeUi && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#2ecc71] pr-1">
                  Waze dos preços
                </span>
              )}
              <button
                type="button"
                onClick={() => setPromoOnly(true)}
                className={`${pillBase} ${promoOnly ? pillActive : pillInactive}`}
              >
                Promoções
              </button>
              <button
                type="button"
                onClick={() => {
                  setPromoOnly(false);
                }}
                className={`${pillBase} ${!promoOnly ? pillActive : pillInactive}`}
              >
                Ver tudo
              </button>
              {['Arroz', 'Leite', 'Café'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setSearchQuery(q);
                    searchInputRef.current?.focus();
                  }}
                  className={`${pillBase} ${pillInactive}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </header>
        ) : (
          <header
            className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 sm:px-4 border-b shadow-sm ${
              wazeUi
                ? 'border-[#1e2130] bg-[#13161f]/95 backdrop-blur-md'
                : 'border-gray-200/80 bg-white/90 backdrop-blur-md'
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
