'use client';

import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const LeafletMap = dynamic(() => import('./MapaPrecosLeaflet'), { ssr: false });

export default function MapaPrecos() {
  return (
    <div className="fixed inset-0 w-full h-full z-0">
      <LeafletMap />
    </div>
  );
}
