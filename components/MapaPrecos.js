'use client';

import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const LeafletMap = dynamic(() => import('./MapaPrecosLeaflet'), { ssr: false });

export default function MapaPrecos({
  mapThemeId = 'padrao',
  searchQuery = '',
  promoOnly = false,
  wazeUi = false,
  planningMode = false,
  planningItems = [],
  onPlanningSummaryChange,
  planningActionRequest,
  headerOffsetPx = 120,
  /** Quando o mapa vai até ao topo (padding 0), posição dos painéis / botão GPS — ver pages/mapa.js */
  overlayTopPx,
  onDetailOpenChange,
  onDetailExpandedChange,
}) {
  return (
    <div className="fixed inset-0 z-0 h-full w-full">
      <LeafletMap
        mapThemeId={mapThemeId}
        searchQuery={searchQuery}
        promoOnly={promoOnly}
        wazeUi={wazeUi}
        planningMode={planningMode}
        planningItems={planningItems}
        onPlanningSummaryChange={onPlanningSummaryChange}
        planningActionRequest={planningActionRequest}
        headerOffsetPx={headerOffsetPx}
        overlayTopPx={overlayTopPx}
        onDetailOpenChange={onDetailOpenChange}
        onDetailExpandedChange={onDetailExpandedChange}
      />
    </div>
  );
}
