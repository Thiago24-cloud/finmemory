import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';
import { getSupabase } from '../lib/supabase';

// Cores da marca FinMemory (logo: verde #2ECC49, preto, branco)
const BRAND = {
  green: '#2ECC49',
  greenDark: '#22a83a',
  black: '#000000',
  white: '#FFFFFF',
};

/** Cores por tipo de estabelecimento – cada local no mapa tem uma cor distinta */
const LOCATION_COLORS = {
  supermercado: { main: '#FF6B6B', dark: '#e04545' },
  mercado: { main: '#FF6B6B', dark: '#e04545' },
  farmácia: { main: '#4ECDC4', dark: '#3ab5ad' },
  restaurante: { main: '#FFD93D', dark: '#e6c235' },
  bar: { main: '#95E1D3', dark: '#7bcfbf' },
  padaria: { main: '#F38181', dark: '#e06868' },
  açougue: { main: '#AA4A44', dark: '#8a3b36' },
  posto: { main: '#6C5CE7', dark: '#5543d4' },
  combustível: { main: '#6C5CE7', dark: '#5543d4' },
  eletronicos: { main: '#74B9FF', dark: '#5aa3ef' },
  roupas: { main: '#FD79A8', dark: '#e85d92' },
  vestuário: { main: '#FD79A8', dark: '#e85d92' },
  serviços: { main: '#A29BFE', dark: '#7c73e8' },
  default: { main: BRAND.green, dark: BRAND.greenDark },
};

/** Define a cor do pin pelo nome do estabelecimento e/ou categoria (ex.: extraído do email/OCR). */
function getColorForLocation(storeName, category) {
  const text = `${(category || '')} ${(storeName || '')}`.toLowerCase();
  for (const [key, colors] of Object.entries(LOCATION_COLORS)) {
    if (key === 'default') continue;
    if (text.includes(key)) return colors;
  }
  return LOCATION_COLORS.default;
}

/** Escurece um hex para a cauda do pin (fallback se não tiver dark no mapa). */
function darkenHex(hex, percent = 12) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent / 100));
  const b = Math.max(0, (num & 0xff) * (1 - percent / 100));
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

const MAP_STYLES = [
  { id: 'light-v11', label: 'Claro', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'streets-v12', label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'dark-v11', label: 'Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'outdoors-v12', label: 'Outdoor', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'satellite-streets-v12', label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
];

/** Cria o elemento DOM do marcador customizado: quadrado arredondado com cor por local + cifrão branco + cauda */
function createCustomMarkerElement(colors = LOCATION_COLORS.default) {
  const main = colors.main || BRAND.green;
  const dark = colors.dark || darkenHex(main, 15);
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
      background: ${main};
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
      border-top: 10px solid ${dark};
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
      z-index: 0;
    `;
  }
  return el;
}

function popupHTML(store, product, price, timeAgo, pinColor = BRAND.green) {
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
        color: ${pinColor};
      ">${price}</p>
      <p style="margin: 0; font-size: 0.75rem; color: #6b7280;">${timeAgo}</p>
    </div>
  `;
}

/** Cria elemento DOM do marcador de cluster (círculo com número de pins agrupados) */
function createClusterMarkerElement(count, onClick) {
  const el = document.createElement('div');
  el.className = 'finmemory-cluster-marker';
  el.innerHTML = `<span class="finmemory-cluster-marker__count">${count}</span>`;
  el.style.cssText = `
    width: 44px;
    height: 44px;
    background: ${BRAND.green};
    border: 3px solid ${BRAND.white};
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: 800;
    font-size: 1rem;
    color: ${BRAND.white};
    font-family: system-ui, -apple-system, sans-serif;
  `;
  if (typeof onClick === 'function') {
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  }
  return el;
}

/** Dados de teste quando não houver pontos reais no Supabase */
const FALLBACK_MARKERS = [
  { lng: -46.6555, lat: -23.5629, store: 'Drogasil Paulista', product: 'Dipirona 500mg', price: 'R$ 12,90', timeAgo: 'Há 2 horas · Caçador #4521', category: 'farmácia' },
  { lng: -46.6433, lat: -23.5505, store: 'Pão de Açúcar', product: 'Leite Integral 1L', price: 'R$ 5,90', timeAgo: 'Há 5 horas · Explorador #1234', category: 'supermercado' },
];

function formatPrice(value) {
  if (value == null || value === '') return 'R$ 0,00';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(n) ? 0 : n);
}

/** Busca pontos do mapa: API (dados reais) ou fallback */
async function fetchMapPoints() {
  try {
    const res = await fetch('/api/map/points');
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.points || [];
    return raw.map((p) => ({
      lng: p.lng,
      lat: p.lat,
      store: p.store_name,
      product: p.product_name,
      price: p.price,
      category: p.category,
      timeAgo: [p.time_ago, p.user_label].filter(Boolean).join(' · ')
    }));
  } catch (e) {
    console.warn('Map points fetch failed:', e);
    return null;
  }
}

/** Busca perguntas da comunidade (para pins no mapa) */
async function fetchMapQuestions() {
  try {
    const res = await fetch('/api/map/questions');
    if (!res.ok) return [];
    const json = await res.json();
    return json.questions || [];
  } catch (e) {
    console.warn('Map questions fetch failed:', e);
    return [];
  }
}

const QUESTION_PIN_COLOR = '#F59E0B';
const QUESTION_PIN_DARK = '#D97706';

/** Cria elemento DOM do marcador de pergunta (ícone ?) */
function createQuestionMarkerElement() {
  const el = document.createElement('div');
  el.className = 'finmemory-question-marker';
  el.innerHTML = `
    <div class="finmemory-question-marker__pin">
      <span class="finmemory-question-marker__symbol">?</span>
    </div>
    <div class="finmemory-question-marker__tail"></div>
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
  const pin = el.querySelector('.finmemory-question-marker__pin');
  const tail = el.querySelector('.finmemory-question-marker__tail');
  if (pin) {
    pin.style.cssText = `
      width: 36px;
      height: 36px;
      background: ${QUESTION_PIN_COLOR};
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
  if (el.querySelector('.finmemory-question-marker__symbol')) {
    el.querySelector('.finmemory-question-marker__symbol').style.cssText = `
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
      border-top: 10px solid ${QUESTION_PIN_DARK};
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
      z-index: 0;
    `;
  }
  return el;
}

/** HTML inicial do popup da pergunta (carrega detalhes ao abrir) */
function questionPopupHTML(questionId, message, storeName, timeAgo, userLabel) {
  const store = (storeName || 'Local').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const msg = (message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div class="finmemory-question-popup" data-question-id="${questionId}">
      <div class="q-loading">Carregando...</div>
      <div class="q-content" style="display:none;">
        <h3 style="font-weight:700;font-size:1rem;margin:0 0 6px 0;color:#1a1a1a;">${store}</h3>
        <p style="margin:0 0 8px 0;font-size:0.95rem;color:#374151;">${msg}</p>
        <p style="margin:0;font-size:0.75rem;color:#6b7280;">${timeAgo} · ${userLabel}</p>
        <div class="q-replies"></div>
        <div class="q-reply-form" style="margin-top:10px;">
          <textarea class="q-reply-input" rows="2" placeholder="Sua resposta..." style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
          <button type="button" class="q-reply-btn" style="margin-top:6px;padding:8px 14px;background:#2ECC49;color:white;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Responder</button>
        </div>
      </div>
    </div>
  `;
}

export default function PriceMap({ mapboxToken: tokenProp, refreshQuestionsTrigger = 0 }) {
  const token = tokenProp || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) || '';

  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const clusterIndexRef = useRef(null);
  const questionMarkersRef = useRef([]);
  const mapPointsRef = useRef(null);
  const mapQuestionsRef = useRef([]);
  const openQuestionPopupRef = useRef(null);
  const [lng] = useState(-46.6333);
  const [lat] = useState(-23.5505);
  const [zoom] = useState(12);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0]);
  const [mapError, setMapError] = useState(null);
  const [mapRetry, setMapRetry] = useState(0);

  useEffect(() => {
    console.log('Token Mapbox:', process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
    console.log('Todas env vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')));
  }, []);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    questionMarkersRef.current.forEach((m) => m.remove());
    questionMarkersRef.current = [];
  };

  /** Converte pontos do mapa para GeoJSON para o Supercluster */
  const pointsToGeoJSON = useCallback((points) => {
    return (points || []).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { ...p }
    }));
  }, []);

  /** Atualiza marcadores a partir do índice de clusters (bbox/zoom atuais). Só limpa price markers. */
  const updateClusterMarkers = useCallback((mapInstance, index) => {
    if (!mapInstance || !index) return;
    const b = mapInstance.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const zoom = Math.floor(mapInstance.getZoom());
    const clusters = index.getClusters(bbox, zoom);

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const isCluster = feature.properties.cluster_id != null;
      const count = feature.properties.point_count;

      if (isCluster) {
        const el = createClusterMarkerElement(count, () => {
          mapInstance.flyTo({ center: [lng, lat], zoom: Math.min(zoom + 2, 18) });
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(mapInstance);
        markersRef.current.push(marker);
      } else {
        const { store, product, price, timeAgo, category } = feature.properties;
        const priceStr = typeof price === 'number' || (typeof price === 'string' && price?.trim() && !String(price).startsWith('R$')) ? formatPrice(price) : (price || 'R$ 0,00');
        const colors = getColorForLocation(store, category);
        const el = createCustomMarkerElement(colors);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 20, className: 'finmemory-popup' })
              .setHTML(popupHTML(store || '', product || '', priceStr, timeAgo || '', colors.main))
          )
          .addTo(mapInstance);
        markersRef.current.push(marker);
      }
    });
  }, []);

  const addMarkersToMap = useCallback((mapInstance, points) => {
    if (!mapInstance) return;
    const data = Array.isArray(points) && points.length > 0 ? points : FALLBACK_MARKERS;
    const features = pointsToGeoJSON(data);
    const index = new Supercluster({ radius: 60, maxZoom: 18 });
    index.load(features);
    clusterIndexRef.current = index;
    updateClusterMarkers(mapInstance, index);
  }, [pointsToGeoJSON, updateClusterMarkers]);

  const buildQuestionDetailHTML = (q) => {
    const store = (q.store_name || 'Local').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const msg = (q.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const replies = (q.replies || []).map((r) => {
      const rMsg = (r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="q-reply" style="margin-top:10px;padding:8px;background:#f3f4f6;border-radius:8px;">
          <p style="margin:0 0 4px 0;font-size:0.9rem;color:#1a1a1a;">${rMsg}</p>
          <p style="margin:0;font-size:0.75rem;color:#6b7280;">${r.time_ago} · ${r.user_label}</p>
          <button type="button" class="q-thanks-btn" data-question-id="${q.id}" data-reply-id="${r.id}" style="margin-top:6px;padding:4px 10px;background:#F59E0B;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
            Obrigado (${r.thanks_count || 0})
          </button>
        </div>
      `;
    }).join('');
    return `
      <div class="finmemory-question-popup" data-question-id="${q.id}">
        <div class="q-content">
          <h3 style="font-weight:700;font-size:1rem;margin:0 0 6px 0;color:#1a1a1a;">${store}</h3>
          <p style="margin:0 0 8px 0;font-size:0.95rem;color:#374151;">${msg}</p>
          <p style="margin:0 0 10px 0;font-size:0.75rem;color:#6b7280;">${q.time_ago} · ${q.user_label}</p>
          <div class="q-replies">${replies || '<p style="font-size:0.85rem;color:#9ca3af;">Nenhuma resposta ainda.</p>'}</div>
          <div class="q-reply-form" style="margin-top:10px;">
            <textarea class="q-reply-input" rows="2" placeholder="Sua resposta..." style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
            <button type="button" class="q-reply-btn" style="margin-top:6px;padding:8px 14px;background:#2ECC49;color:white;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Responder</button>
          </div>
        </div>
      </div>
    `;
  };

  const loadQuestionDetail = useCallback(async (questionId, popup) => {
    if (!popup) return;
    try {
      const res = await fetch(`/api/map/questions/${questionId}`);
      if (!res.ok) return;
      const q = await res.json();
      const html = buildQuestionDetailHTML(q);
      popup.setHTML(html);
      openQuestionPopupRef.current = popup;
      const content = popup._content;
      if (!content) return;
      content.querySelector('.q-reply-btn')?.addEventListener('click', async () => {
        const textarea = content.querySelector('.q-reply-input');
        const message = textarea?.value?.trim();
        if (!message) return;
        const r = await fetch(`/api/map/questions/${questionId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        if (r.ok) {
          textarea.value = '';
          loadQuestionDetail(questionId, popup);
        }
      });
      content.querySelectorAll('.q-thanks-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const replyId = btn.getAttribute('data-reply-id');
          if (!replyId) return;
          const r = await fetch(`/api/map/questions/${questionId}/thanks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply_id: replyId })
          });
          if (r.ok) loadQuestionDetail(questionId, popup);
        });
      });
    } catch (e) {
      console.warn('loadQuestionDetail failed:', e);
    }
  }, []);

  const addQuestionMarkersToMap = useCallback((mapInstance, questions) => {
    if (!mapInstance) return;
    questionMarkersRef.current.forEach((m) => m.remove());
    questionMarkersRef.current = [];
    const withCoords = (questions || []).filter((q) => q.lat != null && q.lng != null);
    withCoords.forEach((q) => {
      const el = createQuestionMarkerElement();
      const popup = new mapboxgl.Popup({ offset: 20, className: 'finmemory-popup finmemory-question-popup' })
        .setHTML(questionPopupHTML(q.id, q.message, q.store_name, q.time_ago, q.user_label));
      popup.once('open', () => loadQuestionDetail(q.id, popup));
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([q.lng, q.lat])
        .setPopup(popup)
        .addTo(mapInstance);
      questionMarkersRef.current.push(marker);
    });
  }, [loadQuestionDetail]);

  useEffect(() => {
    if (!token || !mapContainer.current) return;
    if (map.current) {
      try { map.current.remove(); } catch (_) {}
      map.current = null;
    }
    setMapError(null);
    let channel;
    let supabase;
    try {
      if (typeof mapboxgl !== 'undefined') mapboxgl.accessToken = token;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle.url,
        center: [lng, lat],
        zoom: zoom
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', async () => {
        try {
          const points = mapPointsRef.current ?? (await fetchMapPoints());
          mapPointsRef.current = points;
          addMarkersToMap(map.current, points);
          const questions = mapQuestionsRef.current?.length ? mapQuestionsRef.current : (await fetchMapQuestions());
          mapQuestionsRef.current = questions;
          addQuestionMarkersToMap(map.current, questions);
        } catch (e) {
          console.warn('Erro ao carregar pontos/perguntas do mapa:', e);
        }
      });

      map.current.on('moveend', () => {
        if (clusterIndexRef.current && map.current) {
          updateClusterMarkers(map.current, clusterIndexRef.current);
        }
      });

      map.current.on('error', (e) => {
        console.warn('Mapbox error:', e);
        setMapError(e?.error?.message || 'Falha ao carregar o mapa.');
      });

      supabase = getSupabase();
      if (supabase) {
        channel = supabase
          .channel('map_updates')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_points' }, async () => {
            const points = await fetchMapPoints();
            mapPointsRef.current = points;
            if (map.current) addMarkersToMap(map.current, points);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'map_questions' }, async () => {
            const questions = await fetchMapQuestions();
            mapQuestionsRef.current = questions;
            if (map.current) addQuestionMarkersToMap(map.current, questions);
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('Erro ao inicializar mapa:', err);
      setMapError(err?.message || 'Mapa indisponível. Verifique o token Mapbox.');
      if (map.current) {
        try { map.current.remove(); } catch (_) {}
        map.current = null;
      }
    }

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
      clearMarkers();
      if (map.current) {
        try { map.current.remove(); } catch (_) {}
        map.current = null;
      }
    };
  }, [token, lng, lat, zoom, addMarkersToMap, updateClusterMarkers, addQuestionMarkersToMap, mapRetry]);

  useEffect(() => {
    if (!map.current || refreshQuestionsTrigger === 0) return;
    (async () => {
      const questions = await fetchMapQuestions();
      mapQuestionsRef.current = questions;
      addQuestionMarkersToMap(map.current, questions);
    })();
  }, [refreshQuestionsTrigger, addQuestionMarkersToMap]);

  useEffect(() => {
    if (!map.current || !token) return;
    map.current.setStyle(mapStyle.url);
    map.current.once('style.load', () => {
      addMarkersToMap(map.current, mapPointsRef.current);
      addQuestionMarkersToMap(map.current, mapQuestionsRef.current);
    });
  }, [mapStyle, token, addQuestionMarkersToMap]);

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

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg text-gray-700 p-6 text-center">
        <div>
          <p className="font-medium mb-1">Mapa indisponível</p>
          <p className="text-sm text-gray-600 mb-3">{mapError}</p>
          <button
            type="button"
            onClick={() => { setMapError(null); setMapRetry((c) => c + 1); }}
            className="text-sm text-[#2ECC49] font-medium hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 relative" style={{ height: '100%' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ minHeight: 0 }} />
      {/* Estilo do mapa: acima do canvas (z-index), área de toque maior para clicar */}
      <div
        className="absolute bottom-3 right-3 flex flex-wrap gap-2 justify-end max-w-[calc(100%-1rem)] z-[10]"
        style={{ pointerEvents: 'auto' }}
      >
        {MAP_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleStyleChange(style);
            }}
            className={`min-h-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-md border select-none ${
              mapStyle.id === style.id
                ? 'text-white border-transparent'
                : 'bg-white/98 hover:bg-white border-gray-200 text-gray-700'
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
