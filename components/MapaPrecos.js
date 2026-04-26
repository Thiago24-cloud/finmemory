'use client';

import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const LeafletMap = dynamic(() => import('./MapaPrecosLeaflet'), { ssr: false });

export default function MapaPrecos({
  mapThemeId = 'padrao',
  searchQuery = '',
  promoOnly = false,
  wazeUi = false,
  headerOffsetPx = 120,
  /** Quando o mapa vai até ao topo (padding 0), posição dos painéis / botão GPS — ver pages/mapa.js */
  overlayTopPx,
  onDetailOpenChange,
}) {
  return (
    <div className="fixed inset-0 z-0 h-full w-full">
      <LeafletMap
        mapThemeId={mapThemeId}
        searchQuery={searchQuery}
        promoOnly={promoOnly}
        wazeUi={wazeUi}
        headerOffsetPx={headerOffsetPx}
        overlayTopPx={overlayTopPx}
        onDetailOpenChange={onDetailOpenChange}
      />
    </div>
  );
}
