'use client';

import dynamic from 'next/dynamic';

const MapaPrecos = dynamic(
  () => import('@/components/MapaPrecos'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Carregando mapa...</p>
        </div>
      </div>
    )
  }
);

export default function Home() {
  return <MapaPrecos />;
}
