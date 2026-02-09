import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';

const PriceMap = dynamic(() => import('../components/PriceMap'), { ssr: false });

export async function getServerSideProps() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  return { props: { mapboxToken: token } };
}

export default function MapaPage({ mapboxToken }) {
  return (
    <>
      <Head>
        <title>Mapa de Preços | FinMemory</title>
      </Head>
      <div className="flex flex-col h-screen bg-[#f5f5f5]">
        {/* Barra superior mínima com voltar */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-20">
          <Link
            href="/dashboard"
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Mapa de Preços</h1>
        </header>

        {/* Área do mapa com busca flutuante */}
        <div className="flex-1 relative min-h-0 p-4 md:p-5">
          <div className="absolute inset-4 md:inset-5 rounded-xl overflow-hidden">
            <PriceMap mapboxToken={mapboxToken} />
          </div>
          {/* Busca flutuante – estilo Whoosh */}
          <div className="absolute top-6 left-4 right-4 md:left-8 md:right-8 z-10 max-w-xl mx-auto">
            <div className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100 pl-5 pr-4 py-2.5 focus-within:ring-2 focus-within:ring-[#2ECC49] focus-within:border-[#2ECC49] transition-shadow">
              <Search className="h-5 w-5 text-gray-400 shrink-0 mr-3" />
              <input
                type="text"
                placeholder="Buscar produto... (ex: Dipirona, Whey Protein)"
                className="flex-1 min-w-0 bg-transparent border-0 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 text-sm md:text-base"
              />
            </div>
          </div>
          <p className="absolute bottom-6 left-4 right-4 md:left-8 text-center text-xs text-gray-500 z-10 pointer-events-none">
            Preços compartilhados pela comunidade FinMemory
          </p>
        </div>
      </div>
    </>
  );
}
