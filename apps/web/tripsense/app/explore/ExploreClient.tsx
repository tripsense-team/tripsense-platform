"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VietMapMap = {
  addControl(control: unknown, position?: string): void;
  flyTo(options: { center: [number, number]; zoom: number; speed: number }): void;
  on(event: "load", listener: () => void): void;
  remove(): void;
};

type VietMapMarker = {
  addTo(map: VietMapMap): VietMapMarker;
  getElement(): HTMLElement;
  remove(): void;
  setLngLat(coordinates: [number, number]): VietMapMarker;
};

type VietMapPopup = {
  addTo(map: VietMapMap): VietMapPopup;
  on(event: "close", listener: () => void): unknown;
  remove?: () => void;
  setHTML(html: string): VietMapPopup;
  setLngLat(coordinates: [number, number]): VietMapPopup;
};

type VietMapGl = {
  Map: new (options: {
    center: [number, number];
    container: HTMLElement;
    style: string;
    zoom: number;
  }) => VietMapMap;
  Marker: new (options: { element: HTMLElement }) => VietMapMarker;
  NavigationControl: new () => unknown;
  Popup: new (options: {
    closeButton: boolean;
    closeOnClick: boolean;
    offset: number;
  }) => VietMapPopup;
};

type ProviderAvailability = {
  configured: boolean;
  status: string;
};

type ProviderIssue = {
  endpoint: string;
  httpStatus: number | null;
  message: string;
  providerMessage: string | null;
};

type MatchEvidence = {
  distanceMeters: number;
  nameSimilarity: number;
  categoryCompatible: boolean;
  localityCompatible: boolean;
};

type PlaceEnrichment = {
  enabled: boolean;
  status: string;
  externalPlaceId: string | null;
  confidence: number | null;
  evidence: MatchEvidence | null;
  image: {
    url: string | null;
    source: "OPENTRIPMAP" | "WIKIMEDIA" | "TRIPSENSE";
    attribution: string | null;
    confidence: number | null;
  } | null;
  description: string | null;
  detailUrl: string | null;
  wikipediaUrl: string | null;
  wikidataId: string | null;
  tourismKinds: string[];
  unavailableFields: string[];
  providerIssue: ProviderIssue | null;
};

type PlaceResult = {
  id: string;
  externalId: string;
  provider: "VIETMAP";
  name: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  enrichment: PlaceEnrichment;
};

type SearchResponse = {
  places: PlaceResult[];
  vietMap: ProviderAvailability;
  openTripMap: ProviderAvailability;
  wikimedia: ProviderAvailability;
};

const DA_NANG = { latitude: 16.0544, longitude: 108.2022 };
const DEFAULT_QUERY = "coffee";

export default function ExploreClient() {
  const apiGatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:8080";
  const tileKey = process.env.NEXT_PUBLIC_VIETMAP_TILE_KEY;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<VietMapMap | null>(null);
  const markerRefs = useRef<Map<string, VietMapMarker>>(new Map());
  const popupRef = useRef<VietMapPopup | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const enrichmentCacheRef = useRef<Map<string, PlaceEnrichment>>(new Map());
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<{
    vietMap: ProviderAvailability;
    openTripMap: ProviderAvailability;
    wikimedia: ProviderAvailability;
  } | null>(null);

  const selectedPlaceId = selectedPlace?.id ?? null;

  const searchPlaces = useCallback(
    async (searchQuery: string, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          lat: String(DA_NANG.latitude),
          lng: String(DA_NANG.longitude),
        });
        const response = await fetch(`${apiGatewayUrl}/api/places/search?${params}`, {
          signal,
        });
        if (!response.ok) {
          throw new Error(await providerErrorMessage(response));
        }
        const payload = (await response.json()) as SearchResponse;
        setPlaces(payload.places);
        setProviders({
          vietMap: payload.vietMap,
          openTripMap: payload.openTripMap,
          wikimedia: payload.wikimedia,
        });
        setSelectedPlace(null);
        closePopup(popupRef.current);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Place search failed.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [apiGatewayUrl],
  );

  const fetchEnrichment = useCallback(
    async (place: PlaceResult) => {
      const cached = enrichmentCacheRef.current.get(place.id);
      if (cached) {
        return cached;
      }
      const params = new URLSearchParams({
        name: place.name,
        address: place.address,
        category: place.category,
        lat: String(place.latitude),
        lng: String(place.longitude),
      });
      const response = await fetch(
        `${apiGatewayUrl}/api/places/${encodeURIComponent(place.externalId)}/enrichment?${params}`,
      );
      if (!response.ok) {
        throw new Error(await providerErrorMessage(response));
      }
      const enrichment = (await response.json()) as PlaceEnrichment;
      enrichmentCacheRef.current.set(place.id, enrichment);
      setPlaces((currentPlaces) =>
        currentPlaces.map((currentPlace) =>
          currentPlace.id === place.id ? { ...currentPlace, enrichment } : currentPlace,
        ),
      );
      setSelectedPlace((currentPlace) =>
        currentPlace?.id === place.id ? { ...currentPlace, enrichment } : currentPlace,
      );
      return enrichment;
    },
    [apiGatewayUrl],
  );

  const showPopup = useCallback(
    async (place: PlaceResult) => {
      if (!mapRef.current || !popupRef.current) {
        return;
      }
      let enrichment = place.enrichment;
      const cached = enrichmentCacheRef.current.get(place.id);
      if (cached) {
        enrichment = cached;
      } else {
        popupRef.current
          .setLngLat([place.longitude, place.latitude])
          .setHTML(popupHtml(place, enrichment, true))
          .addTo(mapRef.current);
      }
      if (!cached) {
        try {
          enrichment = await fetchEnrichment(place);
        } catch {
          enrichment = {
            ...PlaceEnrichmentDisabled,
            enabled: true,
            status: "PROVIDER_ERROR",
            image: { url: null, source: "TRIPSENSE", attribution: "TripSense fallback", confidence: null },
          };
        }
      }
      popupRef.current
        .setLngLat([place.longitude, place.latitude])
        .setHTML(popupHtml(place, enrichment, false))
        .addTo(mapRef.current);
    },
    [fetchEnrichment],
  );

  const openPlace = useCallback(
    (place: PlaceResult, scrollCard: boolean) => {
      setSelectedPlace(place);
      mapRef.current?.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 14,
        speed: 0.9,
      });
      if (scrollCard) {
        cardRefs.current.get(place.id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      void showPopup(place);
    },
    [showPopup],
  );

  useEffect(() => {
    let cancelled = false;
    const markers = markerRefs.current;

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current || !tileKey) {
        return;
      }
      const vietmapgl = await loadVietMap();
      if (cancelled || !mapContainerRef.current) {
        return;
      }

      const map = new vietmapgl.Map({
        container: mapContainerRef.current,
        style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${tileKey}`,
        center: [DA_NANG.longitude, DA_NANG.latitude],
        zoom: 12,
      });
      map.addControl(new vietmapgl.NavigationControl(), "top-right");
      map.on("load", () => setMapReady(true));
      mapRef.current = map;
      const popup = new vietmapgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 18,
      });
      popup.on("close", () => setSelectedPlace(null));
      popupRef.current = popup;
    }

    initMap();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      closePopup(popupRef.current);
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [tileKey]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    async function syncMarkers() {
      const vietmapgl = await loadVietMap();
      const visiblePlaceIds = new Set(places.map((place) => place.id));
      markerRefs.current.forEach((marker, placeId) => {
        if (!visiblePlaceIds.has(placeId)) {
          marker.remove();
          markerRefs.current.delete(placeId);
        }
      });

      places.forEach((place) => {
        const existingMarker = markerRefs.current.get(place.id);
        if (existingMarker) {
          existingMarker.setLngLat([place.longitude, place.latitude]);
          existingMarker.getElement().setAttribute("aria-label", place.name);
          return;
        }

        const markerElement = document.createElement("button");
        markerElement.type = "button";
        markerElement.className = markerClass(false);
        markerElement.setAttribute("aria-label", place.name);

        markerElement.addEventListener("mouseenter", () => {
          setHoveredPlaceId(place.id);
        });
        markerElement.addEventListener("mouseleave", () => {
          setHoveredPlaceId(null);
        });
        markerElement.addEventListener("click", () => openPlace(place, true));

        const marker = new vietmapgl.Marker({ element: markerElement })
          .setLngLat([place.longitude, place.latitude])
          .addTo(mapRef.current!);
        markerRefs.current.set(place.id, marker);
      });
    }

    void syncMarkers();
  }, [mapReady, openPlace, places]);

  useEffect(() => {
    markerRefs.current.forEach((marker, placeId) => {
      const element = marker.getElement();
      element.className = markerClass(placeId === selectedPlaceId || placeId === hoveredPlaceId);
    });
  }, [selectedPlaceId, hoveredPlaceId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setPlaces([]);
        setError(null);
        return;
      }
      void searchPlaces(query, controller.signal);
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, searchPlaces]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f5f2] text-[#17211d]">
      <header className="border-b border-[#d8ded7] bg-white/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f7d68]">
              TripSense Explore POC
            </p>
            <h1 className="text-2xl font-semibold">Da Nang place discovery</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#526157]">
            <ProviderBadge label="VietMap" status={providers?.vietMap.status ?? "WAITING"} />
            <ProviderBadge label="OpenTripMap" status={providers?.openTripMap?.status ?? "WAITING"} />
            <ProviderBadge label="Wikimedia" status={providers?.wikimedia?.status ?? "WAITING"} />
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(320px,45vh)_minmax(360px,1fr)] md:grid-cols-[minmax(320px,40%)_minmax(0,60%)] md:grid-rows-1">
        <aside className="order-2 flex min-h-0 flex-col border-t border-[#d8ded7] bg-[#fbfaf7] md:order-1 md:border-r md:border-t-0">
          <div className="border-b border-[#d8ded7] p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#637169]" htmlFor="place-search">
              Search
            </label>
            <input
              className="mt-2 h-12 w-full rounded-md border border-[#cdd5ce] bg-white px-4 text-base outline-none transition focus:border-[#2f7d68] focus:ring-2 focus:ring-[#2f7d68]/20"
              id="place-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="coffee, beach, restaurant..."
              value={query}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-[#637169]">
              <span>{loading ? "Searching real provider data..." : `${places.length} places`}</span>
              <span>Centered on Da Nang</span>
            </div>
            {error ? (
              <p className="mt-3 rounded-md border border-[#e0bbb3] bg-[#fff4f1] px-3 py-2 text-sm text-[#9b3725]">
                {error}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!loading && places.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#cbd4ce] bg-white p-6 text-sm text-[#637169]">
                Search for a place type to validate VietMap results and marker rendering.
              </div>
            ) : null}
            <div className="space-y-3">
              {places.map((place) => (
                <button
                  className={`w-full rounded-md border bg-white p-4 text-left shadow-sm transition ${
                    selectedPlaceId === place.id
                      ? "border-[#2f7d68] ring-2 ring-[#2f7d68]/20"
                      : "border-[#dde3dd] hover:border-[#91b8a9]"
                  }`}
                  key={place.id}
                  onClick={() => openPlace(place, false)}
                  onMouseEnter={() => {
                    setHoveredPlaceId(place.id);
                  }}
                  onMouseLeave={() => setHoveredPlaceId(null)}
                  ref={(node) => {
                    if (node) {
                      cardRefs.current.set(place.id, node);
                    } else {
                      cardRefs.current.delete(place.id);
                    }
                  }}
                  type="button"
                >
                  <div className="flex gap-3">
                    <FallbackPhoto enrichment={place.enrichment} />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold">{place.name}</h2>
                      <p className="mt-1 text-sm text-[#637169]">{place.category}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-[#4d5a53]">{place.address}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#637169]">
                        <span>{Math.round(place.distanceMeters)} m</span>
                        {place.enrichment.image?.source ? <span>{place.enrichment.image.source}</span> : null}
                        {place.enrichment.description ? <span>Description</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="order-1 relative min-h-[320px] overflow-hidden bg-[#dbe4dc] md:order-2">
          {!tileKey ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white p-6 text-center text-sm text-[#9b3725]">
              NEXT_PUBLIC_VIETMAP_TILE_KEY is not configured.
            </div>
          ) : null}
          <div className="h-full w-full" ref={mapContainerRef} />
          {!mapReady && tileKey ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#eef2ed]/80 text-sm font-medium text-[#526157]">
              Loading VietMap...
            </div>
          ) : null}
          {selectedPlace ? (
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-md border border-[#d8ded7] bg-white/95 p-3 shadow-lg backdrop-blur md:left-auto md:w-80">
              <p className="truncate text-sm font-semibold">{selectedPlace.name}</p>
              <p className="mt-1 truncate text-xs text-[#637169]">{selectedPlace.address}</p>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

async function loadVietMap(): Promise<VietMapGl> {
  return (await import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js")) as unknown as VietMapGl;
}

const PlaceEnrichmentDisabled: PlaceEnrichment = {
  enabled: false,
  status: "DISABLED",
  externalPlaceId: null,
  confidence: null,
  evidence: null,
  image: null,
  description: null,
  detailUrl: null,
  wikipediaUrl: null,
  wikidataId: null,
  tourismKinds: [],
  unavailableFields: [],
  providerIssue: null,
};

function ProviderBadge({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-md border border-[#d8ded7] bg-[#fbfaf7] px-3 py-2">
      <span className="font-semibold text-[#17211d]">{label}</span>
      <span className="ml-2">{status}</span>
    </div>
  );
}

function closePopup(popup: VietMapPopup | null) {
  if (popup && typeof popup.remove === "function") {
    popup.remove();
  }
}

function FallbackPhoto({ enrichment }: { enrichment: PlaceEnrichment }) {
  const image = enrichment.image;
  if (image?.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="h-20 w-24 rounded-md object-cover"
        src={image.url}
      />
    );
  }
  return (
    <div className="grid h-20 w-24 shrink-0 place-items-center rounded-md bg-[#dbe4dc] text-xs font-semibold text-[#587164]">
      TripSense
    </div>
  );
}

function markerClass(active: boolean) {
  return [
    "grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-lg transition",
    active ? "bg-[#e05132] scale-125" : "bg-[#2f7d68]",
  ].join(" ");
}

function popupHtml(place: PlaceResult, enrichment: PlaceEnrichment, loading: boolean) {
  const photo = enrichment.image?.url;
  const imageSource = enrichment.image?.source && enrichment.image.source !== "TRIPSENSE"
    ? `<span>${escapeHtml(enrichment.image.source)}</span>`
    : "";
  const distance = `<span>${formatDistance(place.distanceMeters)} away</span>`;
  const description = enrichment.description
    ? `<p class="ts-popup-description">${escapeHtml(shortDescription(enrichment.description))}</p>`
    : "";
  const issue = enrichment.providerIssue
    ? `<p class="ts-popup-muted">${escapeHtml(enrichment.providerIssue.message)}</p>`
    : "";
  const skeleton = loading
    ? `<div class="ts-popup-skeleton"><span></span><span></span></div>`
    : "";

  return `
    <div class="ts-popup">
      ${
        photo
          ? `<img class="ts-popup-image" src="${escapeAttribute(photo)}" alt="" />`
          : `<div class="ts-popup-fallback">TripSense</div>`
      }
      <div class="ts-popup-body">
        <h3>${escapeHtml(place.name)}</h3>
        <p>${escapeHtml(place.category)}</p>
        <div class="ts-popup-meta">${imageSource}${distance}</div>
        <p class="ts-popup-address">${escapeHtml(shortAddress(place.address))}</p>
        ${description}
        ${skeleton}
        ${issue}
        <button class="ts-popup-button" type="button">View place</button>
      </div>
    </div>
  `;
}

async function providerErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? `Provider request failed with HTTP ${response.status}.`;
  } catch {
    return `Provider request failed with HTTP ${response.status}.`;
  }
}

function shortAddress(address: string) {
  return address.length > 82 ? `${address.slice(0, 79)}...` : address;
}

function shortDescription(description: string) {
  return description.length > 180 ? `${description.slice(0, 177)}...` : description;
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
