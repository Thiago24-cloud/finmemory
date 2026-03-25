import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import Image from 'next/image';
import { Search, ArrowLeft, PlusCircle, Map } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { MAP_THEMES, MAP_THEME_STORAGE_KEY, getMapThemeById } from '../lib/colors';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';

const MapaPrecos = dynamic(() => import('../components/MapaPrecos'), { ssr: false });

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
  const { data: session, status } = useSession();
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [showMapasSheet, setShowMapasSheet] = useState(false);
  const [mapThemeId, setMapThemeId] = useState('verde');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  /** Inicia mostrando só promoções — mapa “cheio de descontos”; o utilizador pode desligar para ver tudo. */
  const [promoOnly, setPromoOnly] = useState(true);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(MAP_THEME_STORAGE_KEY);
      if (saved && MAP_THEMES.some((t) => t.id === saved)) setMapThemeId(saved);
    }
  }, []);

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
    setShowMapasSheet(false);
  };

  const handleFocusSearch = () => {
    searchInputRef.current?.focus();
  };

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>
      {/* Mapa em tela cheia = primeira coisa que o usuário vê */}
      <div className="fixed inset-0 w-full h-full bg-[#e5e3df]">
        <div className="absolute inset-0 w-full h-full">
          <MapaPrecos mapThemeId={mapThemeId} searchQuery={debouncedSearch} promoOnly={promoOnly} />
        </div>

        {/* Banner de sucesso ao compartilhar */}
        {showSharedBanner && (
          <div className="absolute top-14 left-4 right-4 z-30 bg-[#2ECC49] text-white px-4 py-2.5 rounded-xl text-center text-sm font-medium shadow-lg">
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {/* Header flutuante sobre o mapa – minimalista */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] py-2 px-3 rounded-full hover:bg-gray-100 text-gray-700 transition-colors shrink-0 font-medium text-sm"
                aria-label="Análise de gastos"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
                <span className="sm:inline hidden">Gastos</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowMapasSheet(true)}
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] font-semibold text-sm transition-colors shrink-0 border border-[#2ECC49]/30"
                aria-label="Mapas – tons e estilos do mapa"
              >
                <Map className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">Mapas</span>
              </button>
              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none min-h-[44px] px-2 rounded-full bg-amber-50 border border-amber-200/80">
                <input
                  type="checkbox"
                  checked={promoOnly}
                  onChange={(e) => setPromoOnly(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  aria-label="Mostrar só promoções no mapa"
                />
                <span className="text-xs font-semibold text-amber-900 whitespace-nowrap hidden sm:inline">
                  Só promo
                </span>
              </label>
              <div className="flex-1 flex items-center min-w-0 max-w-[160px] sm:max-w-xs">
                <div className="w-full flex items-center bg-gray-100/90 rounded-full pl-3 pr-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2ECC49] transition-all">
                  <Search className="h-4 w-4 text-gray-400 shrink-0 mr-2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar produto (ex: arroz)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent border-0 text-gray-800 placeholder-gray-500 focus:outline-none text-sm"
                    aria-label="Buscar produto no mapa"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleFocusSearch}
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors shrink-0"
                aria-label="Onde comprar? Buscar produto no mapa"
              >
                <Search className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap hidden sm:inline">Onde comprar?</span>
              </button>
              <Link
                href="/share-price"
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-[#2ECC49] text-white font-medium text-sm hover:bg-[#22a83a] transition-colors shrink-0"
                aria-label="Compartilhar preço"
              >
                <PlusCircle className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap hidden sm:inline">Compartilhar</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2 shrink-0 no-underline text-[#333]">
                <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="object-contain rounded-lg" />
                <span className="font-bold text-lg">FinMemory</span>
              </Link>
              <span className="flex-1 text-xs text-gray-500 hidden sm:block">App de compras · Onde está mais barato?</span>
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/mapa' })}
                className="min-h-[40px] py-2 px-4 rounded-full bg-[#2ECC49] text-white font-semibold text-sm hover:bg-[#22a83a] transition-colors"
              >
                Entrar
              </button>
              <Link
                href="/dashboard"
                className="min-h-[40px] py-2 px-3 rounded-full border border-gray-300 bg-white/80 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Gastos
              </Link>
            </>
          )}
        </header>

        {/* Sheet: Mapas – pasta principal dos tons do mapa (Notion-like: clique e escolha o visual) */}
        <Sheet open={showMapasSheet} onOpenChange={setShowMapasSheet}>
          <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-xl font-bold text-center text-gray-900">
                Mapas
              </SheetTitle>
              <p className="text-sm text-gray-600 text-center">
                Tons do mapa – escolha o visual. Sua escolha fica salva para a próxima vez.
              </p>
            </SheetHeader>
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
                  <div
                    className="w-full h-14 rounded-xl shadow-inner"
                    style={{ backgroundColor: theme.preview }}
                  />
                  <span className="font-semibold text-sm text-gray-900">{theme.name}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Tagline: posicionamento compras → análise de custos */}
        <p className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-auto text-[10px] sm:text-xs text-white/95 z-10 pointer-events-none drop-shadow-md max-w-md">
          App de compras: preços e comunidade. Sua <Link href="/dashboard" className="underline pointer-events-auto hover:text-white">análise de custos</Link> em Gastos.
        </p>

        <BottomNav />
      </div>
    </>
  );
}
