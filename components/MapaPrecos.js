'use client';

import dynamic from 'next/dynamic';

const PriceMap = dynamic(() => import('./PriceMap'), { ssr: false });

export default function MapaPrecos() {
  const mapboxToken =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      : '';

  if (!mapboxToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#e5e3df]">
        <div className="max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Mapa temporariamente indisponível</h2>
          <p className="text-gray-600 text-sm">
            Configure <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> no ambiente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-[#e5e3df]">
      <PriceMap mapboxToken={mapboxToken} />
    </div>
  );
}
