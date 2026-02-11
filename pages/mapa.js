import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, ArrowLeft, PlusCircle } from 'lucide-react';

const PriceMap = dynamic(() => import('../components/PriceMap'), { ssr: false });

export async function getServerSideProps() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  return { props: { mapboxToken: token } };
}

export default function MapaPage({ mapboxToken }) {
  const router = useRouter();
  const [showSharedBanner, setShowSharedBanner] = useState(false);

  useEffect(() => {
    if (router.query.shared === '1') {
      setShowSharedBanner(true);
      const t = setTimeout(() => setShowSharedBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [router.query.shared]);

  return (
    <>
      <Head>
        <title>Mapa de Preços | FinMemory</title>
      </Head>
      <div className="flex flex-col h-screen bg-[#e5e3df]">
        {/* Banner de sucesso ao compartilhar */}
        {showSharedBanner && (
          <div className="bg-[#2ECC49] text-white px-4 py-2.5 text-center text-sm font-medium z-30 shrink-0">
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {/* Header: Voltar | Busca | Compartilhar preço */}
        <header className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/98 backdrop-blur-sm border-b border-gray-200 z-20 shrink-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] py-2 px-3 rounded-full hover:bg-gray-100 text-gray-700 transition-colors shrink-0 font-medium text-sm"
            aria-label="Voltar ao Dashboard"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span className="sm:hidden">Voltar</span>
          </Link>
          <div className="flex-1 flex items-center min-w-0">
            <div className="w-full max-w-xl flex items-center bg-gray-100 rounded-full border border-gray-200 pl-3 pr-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2ECC49] focus-within:border-[#2ECC49] transition-all">
              <Search className="h-4 w-4 text-gray-400 shrink-0 mr-2" />
              <input
                type="text"
                placeholder="Buscar produto..."
                className="flex-1 min-w-0 bg-transparent border-0 text-gray-800 placeholder-gray-500 focus:outline-none text-sm"
              />
            </div>
          </div>
          <Link
            href="/share-price"
            className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-[#2ECC49] text-white font-medium text-sm hover:bg-[#22a83a] transition-colors shrink-0"
            aria-label="Compartilhar preço no mapa"
          >
            <PlusCircle className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Compartilhar</span>
          </Link>
        </header>

        {/* Mapa */}
        <div className="flex-1 relative min-h-0 w-full">
          <div className="absolute inset-0 w-full h-full">
            <PriceMap mapboxToken={mapboxToken} />
          </div>
          <p className="absolute bottom-2 left-2 text-[10px] sm:text-xs text-gray-500/90 z-10 pointer-events-none drop-shadow-sm">
            Preços compartilhados pela comunidade FinMemory
          </p>
        </div>
      </div>
    </>
  );
}
