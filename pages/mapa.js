import dynamic from 'next/dynamic';
import Head from 'next/head';

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
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="bg-white shadow-sm p-4 z-10">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-3">🗺️ Mapa de Preços</h1>
            <input
              type="text"
              placeholder="🔍 Buscar produto... (ex: Dipirona, Whey Protein)"
              className="w-full max-w-2xl px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-2">
              💡 Veja os preços compartilhados pela comunidade FinMemory em tempo real
            </p>
          </div>
        </div>

        <div className="flex-1 p-4 min-h-0">
          <div className="max-w-7xl mx-auto h-full">
            <PriceMap mapboxToken={mapboxToken} />
          </div>
        </div>
      </div>
    </>
  );
}
