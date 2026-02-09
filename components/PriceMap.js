import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAP_STYLES = [
  { id: 'streets-v12', label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'light-v11', label: 'Claro', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'dark-v11', label: 'Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'outdoors-v12', label: 'Outdoor', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'satellite-streets-v12', label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
];

// Token direto para testar (depois volte a usar só .env.local / getServerSideProps)
const FALLBACK_TOKEN = 'pk.eyJ1IjoidGhpYWdvLWZpbm1lbW9yeSIsImEiOiJjbWxlOGkyNXQxaTMzM2dwb2NucThwYnFpIn0.bOaoZosTL_xjmwsoUh-1sA';

function addMarkers(map) {
  if (!map) return;
  new mapboxgl.Marker({ color: '#22c55e' })
    .setLngLat([-46.6555, -23.5629])
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="padding: 10px;">
          <h3 style="font-weight: bold; margin-bottom: 5px;">🏪 Drogasil Paulista</h3>
          <p style="margin: 5px 0;">💊 Dipirona 500mg</p>
          <p style="margin: 5px 0; color: #22c55e; font-weight: bold;">💰 R$ 12,90</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">⏰ Há 2 horas por Caçador #4521</p>
        </div>`
      )
    )
    .addTo(map);
  new mapboxgl.Marker({ color: '#eab308' })
    .setLngLat([-46.6433, -23.5505])
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="padding: 10px;">
          <h3 style="font-weight: bold; margin-bottom: 5px;">🛒 Pão de Açúcar</h3>
          <p style="margin: 5px 0;">🥛 Leite Integral 1L</p>
          <p style="margin: 5px 0; color: #eab308; font-weight: bold;">💰 R$ 5,90</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">⏰ Há 5 horas por Explorador #1234</p>
        </div>`
      )
    )
    .addTo(map);
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
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-wrap gap-2 mb-2">
        {MAP_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => handleStyleChange(style)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mapStyle.id === style.id
                ? 'bg-[#667eea] text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <div ref={mapContainer} className="flex-1 min-h-0 rounded-lg" />
    </div>
  );
}
