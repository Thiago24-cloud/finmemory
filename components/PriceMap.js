import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Cores da marca FinMemory (logo: verde #2ECC49, preto, branco)
const BRAND = {
  green: '#2ECC49',
  greenDark: '#22a83a',
  black: '#000000',
  white: '#FFFFFF',
};

const MAP_STYLES = [
  { id: 'light-v11', label: 'Claro', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'streets-v12', label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'dark-v11', label: 'Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'outdoors-v12', label: 'Outdoor', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'satellite-streets-v12', label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
];

const FALLBACK_TOKEN = 'pk.eyJ1IjoidGhpYWdvLWZpbm1lbW9yeSIsImEiOiJjbWxlOGkyNXQxaTMzM2dwb2NucThwYnFpIn0.bOaoZosTL_xjmwsoUh-1sA';

/** Cria o elemento DOM do marcador customizado: quadrado arredondado verde + cifrão branco + cauda */
function createCustomMarkerElement() {
  const el = document.createElement('div');
  el.className = 'finmemory-marker';
  el.innerHTML = `
    <div class="finmemory-marker__pin">
      <span class="finmemory-marker__symbol">$</span>
    </div>
    <div class="finmemory-marker__tail"></div>
  `;
  el.style.cssText = `
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `;
  const pin = el.querySelector('.finmemory-marker__pin');
  const tail = el.querySelector('.finmemory-marker__tail');
  if (pin) {
    pin.style.cssText = `
      width: 36px;
      height: 36px;
      background: ${BRAND.green};
      border: 3px solid ${BRAND.white};
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
    `;
  }
  if (el.querySelector('.finmemory-marker__symbol')) {
    el.querySelector('.finmemory-marker__symbol').style.cssText = `
      color: ${BRAND.white};
      font-size: 18px;
      font-weight: 800;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1;
    `;
  }
  if (tail) {
    tail.style.cssText = `
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 10px solid ${BRAND.greenDark};
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
      z-index: 0;
    `;
  }
  return el;
}

function popupHTML(store, product, price, timeAgo, userName) {
  return `
    <div style="
      padding: 14px 16px;
      min-width: 200px;
      font-family: system-ui, -apple-system, sans-serif;
      color: #1a1a1a;
    ">
      <h3 style="
        font-weight: 700;
        font-size: 1rem;
        margin: 0 0 8px 0;
        color: ${BRAND.black};
      ">${store}</h3>
      <p style="margin: 4px 0; font-size: 0.9rem; color: #374151;">${product}</p>
      <p style="
        margin: 8px 0 4px 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: ${BRAND.green};
      ">${price}</p>
      <p style="margin: 0; font-size: 0.75rem; color: #6b7280;">${timeAgo}</p>
    </div>
  `;
}

const MARKERS_DATA = [
  { lng: -46.6555, lat: -23.5629, store: 'Drogasil Paulista', product: 'Dipirona 500mg', price: 'R$ 12,90', timeAgo: 'Há 2 horas · Caçador #4521' },
  { lng: -46.6433, lat: -23.5505, store: 'Pão de Açúcar', product: 'Leite Integral 1L', price: 'R$ 5,90', timeAgo: 'Há 5 horas · Explorador #1234' },
];

function addMarkers(map) {
  if (!map) return;
  MARKERS_DATA.forEach(({ lng, lat, store, product, price, timeAgo }) => {
    const el = createCustomMarkerElement();
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 20, className: 'finmemory-popup' })
          .setHTML(popupHTML(store, product, price, timeAgo))
      )
      .addTo(map);
  });
}

export default function PriceMap({ mapboxToken: tokenProp }) {
  const token = tokenProp || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) || FALLBACK_TOKEN;
  mapboxgl.accessToken = token;

  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-46.6333);
  const [lat] = useState(-23.5505);
  const [zoom] = useState(12);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0]);

  useEffect(() => {
    if (!token || map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle.url,
      center: [lng, lat],
      zoom: zoom
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => addMarkers(map.current));

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [token, lng, lat, zoom]);

  useEffect(() => {
    if (!map.current || !token) return;
    map.current.setStyle(mapStyle.url);
    map.current.once('style.load', () => addMarkers(map.current));
  }, [mapStyle, token]);

  const handleStyleChange = (style) => {
    setMapStyle(style);
  };

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 p-6 text-center">
        <div>
          <p className="font-medium mb-1">Configure o token do Mapbox no .env.local:</p>
          <p className="text-sm mb-2">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ...</p>
          <p className="text-xs">Depois reinicie o servidor (Ctrl+C e <code>npm run dev</code>).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 relative" style={{ height: '100%' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ minHeight: 0 }} />
      {/* Estilo do mapa: canto inferior direito, compacto (referência Google) */}
      <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 justify-end max-w-[calc(100%-0.5rem)]">
        {MAP_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => handleStyleChange(style)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors shadow-sm ${
              mapStyle.id === style.id
                ? 'text-white border-0'
                : 'bg-white/95 backdrop-blur border border-gray-200 text-gray-700 hover:bg-white'
            }`}
            style={mapStyle.id === style.id ? { backgroundColor: BRAND.green } : undefined}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}
