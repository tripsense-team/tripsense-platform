import type { Place } from "@/features/places/types";
import { isValidCoordinate } from "@/features/trip-management/utils/map";

export interface MapStyleLayerLike {
  id?: string;
  type?: string;
  "source-layer"?: string;
  sourceLayer?: string;
}

const PROTECTED_GEO_LAYER_RE =
  /(^|[-_.:/])(place|city|town|village|hamlet|suburb|quarter|neighbourhood|neighborhood|district|province|state|country|continent|capital|settlement|admin|boundary|road|street|highway|motorway|trunk|bridge|path|shield|water|marine|ocean|sea|bay|river|lake|canal|park|landuse|landcover)([-_.:/]|$)/i;

const BUILT_IN_POI_LAYER_RE =
  /(^|[-_.:/])(poi|pois|amenity|shop|shops|store|restaurant|cafe|hotel|lodging|hospital|school|bank|atm|fuel|parking|museum|tourism|attraction|transit|bus|train|subway|rail|airport|aerodrome|maki|housenumber)([-_.:/\d]|$)/i;

const POI_SOURCE_LAYERS = new Set([
  "poi",
  "poi_label",
  "aerodrome_label",
  "transit",
  "housenumber",
]);

/**
 * Determines whether a MapVina vector style layer represents a built-in POI/transit icon
 * that should be hidden in Clean Mindtrip mode while preserving city/district/road/water labels.
 */
export function shouldHideBuiltInMapLayer(layer: MapStyleLayerLike): boolean {
  const layerId = String(layer.id || "");
  const sourceLayer = String(layer["source-layer"] || layer.sourceLayer || "").toLowerCase();
  const type = String(layer.type || "").toLowerCase();

  // Base polygons, roads, water lines, and raster tiles must remain visible.
  if (type && type !== "symbol" && type !== "circle") {
    return false;
  }

  // Always preserve settlement, administrative, road, park, and water labels.
  if (
    sourceLayer === "place" ||
    sourceLayer === "transportation_name" ||
    sourceLayer === "water_name" ||
    PROTECTED_GEO_LAYER_RE.test(layerId)
  ) {
    return false;
  }

  return POI_SOURCE_LAYERS.has(sourceLayer) || BUILT_IN_POI_LAYER_RE.test(layerId);
}

/**
 * Filters places that have finite non-zero coordinates suitable for map plotting.
 */
export function hasValidPlaceLocation(
  place: Place,
): place is Place & { location: { lat: number; lng: number } } {
  return Boolean(
    place.location && isValidCoordinate(place.location.lat, place.location.lng),
  );
}

/**
 * Coordinates what happens when a user directly clicks a plotted marker:
 * opens Place Detail directly without showing the floating map popup when
 * `openDetailsOnMarkerClick` is enabled (AI Chat ZioMap), or selects the marker
 * popup on `/places`.
 */
export function dispatchMapMarkerClick(params: {
  place: Place;
  openDetailsOnMarkerClick?: boolean;
  onSelectPlace?: (id: string | null) => void;
  onViewDetails?: (place: Place) => void;
}): void {
  if (params.openDetailsOnMarkerClick && params.onViewDetails) {
    params.onViewDetails(params.place);
    return;
  }
  params.onSelectPlace?.(params.place.id);
}
