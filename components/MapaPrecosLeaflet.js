'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapThemeById } from '../lib/colors';
import { getCategoryColor } from '../lib/colors';

const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function createCategoryIcon(hexColor) {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${hexColor};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function LocationMarker() {
  const [position, setPosition] = useState(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on('locationfound', function (e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={DEFAULT_ICON}>
      <Popup>Você está aqui! 📍</Popup>
    </Marker>
  );
}

export default function MapaPrecosLeaflet({ mapThemeId = 'ruas' }) {
  const theme = getMapThemeById(mapThemeId);
  const [locais, setLocais] = useState([
    { id: 1, nome: 'Drogasil', produto: 'Dipirona 500mg', preco: 10.99, lat: -23.5505, lng: -46.6333, categoria: 'farmácia' },
    { id: 2, nome: 'Droga Raia', produto: 'Dipirona 500mg', preco: 12.50, lat: -23.5489, lng: -46.6388, categoria: 'farmácia' },
    { id: 3, nome: 'Pague Menos', produto: 'Dipirona 500mg', preco: 9.90, lat: -23.5520, lng: -46.6290, categoria: 'farmácia' },
    { id: 4, nome: 'Pão de Açúcar', produto: 'Leite 1L', preco: 5.90, lat: -23.5480, lng: -46.6310, categoria: 'supermercado' },
    { id: 5, nome: 'Restaurante do Zé', produto: 'Marmita', preco: 22.00, lat: -23.5530, lng: -46.6350, categoria: 'restaurante' },
    { id: 6, nome: 'Lanchonete Central', produto: 'X-Tudo', preco: 18.50, lat: -23.5510, lng: -46.6340, categoria: 'lanchonete' }
  ]);
  const [carregando, setCarregando] = useState(false);

  const buscarLocais = async () => {
    setCarregando(true);
    try {
      // TODO: buscar de /api/map/points ou Supabase
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
    setCarregando(false);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={13}
        style={{ height: '100%', width: '100%', paddingTop: '56px' }}
        className="z-0"
      >
        <TileLayer
          attribution={theme.id === 'satelite'
            ? '&copy; Esri'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'}
          url={theme.url}
        />
        <LocationMarker />
        {locais.map((local) => {
          const { main } = getCategoryColor(local.categoria, local.nome);
          const customIcon = createCategoryIcon(main);
          return (
            <Marker
              key={local.id}
              position={[local.lat, local.lng]}
              icon={customIcon}
            >
              <Popup>
                <div className="p-2 min-w-[160px]">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mb-1"
                    style={{ backgroundColor: main }}
                  >
                    {local.categoria || 'Outros'}
                  </span>
                  <h3 className="font-bold text-gray-900 text-base mt-1">{local.nome}</h3>
                  <p className="text-sm text-gray-600">{local.produto}</p>
                  <p className="text-xl font-bold mt-2" style={{ color: main }}>
                    R$ {Number(local.preco).toFixed(2)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-20 left-3 right-3 sm:left-4 sm:right-auto z-[1000] bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-200/80 max-w-[280px]">
        <h3 className="font-bold text-gray-900 mb-2 text-sm">📊 Tipos de comércio</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {['Supermercado', 'Restaurante', 'Lanchonete', 'Farmácia', 'Padaria', 'Posto'].map((label) => {
            const key = label.toLowerCase();
            const { main } = getCategoryColor(key, '');
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow"
                  style={{ backgroundColor: main }}
                />
                <span className="text-gray-700">{label}</span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={buscarLocais}
          disabled={carregando}
          className="mt-2 w-full py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
        >
          {carregando ? 'Atualizando...' : 'Atualizar preços'}
        </button>
      </div>
    </div>
  );
}
