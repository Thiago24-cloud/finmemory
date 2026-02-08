import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (token) mapboxgl.accessToken = token;

export default function PriceMap() {
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
  }, [lng, lat, zoom]);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg text-gray-600">
        <p>Configure NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no .env.local para ver o mapa.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
}
