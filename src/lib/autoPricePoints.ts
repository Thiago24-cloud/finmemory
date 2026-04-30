import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "@/integrations/supabase/client";

interface TransactionItem {
  descricao: string;
  quantidade?: number;
  valor_total: number;
}

export async function createPricePointsFromTransaction({
  userId,
  storeName,
  category,
  items,
}: {
  userId: string;
  storeName: string;
  category: string;
  items: TransactionItem[];
}) {
  if (!items.length || !storeName) return;

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.requestPermissions();
      if (
        permission.location !== "granted" &&
        permission.coarseLocation !== "granted"
      ) {
        console.log("Geolocation permission denied, skipping price point creation");
        return;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } else {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 300000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {
    console.log("Geolocation unavailable, skipping price point creation");
    return;
  }

  const points = items
    .filter((item) => item.descricao && item.valor_total > 0)
    .map((item) => ({
      user_id: userId,
      store_name: storeName,
      product_name: item.descricao,
      price: item.valor_total / (item.quantidade || 1),
      lat,
      lng,
      category: category || "Outros",
    }));

  if (points.length === 0) return;

  const { error } = await supabase.from("price_points").insert(points);
  if (error) {
    console.error("Error creating price points:", error);
  }
}
