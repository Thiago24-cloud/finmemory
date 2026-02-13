'use client';

import dynamic from 'next/dynamic';

// Importar o componente do mapa sem SSR
const MapaPrecos = dynamic(
  () => import('@/components/MapaPrecos'),
  { ssr: false }
);

export default function HomePage() {
  return <MapaPrecos />;
}
