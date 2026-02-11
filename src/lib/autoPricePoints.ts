import { supabase } from "@/integrations/supabase/client";

interface TransactionItem {
  descricao: string;
  quantidade?: number;
  valor_total: number;
}

/**
 * After saving a transaction, auto-create price_points from items + geolocation.
 * Uses browser geolocation; if unavailable, skips silently.
 */
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

  // Try to get current position
  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300000, // 5 min cache
      });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch {
    // No geolocation available – skip creating price points
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
