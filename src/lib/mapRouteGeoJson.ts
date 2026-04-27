/** GeoJSON Feature + LineString compatible with MapLibre GeoJSONSource */
export type RouteLineStringFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: Record<string, never>;
};

/**
 * Builds a GeoJSON LineString feature from an ordered list of [lng, lat] coordinates.
 * Use with Mapbox/MapLibre line layers; swap `coordinates` for a Directions API polyline when integrated.
 */
export function buildRouteLineStringFeature(
  coordinates: [number, number][]
): RouteLineStringFeature | null {
  const valid = coordinates.filter(
    (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1])
  ) as [number, number][];

  if (valid.length < 2) return null;

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: valid,
    },
    properties: {},
  };
}
