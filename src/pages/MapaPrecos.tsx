import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Target } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import MapFilters from "@/components/map/MapFilters";
import { SearchHeader, DecisionCarousel, FinancialSummaryFAB } from "@/components/mapa";
import { useShopping } from "@/context/ShoppingProvider";
import { buildRouteLineStringFeature } from "@/lib/mapRouteGeoJson";
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
  { label: "Verde", url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
];

const SOFT_GOLD = "#D4AF37";
const NEON_GREEN = "#39FF14";
const ROUTE_SOURCE_ID = "decision-route-source";
const ROUTE_LAYER_ID = "decision-route-layer";

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const {
    shoppingList,
    quickItem,
    selectedDecision,
    setFinancialSummary,
    setRouteCoordinates,
  } = useShopping();

  const [styleIdx, setStyleIdx] = useState(0);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [period, setPeriod] = useState<"current" | "past">("current");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

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

  const shoppingListSet = useMemo(
    () => new Set(shoppingList.map((item) => item.toLowerCase().trim())),
    [shoppingList]
  );

  const matchesShoppingIntent = useCallback(
    (productName: string) => {
      if (!shoppingListSet.size) return false;
      const name = productName.toLowerCase();
      return Array.from(shoppingListSet).some((item) => name.includes(item));
    },
    [shoppingListSet]
  );

  const filtered = useMemo(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return points.filter((p) => {
      const pointDate = new Date(p.created_at);
      // TTL: pontos que passaram de 24h devem sumir do mapa.
      // Mantemos a aba "past" para compatibilidade, mas ela não terá itens.
      if (period === "current") {
        if (pointDate < cutoff) return false;
      } else {
        return false;
      }

      const matchesCategory = selectedCategory === "Todos" || p.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!quickItem.trim()) return true;
      const q = quickItem.toLowerCase();
      return (
        p.product_name.toLowerCase().includes(q) ||
        p.store_name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [points, period, quickItem, selectedCategory]);

  const monthlySpent = useMemo(() => {
    const monthStart = getCurrentMonthStart();
    return points
      .filter((p) => new Date(p.created_at) >= monthStart)
      .reduce((acc, p) => acc + p.price, 0);
  }, [points]);

  useEffect(() => {
    setFinancialSummary({ monthlySpent });
  }, [monthlySpent, setFinancialSummary]);

  const decisionData = useMemo(() => {
    if (!shoppingList.length) return null;

    const decisionCandidates = points.filter((point) => matchesShoppingIntent(point.product_name));
    if (!decisionCandidates.length) return null;

    const groupedByStore = new Map<
      string,
      { items: Set<string>; total: number; coord: [number, number] }
    >();

    decisionCandidates.forEach((point) => {
      const key = point.store_name;
      const normalizedProduct = point.product_name.toLowerCase();
      if (!groupedByStore.has(key)) {
        groupedByStore.set(key, {
          items: new Set<string>(),
          total: 0,
          coord: [point.lng, point.lat],
        });
      }
      const storeData = groupedByStore.get(key)!;
      storeData.items.add(normalizedProduct);
      storeData.total += point.price;
    });

    const requiredItems = shoppingList.map((item) => item.toLowerCase().trim());
    const allStores = Array.from(groupedByStore.entries());

    const convenienceCandidate = allStores.find(([, data]) =>
      requiredItems.every((required) =>
        Array.from(data.items).some((product) => product.includes(required))
      )
    );

    const economyStoreKeys = new Set<string>();
    let economyTotal = 0;
    requiredItems.forEach((required) => {
      const cheapestForItem = decisionCandidates
        .filter((point) => point.product_name.toLowerCase().includes(required))
        .sort((a, b) => a.price - b.price)[0];

      if (cheapestForItem) {
        economyStoreKeys.add(cheapestForItem.store_name);
        economyTotal += cheapestForItem.price;
      }
    });

    const economyStops = Array.from(economyStoreKeys)
      .map((storeName) => allStores.find(([key]) => key === storeName))
      .filter(Boolean)
      .map(([, data]) => data!.coord);

    const convenienceTotal = convenienceCandidate?.[1].total ?? economyTotal + 7;
    const convenienceStoreName = convenienceCandidate?.[0] ?? "Mercado Premium";
    const convenienceCoord = convenienceCandidate?.[1].coord ?? economyStops[0] ?? [-46.63, -23.55];
    const savingsGap = Math.max(0, convenienceTotal - economyTotal);

    return {
      economyTotal,
      convenienceTotal,
      savingsGap,
      economyStoresCount: economyStoreKeys.size || 1,
      economyStops,
      convenienceStoreName,
      convenienceCoord,
    };
  }, [matchesShoppingIntent, points, shoppingList]);

  const selectedRouteCoords = useMemo(() => {
    if (!decisionData) return [] as [number, number][];
    const baseStart = userLocation ?? [-46.63, -23.55];
    if (selectedDecision === "economy") {
      return [baseStart, ...decisionData.economyStops];
    }
    return [baseStart, decisionData.convenienceCoord];
  }, [decisionData, selectedDecision, userLocation]);

  useEffect(() => {
    setRouteCoordinates(selectedRouteCoords);
  }, [selectedRouteCoords, setRouteCoordinates]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[styleIdx].url,
      center: [-46.63, -23.55],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    const locateUser = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.requestPermissions();
          if (
            permission.location !== "granted" &&
            permission.coarseLocation !== "granted"
          ) {
            return;
          }
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });
          const nextLocation: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(nextLocation);
          map.flyTo({ center: nextLocation, zoom: 18 });
          return;
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const nextLocation: [number, number] = [pos.coords.longitude, pos.coords.latitude];
              setUserLocation(nextLocation);
              map.flyTo({ center: nextLocation, zoom: 18 });
            },
            () => {}
          );
        }
      } catch {
        // Mantém centro padrão quando localização falha.
      }
    };

    void locateUser();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single map instance; styleIdx handled below
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setStyle(MAP_STYLES[styleIdx].url);
  }, [styleIdx]);

  const syncDecisionRouteLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const routeGeoJson = buildRouteLineStringFeature(selectedRouteCoords);

    if (!routeGeoJson) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      return;
    }

    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: routeGeoJson,
      });
    } else {
      (map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(routeGeoJson);
    }

    if (!map.getLayer(ROUTE_LAYER_ID)) {
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": selectedDecision === "economy" ? NEON_GREEN : SOFT_GOLD,
          "line-width": 4,
          "line-dasharray": [1.4, 1.6],
          "line-opacity": 0.9,
        },
      });
    }
    map.setPaintProperty(
      ROUTE_LAYER_ID,
      "line-color",
      selectedDecision === "economy" ? NEON_GREEN : SOFT_GOLD
    );
  }, [selectedDecision, selectedRouteCoords]);

  const renderMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!mapRef.current) return;

    const isCurrent = period === "current";

    filtered.forEach((p) => {
      const hasListItem = matchesShoppingIntent(p.product_name);
      const shouldFade = shoppingList.length > 0 && !hasListItem;
      const isConvenienceHighlight =
        selectedDecision === "convenience" &&
        decisionData &&
        p.store_name === decisionData.convenienceStoreName;

      const pinColor = isConvenienceHighlight ? SOFT_GOLD : isCurrent ? "#2ECC49" : "#9CA3AF";
      const el = document.createElement("div");
      el.innerHTML = hasListItem
        ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
             <span style="font-size:10px;font-weight:700;color:#0f0f0f;background:${NEON_GREEN};padding:1px 5px;border-radius:999px;box-shadow:0 0 12px rgba(57,255,20,0.6);animation:finmemory-pin-pulse 1.4s infinite;">
               R$ ${p.price.toFixed(2).replace(".", ",")}
             </span>
           </div>`
        : `<span style="font-size:11px;font-weight:700;color:#fff;">R$</span>`;
      el.style.cssText = `
        width:36px;height:36px;border-radius:50%;
        background:${pinColor};border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;transition:transform 0.15s;
        ${shouldFade ? "opacity:0.35;" : !isCurrent ? "opacity:0.7;" : ""}
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
  }, [decisionData, filtered, matchesShoppingIntent, period, selectedDecision, shoppingList.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      renderMarkers();
      syncDecisionRouteLayer();
    } else {
      const onLoad = () => {
        renderMarkers();
        syncDecisionRouteLayer();
      };
      map.once("styledata", onLoad);
      return () => {
        map.off("styledata", onLoad);
      };
    }
  }, [filtered, renderMarkers, styleIdx, syncDecisionRouteLayer]);

  const carouselData = decisionData
    ? {
        savingsGap: decisionData.savingsGap,
        economyStoresCount: decisionData.economyStoresCount,
        convenienceStoreName: decisionData.convenienceStoreName,
      }
    : null;

  return (
    <div className="h-screen bg-[#0f0f0f] relative overflow-hidden text-white">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55 pointer-events-none" />

      <SearchHeader />

      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
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
      </div>

      <DecisionCarousel decisionData={carouselData} />

      <FinancialSummaryFAB
        convenienceSavingsGap={decisionData?.savingsGap ?? 0}
        showConvenienceNudge={!!decisionData}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/75 bg-black/45 backdrop-blur-[10px] px-3 py-1 rounded-full z-20 shadow-sm">
        <span className="inline-flex items-center gap-1">
          <Target className="h-3.5 w-3.5" />
          Radar de Decisão
        </span>
        {" · "}
        {filtered.length} preço{filtered.length !== 1 ? "s" : ""} visíveis
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
};

export default MapaPrecos;
