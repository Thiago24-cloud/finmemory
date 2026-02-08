import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function PriceMap({ mapboxToken: tokenProp }) {
  const token = tokenProp || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) || '';
  if (token) mapboxgl.accessToken = token;

  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-46.6333);
  const [lat] = useState(-23.5505);
  const [zoom] = useState(12);

  useEffect(() => {
    if (!token || map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

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
      .addTo(map.current);

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
      .addTo(map.current);
  }, [token, lng, lat, zoom]);

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
    <div className="w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
}
