import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface PricePoint {
  id: string;
  store_name: string;
  product_name: string;
  price: number;
  lat: number;
  lng: number;
  category: string;
  created_at: string;
}

const MOCK_POINTS: PricePoint[] = [
  {
    id: "mock-1",
    store_name: "Supermercado Extra",
    product_name: "Arroz 5kg",
    price: 24.9,
    lat: -23.5505,
    lng: -46.6333,
    category: "Alimentos",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    store_name: "Pão de Açúcar",
    product_name: "Leite Integral 1L",
    price: 6.49,
    lat: -23.5615,
    lng: -46.6559,
    category: "Alimentos",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "mock-3",
    store_name: "Farmácia São Paulo",
    product_name: "Vitamina C 1000mg",
    price: 12.9,
    lat: -23.5435,
    lng: -46.6388,
    category: "Saúde",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const MAP_STYLES = [
  { label: "Claro", url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  { label: "Ruas", url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
  { label: "Escuro", url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

const MapaPrecos = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [search, setSearch] = useState("");
  const [styleIdx, setStyleIdx] = useState(0);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  // Fetch points from DB, fallback to mock
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("price_points")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setPoints(data as PricePoint[]);
      } else {
        setPoints(MOCK_POINTS);
      }
    };
    load();
  }, []);

  // Derive categories from points
  const categories = ["Todos", ...Array.from(new Set(points.map((p) => p.category).filter(Boolean)))];

  // Filter points by search and category
  const filtered = points.filter((p) => {
    const matchesCategory = selectedCategory === "Todos" || p.category === selectedCategory;
    if (!search.trim()) return matchesCategory;
    const q = search.toLowerCase();
    return (
      matchesCategory &&
      (p.product_name.toLowerCase().includes(q) ||
        p.store_name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q))
    );
  });

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[styleIdx].url,
      center: [-46.63, -23.55],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    // Try geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 }),
        () => {}
      );
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Change style
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(MAP_STYLES[styleIdx].url);
  }, [styleIdx]);

  // Render markers
  const renderMarkers = useCallback(() => {
    // Clear old
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!mapRef.current) return;

    filtered.forEach((p) => {
      // Custom pin element
      const el = document.createElement("div");
      el.className = "finmemory-pin";
      el.innerHTML = `<span style="font-size:11px;font-weight:700;color:#fff;">R$</span>`;
      el.style.cssText = `
        width:36px;height:36px;border-radius:50%;
        background:#2ECC49;border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;transition:transform 0.15s;
      `;
      el.onmouseenter = () => (el.style.transform = "scale(1.15)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");

      const popup = new maplibregl.Popup({ offset: 20, maxWidth: "220px" }).setHTML(`
        <div style="font-family:system-ui,sans-serif;padding:4px 2px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${p.store_name}</div>
          <div style="font-size:12px;color:#555;margin-bottom:4px;">${p.product_name}</div>
          <div style="font-size:18px;font-weight:700;color:#2ECC49;">R$ ${p.price.toFixed(2).replace(".", ",")}</div>
          <div style="font-size:11px;color:#999;margin-top:3px;">${timeAgo(p.created_at)}</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [filtered]);

  useEffect(() => {
    // Wait for map style to load before rendering markers
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      const onLoad = () => renderMarkers();
      map.once("styledata", onLoad);
      return () => { map.off("styledata", onLoad); };
    }
  }, [filtered, renderMarkers, styleIdx]);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white z-10 shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <h1 className="text-base font-semibold text-foreground whitespace-nowrap ml-auto">
          Mapa de Preços
        </h1>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Style selector */}
        <div className="absolute top-3 left-3 flex gap-1 bg-white/90 backdrop-blur rounded-lg p-1 shadow-md z-10">
          {MAP_STYLES.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setStyleIdx(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === styleIdx
                  ? "bg-[#2ECC49] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="absolute top-14 left-3 flex flex-wrap gap-1 bg-white/90 backdrop-blur rounded-lg p-1 shadow-md z-10 max-w-[220px]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                cat === selectedCategory
                  ? "bg-[#2ECC49] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Footer text */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-gray-400 bg-white/80 backdrop-blur px-3 py-1 rounded-full z-10">
          Preços compartilhados pela comunidade FinMemory
        </div>

        {/* FAB - Share Price */}
        <button
          onClick={() => navigate("/share-price")}
          className="absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform z-10 bg-accent text-accent-foreground"
          title="Compartilhar preço"
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default MapaPrecos;
