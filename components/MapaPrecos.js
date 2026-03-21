'use client';

import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const LeafletMap = dynamic(() => import('./MapaPrecosLeaflet'), { ssr: false });

export default function MapaPrecos({ mapThemeId = 'verde', searchQuery = '' }) {
  return (
    <div className="fixed inset-0 w-full h-full z-0">
      <LeafletMap mapThemeId={mapThemeId} searchQuery={searchQuery} />
    </div>
  );
}
