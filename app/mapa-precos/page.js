'use client';

import dynamic from 'next/dynamic';

const MapaPrecos = dynamic(
  () => import('@/components/MapaPrecos'),
  { ssr: false }
);

export default function HomePage() {
  return <MapaPrecos />;
}
