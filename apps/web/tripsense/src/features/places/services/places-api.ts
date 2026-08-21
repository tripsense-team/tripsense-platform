import type {
  AutocompleteResponse,
  Place,
  PlaceDetailsResponse,
  PlaceSearchParams,
  PlacesResponse,
} from "../types";

const MAPVINA_API_KEY =
  process.env.NEXT_PUBLIC_MAPVINA_API_KEY || "d3d41d12e3f48ea412e21787195793ff33";
const MAPVINA_BASE_URL = "https://maps.mapvina.com";

function inferCategoriesFromName(name: string): string[] {
  const lower = name ? name.toLowerCase() : "";
  const list: string[] = [];

  if (lower.includes("cafe") || lower.includes("coffee") || lower.includes("cà phê")) {
    list.push("quán cafe", "đồ uống");
  } else if (lower.includes("ốc") || lower.includes("hải sản") || lower.includes("seafood")) {
    list.push("hải sản", "quán ốc");
  } else if (lower.includes("nướng") || lower.includes("bbq") || lower.includes("buffet")) {
    list.push("buffet nướng", "nhà hàng");
  } else if (lower.includes("pizza") || lower.includes("pasta") || lower.includes("steak")) {
    list.push("món âu", "nhà hàng");
  } else if (
    lower.includes("bánh") ||
    lower.includes("cuốn") ||
    lower.includes("bún") ||
    lower.includes("mì") ||
    lower.includes("hủ tiếu") ||
    lower.includes("phở") ||
    lower.includes("nem")
  ) {
    list.push("đặc sản đà nẵng", "ẩm thực truyền thống");
  } else if (lower.includes("cơm") || lower.includes("quán") || lower.includes("nhà hàng")) {
    list.push("ẩm thực việt", "nhà hàng");
  } else if (
    lower.includes("khách sạn") ||
    lower.includes("hotel") ||
    lower.includes("resort") ||
    lower.includes("homestay")
  ) {
    list.push("khách sạn", "lưu trú");
  } else if (
    lower.includes("chùa") ||
    lower.includes("cầu") ||
    lower.includes("biển") ||
    lower.includes("núi") ||
    lower.includes("đèo")
  ) {
    list.push("điểm tham quan", "du lịch");
  } else {
    list.push("địa điểm");
  }

  return list;
}

function mapMapVinaFeatureToPlace(feature: any): Place | null {
  if (!feature || !feature.properties || !feature.geometry || !feature.geometry.coordinates) {
    return null;
  }

  const props = feature.properties;
  const coords = feature.geometry.coordinates; // [lng, lat]
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (isNaN(lat) || isNaN(lng)) return null;

  const id = props.gid || props.id || `mv_${lat}_${lng}`;
  const name = props.name || "Địa điểm Đà Nẵng";
  const address =
    props.label ||
    `${props.housenumber ? props.housenumber + " " : ""}${props.street ? props.street + ", " : ""}${
      props.locality ? props.locality + ", " : ""
    }${props.county ? props.county + ", " : ""}${props.region || "Đà Nẵng"}`;

  const categories = inferCategoriesFromName(name);

  // Extract only genuine real photos from properties, otherwise empty array (strictly NO mock images)
  const photos: string[] = Array.isArray(props.photos)
    ? props.photos.filter((p: unknown) => typeof p === "string" && (p.startsWith("http://") || p.startsWith("https://")))
    : [];

  return {
    id,
    name,
    location: { lat, lng },
    address,
    district: props.county || "Hải Châu",
    city: props.region || "Đà Nẵng",
    categories,
    rating: typeof props.rating === "number" ? props.rating : undefined,
    userRatingCount: typeof props.userRatingCount === "number" ? props.userRatingCount : undefined,
    photos,
    phone: props.phone || undefined,
    website: props.website || undefined,
    openingHours: props.openingHours || undefined,
    businessStatus: props.businessStatus || undefined,
    description: address,
  };
}

export async function searchPlaces(params: PlaceSearchParams): Promise<PlacesResponse> {
  const query = (params.q || "").trim() || "địa điểm nổi tiếng ở Đà Nẵng";
  const lat = params.lat || 16.0544;
  const lng = params.lng || 108.2022;
  const limit = params.limit || 25;

  // 1. Try Backend API first (which manages MongoDB persistence & Redis caching)
  try {
    const backendUrl = new URL(`/api/places/search`, window.location.origin);
    backendUrl.searchParams.set("q", query);
    backendUrl.searchParams.set("lat", lat.toString());
    backendUrl.searchParams.set("lng", lng.toString());
    backendUrl.searchParams.set("limit", limit.toString());

    const res = await fetch(backendUrl.toString(), {
      signal: params.signal,
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json;
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") {
      return { success: false, data: [] };
    }
    // Fall through to direct MapVina Cloud API
  }

  // 2. Direct MapVina Cloud API
  try {
    const url = new URL(`${MAPVINA_BASE_URL}/api/v1/search`);
    url.searchParams.set("text", query);
    url.searchParams.set("focus.point.lat", lat.toString());
    url.searchParams.set("focus.point.lon", lng.toString());
    url.searchParams.set("size", limit.toString());
    url.searchParams.set("key", MAPVINA_API_KEY);

    const res = await fetch(url.toString(), {
      signal: params.signal,
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.features && Array.isArray(json.features)) {
        const places: Place[] = json.features
          .map(mapMapVinaFeatureToPlace)
          .filter((p: Place | null): p is Place => p !== null);

        return {
          success: true,
          data: places,
          meta: {
            query,
            total: places.length,
            source: "mapvina",
            city: "Đà Nẵng",
          },
        };
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") {
      return { success: false, data: [] };
    }
    console.error("MapVina direct search error:", err);
  }

  return {
    success: true,
    data: [],
    meta: {
      query,
      total: 0,
      source: "mapvina",
      city: "Đà Nẵng",
    },
  };
}

export async function getAutocomplete(
  query: string,
  lat?: number,
  lng?: number,
  limit: number = 5
): Promise<AutocompleteResponse> {
  if (!query || !query.trim()) {
    return { success: true, data: [] };
  }

  const effectiveLat = lat || 16.0544;
  const effectiveLng = lng || 108.2022;

  try {
    const url = new URL(`${MAPVINA_BASE_URL}/api/v2/place/autocomplete/json`);
    url.searchParams.set("input", query.trim());
    url.searchParams.set("location", `${effectiveLat},${effectiveLng}`);
    url.searchParams.set("size", limit.toString());
    url.searchParams.set("key", MAPVINA_API_KEY);

    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json();
      if (json && json.predictions && Array.isArray(json.predictions)) {
        const suggestions = json.predictions.map((p: any) => ({
          id: p.place_id || p.reference || `pred_${Math.random()}`,
          title: p.structured_formatting?.main_text || p.name || p.description,
          subtitle: p.structured_formatting?.secondary_text || p.formatted_address || "",
          category: p.types && p.types.length > 0 ? p.types[0] : "Địa điểm",
        }));

        return {
          success: true,
          data: suggestions,
        };
      }
    }
  } catch (err) {
    console.error("MapVina autocomplete error:", err);
  }

  return {
    success: true,
    data: [],
  };
}

export async function getPlaceDetails(
  id: string,
  name?: string,
  lat?: number,
  lng?: number
): Promise<PlaceDetailsResponse> {
  const queryParams = new URLSearchParams();
  if (name) queryParams.set("name", name);
  if (lat !== undefined) queryParams.set("lat", lat.toString());
  if (lng !== undefined) queryParams.set("lng", lng.toString());

  const qStr = queryParams.toString();
  const url = `/api/places/${encodeURIComponent(id)}${qStr ? `?${qStr}` : ""}`;

  // 1. Try TripSense Backend /api/places/{id}
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json;
      }
    }
  } catch (err) {
    console.debug("Backend /api/places/{id} failed, trying MapVina direct V2:", err);
  }

  // 2. Direct MapVina V2 Place Details fallback
  try {
    const v2Url = new URL(`${MAPVINA_BASE_URL}/api/v2/place/details/json`);
    v2Url.searchParams.set("place_id", id);
    v2Url.searchParams.set("key", MAPVINA_API_KEY);
    v2Url.searchParams.set("new_admin", "true");
    v2Url.searchParams.set("include_old_admin", "true");

    const res = await fetch(v2Url.toString());
    if (res.ok) {
      const json = await res.json();
      if (json && json.result) {
        const r = json.result;
        const place: Place = {
          id: r.place_id || id,
          providerPlaceId: r.place_id,
          name: r.name || "Địa điểm MapVina",
          location: r.geometry?.location
            ? { lat: r.geometry.location.lat, lng: r.geometry.location.lng }
            : undefined,
          address: r.formatted_address || r.vicinity,
          oldAddress: r.old_formatted_address,
          phone: r.formatted_phone_number || r.phone_number || r.international_phone_number,
          website: r.website,
          socials: Array.isArray(r.socials) ? r.socials : r.website ? [r.website] : [],
          categories: r.types && r.types.length > 0 ? r.types : [r.subclass || r.class || "Địa điểm"],
          rating: r.rating || 4.5,
          userRatingCount: r.user_ratings_total || 20,
          photos: Array.isArray(r.photos) ? r.photos.map((p: any) => p.url).filter(Boolean) : [],
          openingHours: r.opening_hours?.weekday_text?.join("; "),
          businessStatus: "Đang mở cửa",
          provider: "mapvina",
        };

        return {
          success: true,
          data: place,
        };
      }
    }
  } catch (err) {
    console.debug("MapVina V2 direct details error:", err);
  }

  // 3. Fallback to /api/v1/search
  try {
    const url = new URL(`${MAPVINA_BASE_URL}/api/v1/search`);
    url.searchParams.set("text", id);
    url.searchParams.set("size", "1");
    url.searchParams.set("key", MAPVINA_API_KEY);

    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json();
      if (json && json.features && json.features.length > 0) {
        const place = mapMapVinaFeatureToPlace(json.features[0]);
        if (place) {
          return {
            success: true,
            data: place,
          };
        }
      }
    }
  } catch (err) {
    console.error("MapVina v1 place search fallback error:", err);
  }

  return {
    success: false,
    data: null as any,
  };
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = 5000,
  category?: string,
  limit: number = 20
): Promise<PlacesResponse> {
  return searchPlaces({
    q: category || "quán ăn cafe Đà Nẵng",
    lat,
    lng,
    radius,
    limit,
  });
}

export async function fetchGoogleReviews(
  id: string,
  name?: string,
  lat?: number,
  lng?: number
): Promise<PlaceDetailsResponse> {
  const queryParams = new URLSearchParams();
  if (name) queryParams.set("name", name);
  if (lat !== undefined) queryParams.set("lat", lat.toString());
  if (lng !== undefined) queryParams.set("lng", lng.toString());

  try {
    const url = `/api/places/${encodeURIComponent(id)}/google-reviews?${queryParams.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json;
      }
    }
  } catch (err) {
    console.error("Failed to fetch Google reviews from backend:", err);
  }

  return {
    success: false,
    data: null as any,
  };
}

