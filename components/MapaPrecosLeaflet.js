'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para os ícones do Leaflet no Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
    <Marker position={position} icon={icon}>
      <Popup>Você está aqui! 📍</Popup>
    </Marker>
  );
}

export default function MapaPrecosLeaflet() {
  const [locais, setLocais] = useState([
    { id: 1, nome: 'Drogasil', produto: 'Dipirona 500mg', preco: 10.99, lat: -23.5505, lng: -46.6333 },
    { id: 2, nome: 'Droga Raia', produto: 'Dipirona 500mg', preco: 12.50, lat: -23.5489, lng: -46.6388 },
    { id: 3, nome: 'Pague Menos', produto: 'Dipirona 500mg', preco: 9.90, lat: -23.5520, lng: -46.6290 }
  ]);
  const [carregando, setCarregando] = useState(false);

  const buscarLocais = async () => {
    setCarregando(true);
    try {
      // const { data } = await supabase.from('precos_compartilhados').select('*');
      // setLocais(data || []);
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
    setCarregando(false);
  };

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold text-green-600">
          🗺️ Waze dos Preços
        </h1>
        <p className="text-sm text-gray-600">
          Encontre os melhores preços perto de você
        </p>
      </div>

      <button
        type="button"
        onClick={buscarLocais}
        className="absolute top-24 right-4 z-[1000] bg-green-500 text-white px-4 py-2 rounded-full shadow-lg hover:bg-green-600"
      >
        {carregando ? '🔄 Atualizando...' : '🔄 Atualizar'}
      </button>

      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={13}
        style={{ height: '100%', width: '100%', paddingTop: '100px' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        {locais.map((local) => (
          <Marker
            key={local.id}
            position={[local.lat, local.lng]}
            icon={icon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg">{local.nome}</h3>
                <p className="text-sm text-gray-600">{local.produto}</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  R$ {local.preco.toFixed(2)}
                </p>
                <button type="button" className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                  Ver detalhes
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-bold mb-2">📊 Legenda</h3>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Melhor preço</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>Você está aqui</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {locais.length} locais encontrados
        </p>
      </div>
    </div>
  );
}
