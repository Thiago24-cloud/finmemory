'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const MapaPrecos = dynamic(() => import('@/components/MapaPrecos'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-gray-600">Carregando mapa...</p>
      </div>
    </div>
  ),
});

function parseCoord(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function MapaPrecosPublicInner() {
  const searchParams = useSearchParams();
  const lat = parseCoord(searchParams.get('lat'));
  const lng = parseCoord(searchParams.get('lng'));
  const zoom = parseCoord(searchParams.get('zoom'));

  const initialMapCenter = lat != null && lng != null ? [lat, lng] : null;

  return (
    <MapaPrecos
      initialMapCenter={initialMapCenter}
      initialMapZoom={zoom ?? undefined}
    />
  );
}

export default function MapaPrecosPublicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
            <p className="text-gray-600">Carregando mapa...</p>
          </div>
        </div>
      }
    >
      <MapaPrecosPublicInner />
    </Suspense>
  );
}
