import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Camera } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import MapFilters from "@/components/map/MapFilters";
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

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
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
  const [period, setPeriod] = useState<"current" | "past">("current");

  // Fetch all points
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("price_points")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPoints(data as PricePoint[]);
      }
    };
    load();
  }, []);

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(points.map((p) => p.category).filter(Boolean)))],
    [points]
  );

  // Filter by period, search, category
  const filtered = useMemo(() => {
    const monthStart = getCurrentMonthStart();
    return points.filter((p) => {
      const pointDate = new Date(p.created_at);
      const isPeriodMatch =
        period === "current" ? pointDate >= monthStart : pointDate < monthStart;
      if (!isPeriodMatch) return false;

      const matchesCategory = selectedCategory === "Todos" || p.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.product_name.toLowerCase().includes(q) ||
        p.store_name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [points, period, selectedCategory, search]);

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 }),
        () => {}
      );
    }
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Change style
  useEffect(() => {
    if (mapRef.current) mapRef.current.setStyle(MAP_STYLES[styleIdx].url);
  }, [styleIdx]);

  // Render markers with color based on period
  const renderMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!mapRef.current) return;

    const isCurrent = period === "current";
    const pinColor = isCurrent ? "#2ECC49" : "#9CA3AF";
    const label = isCurrent ? "R$" : "R$";

    filtered.forEach((p) => {
      const el = document.createElement("div");
      el.innerHTML = `<span style="font-size:11px;font-weight:700;color:#fff;">${label}</span>`;
      el.style.cssText = `
        width:36px;height:36px;border-radius:50%;
        background:${pinColor};border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;transition:transform 0.15s;
        ${!isCurrent ? "opacity:0.7;" : ""}
      `;
      el.onmouseenter = () => (el.style.transform = "scale(1.15)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");

      const popup = new maplibregl.Popup({ offset: 20, maxWidth: "220px" }).setHTML(`
        <div style="font-family:system-ui,sans-serif;padding:4px 2px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${p.store_name}</div>
          <div style="font-size:12px;color:#555;margin-bottom:4px;">${p.product_name}</div>
          <div style="font-size:18px;font-weight:700;color:${pinColor};">R$ ${p.price.toFixed(2).replace(".", ",")}</div>
          <div style="font-size:11px;color:#999;margin-top:3px;">${timeAgo(p.created_at)}</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [filtered, period]);

  useEffect(() => {
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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card z-10 shrink-0">
        <h1 className="text-base font-semibold text-foreground whitespace-nowrap">
          🗺️ Mapa de Preços
        </h1>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        <MapFilters
          period={period}
          onPeriodChange={setPeriod}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          mapStyles={MAP_STYLES}
          styleIdx={styleIdx}
          onStyleChange={setStyleIdx}
        />

        {/* Count badge */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full z-10 shadow-sm">
          {filtered.length} preço{filtered.length !== 1 ? "s" : ""} · {period === "current" ? "este mês" : "meses anteriores"}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate("/share-price")}
          className="absolute bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform z-10 bg-accent text-accent-foreground"
          title="Compartilhar preço"
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default MapaPrecos;
