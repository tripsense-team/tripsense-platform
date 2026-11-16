import type {
  ChatMessage,
  PlaceSearchResult,
  TripProposal,
} from "@/lib/types";
import type { Place } from "@/features/places/types";
import type { DestinationMapPin } from "@/features/map/types";
import type { ItineraryResponse, TripResponse } from "@/features/trip-management/types";
import {
  getDestinationCenter,
  inferDestinationFromPrompt,
  isValidCoordinate,
} from "@/features/trip-management/utils/map";
import { normalizeSearchText } from "@/features/trip-management/utils/search";

export interface ExtractAiChatMapDataParams {
  messages: ChatMessage[];
  activeTrip?: TripResponse | null;
  itinerary?: ItineraryResponse | null;
  placeSnapshots?: Record<string, Place>;
  selectedDayNumber?: number | null;
  selectedWhere?: string | null;
}

export interface AiChatMapData {
  places: Place[];
  dayNumbers: number[];
  missingPlaceIds: string[];
  resolvedDestination: string | null;
  destinationPin: DestinationMapPin | null;
  weatherText: string | undefined;
  placesSignature: string;
}

type ToolLikePart = {
  type?: string;
  text?: string;
  output?: unknown;
  result?: unknown;
  input?: Record<string, unknown>;
  toolInvocation?: {
    toolName?: string;
    result?: unknown;
    args?: Record<string, unknown>;
  };
};

function unwrapToolPayload(part: ToolLikePart): {
  toolName?: string;
  output?: unknown;
  input?: Record<string, unknown>;
} {
  const toolName =
    typeof part.type === "string" && part.type.startsWith("tool-")
      ? part.type.slice(5)
      : part.toolInvocation?.toolName;
  const output = part.output ?? part.result ?? part.toolInvocation?.result;
  const input = part.input ?? part.toolInvocation?.args;
  return { toolName, output, input };
}

function isRealCatalogId(id?: string | null): id is string {
  if (!id) return false;
  const trimmed = id.trim();
  return Boolean(trimmed && !trimmed.startsWith("fallback-") && !trimmed.startsWith("destination-"));
}

function fromSearchResult(
  raw: PlaceSearchResult,
  snapshots: Record<string, Place>,
): { place: Place; missingId?: string } {
  const snapshot = isRealCatalogId(raw.id) ? snapshots[raw.id] : undefined;
  const location =
    raw.location && isValidCoordinate(raw.location.lat, raw.location.lng)
      ? raw.location
      : snapshot?.location && isValidCoordinate(snapshot.location.lat, snapshot.location.lng)
        ? snapshot.location
        : undefined;

  const place: Place = {
    id: raw.id || snapshot?.id || raw.name,
    providerPlaceId: snapshot?.providerPlaceId ?? raw.id,
    name: snapshot?.name || raw.name,
    address: raw.address || snapshot?.address,
    city: raw.city || snapshot?.city,
    categories:
      Array.isArray(raw.categories) && raw.categories.length > 0
        ? raw.categories
        : snapshot?.categories || ["ATTRACTION"],
    location,
    rating: raw.rating ?? snapshot?.rating,
    userRatingCount: snapshot?.userRatingCount,
    photos: raw.photoUrl ? [raw.photoUrl] : snapshot?.photos || [],
    primaryPhoto: snapshot?.primaryPhoto,
    media: snapshot?.media,
    phone: raw.phone || snapshot?.phone,
    website: snapshot?.website,
    openingHours: snapshot?.openingHours,
    description: raw.reason || snapshot?.description,
  };

  return {
    place,
    missingId: !location && isRealCatalogId(raw.id) ? raw.id.trim() : undefined,
  };
}

function extractMessageTextContent(message: ChatMessage): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p && (p as ToolLikePart).type === "text" && typeof (p as ToolLikePart).text === "string")
      .map((p) => (p as ToolLikePart).text || "")
      .join(" ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .trim();
  }
  const legacyContent = (message as { content?: unknown }).content;
  return typeof legacyContent === "string"
    ? legacyContent.replace(/<!--[\s\S]*?-->/g, " ").trim()
    : "";
}

function formatWeatherSummary(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || "error" in payload) return undefined;
  const data = payload as {
    cityName?: unknown;
    current?: { temperature_2m?: unknown };
    current_units?: { temperature_2m?: unknown };
  };
  if (typeof data.current?.temperature_2m !== "number") return undefined;
  const temp = Math.round(data.current.temperature_2m);
  const unit =
    typeof data.current_units?.temperature_2m === "string"
      ? data.current_units.temperature_2m
      : "°C";
  const city = typeof data.cityName === "string" && data.cityName.trim() ? ` · ${data.cityName.trim()}` : "";
  return `${temp}${unit}${city}`;
}

function pushUniquePlace(
  target: Place[],
  seenKeys: Set<string>,
  place: Place,
) {
  if (!place.location || !isValidCoordinate(place.location.lat, place.location.lng)) {
    return;
  }
  const idKey = isRealCatalogId(place.id) ? `id:${place.id}` : null;
  const coordKey = `geo:${normalizeSearchText(place.name).trim()}::${place.location.lat.toFixed(4)},${place.location.lng.toFixed(4)}`;
  if ((idKey && seenKeys.has(idKey)) || seenKeys.has(coordKey)) {
    return;
  }
  if (idKey) seenKeys.add(idKey);
  seenKeys.add(coordKey);
  target.push(place);
}

/**
 * Extracts ONLY places explicitly returned by AI user-facing tools or saved on the linked itinerary.
 * Never surfaces raw background candidate pools (`prepareTripCandidates`) or base-map POIs.
 */
export function extractAiChatMapData({
  messages,
  activeTrip,
  itinerary,
  placeSnapshots = {},
  selectedDayNumber = null,
  selectedWhere,
}: ExtractAiChatMapDataParams): AiChatMapData {
  let latestProposal: TripProposal | null = null;
  let toolDestination: string | null = null;
  let weatherText: string | undefined;

  const standaloneAiPlaces: PlaceSearchResult[] = [];
  const proposalLocationsByItemKey = new Map<string, { lat: number; lng: number }>();
  const proposalLocationsByTitle = new Map<string, { lat: number; lng: number }>();
  const missingIds = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.parts)) continue;

    let msgHasProposal = false;
    const msgRecommend: PlaceSearchResult[] = [];
    const msgSearch: PlaceSearchResult[] = [];

    for (const rawPart of msg.parts) {
      const part = rawPart as ToolLikePart;
      const { toolName, output, input } = unwrapToolPayload(part);
      if (!toolName) continue;

      if (toolName === "getWeather") {
        const formatted = formatWeatherSummary(output);
        if (formatted) weatherText = formatted;
        continue;
      }

      if (toolName === "createTripProposal") {
        msgHasProposal = true;
        const prop = output as TripProposal | undefined;
        if (prop?.destination) toolDestination = prop.destination;
        if (typeof input?.destination === "string" && input.destination.trim()) {
          toolDestination = input.destination.trim();
        }
        if (prop && Array.isArray(prop.days)) {
          latestProposal = prop;
          for (const day of prop.days) {
            for (const act of day.activities || []) {
              if (act.location && isValidCoordinate(act.location.lat, act.location.lng)) {
                if (act.itemKey) {
                  proposalLocationsByItemKey.set(act.itemKey, act.location);
                }
                if (act.title) {
                  proposalLocationsByTitle.set(normalizeSearchText(act.title).trim(), act.location);
                }
              }
            }
          }
        }
        continue;
      }

      if (toolName === "recommendPlaces") {
        const out = output as { destination?: string; places?: PlaceSearchResult[] } | undefined;
        if (out?.destination) toolDestination = out.destination;
        if (Array.isArray(out?.places)) {
          msgRecommend.push(...out.places);
        }
        continue;
      }

      if (toolName === "searchPlaces") {
        const out = output as { places?: PlaceSearchResult[] } | undefined;
        if (Array.isArray(out?.places)) {
          msgSearch.push(...out.places);
        }
      }
      // Explicitly ignore `prepareTripCandidates` and `updateTripPlanningBrief` raw candidates.
    }

    if (msgRecommend.length > 0) {
      standaloneAiPlaces.push(...msgRecommend);
    } else if (!msgHasProposal && msgSearch.length > 0) {
      standaloneAiPlaces.push(...msgSearch);
    }
  }

  // Fallback destination inference from latest user prompt when Where/Trip are empty
  let inferredUserDestination: string | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== "user") continue;
    const text = extractMessageTextContent(messages[i]);
    const match = inferDestinationFromPrompt(text);
    if (match) {
      inferredUserDestination = match;
      break;
    }
  }

  const resolvedDestination =
    activeTrip?.destinationName?.trim() ||
    selectedWhere?.trim() ||
    toolDestination?.trim() ||
    inferredUserDestination ||
    null;

  const destinationPin: DestinationMapPin | null = resolvedDestination
    ? (() => {
        const [lng, lat] = getDestinationCenter(resolvedDestination);
        return { name: resolvedDestination, lat, lng };
      })()
    : null;

  const collectedPlaces: Place[] = [];
  const seenKeys = new Set<string>();
  const dayNumbersSet = new Set<number>();

  const hasSavedItineraryItems = Boolean(
    itinerary?.days?.some((day) => Array.isArray(day.items) && day.items.length > 0),
  );

  if (hasSavedItineraryItems && itinerary?.days) {
    for (const day of itinerary.days) {
      dayNumbersSet.add(day.dayNumber);
      if (selectedDayNumber !== null && day.dayNumber !== selectedDayNumber) {
        continue;
      }
      for (const item of day.items || []) {
        const placeKey = item.placeRef?.trim() || undefined;
        const snapshot = placeKey ? placeSnapshots[placeKey] : undefined;

        const location = isValidCoordinate(item.latSnapshot, item.lngSnapshot)
          ? { lat: item.latSnapshot as number, lng: item.lngSnapshot as number }
          : snapshot?.location && isValidCoordinate(snapshot.location.lat, snapshot.location.lng)
            ? snapshot.location
            : (item.sourceItemKey && proposalLocationsByItemKey.get(item.sourceItemKey)) ||
              proposalLocationsByTitle.get(normalizeSearchText(item.title).trim());

        if (!location && isRealCatalogId(placeKey) && !snapshot) {
          missingIds.add(placeKey);
        }

        if (location) {
          pushUniquePlace(collectedPlaces, seenKeys, {
            id: item.id,
            providerPlaceId: placeKey,
            name: item.title,
            address:
              item.placeAddressSnapshot ||
              snapshot?.address ||
              item.placeNameSnapshot ||
              resolvedDestination ||
              undefined,
            location,
            categories: snapshot?.categories?.length ? snapshot.categories : [item.type],
            rating: snapshot?.rating,
            userRatingCount: snapshot?.userRatingCount,
            photos: snapshot?.photos || [],
            primaryPhoto: snapshot?.primaryPhoto,
            media: snapshot?.media,
            phone: snapshot?.phone,
            website: snapshot?.website,
            openingHours: snapshot?.openingHours,
            description: item.notes || snapshot?.description,
          });
        }
      }
    }
  } else if (latestProposal?.days?.length) {
    for (const day of latestProposal.days) {
      dayNumbersSet.add(day.dayNumber);
      if (selectedDayNumber !== null && day.dayNumber !== selectedDayNumber) {
        continue;
      }
      for (const act of day.activities || []) {
        const placeKey = act.placeId?.trim();
        const snapshot = isRealCatalogId(placeKey) ? placeSnapshots[placeKey] : undefined;
        const location =
          act.location && isValidCoordinate(act.location.lat, act.location.lng)
            ? act.location
            : snapshot?.location && isValidCoordinate(snapshot.location.lat, snapshot.location.lng)
              ? snapshot.location
              : undefined;

        if (!location && isRealCatalogId(placeKey) && !snapshot) {
          missingIds.add(placeKey);
        }

        if (location) {
          pushUniquePlace(collectedPlaces, seenKeys, {
            id: placeKey || act.itemKey,
            providerPlaceId: placeKey,
            name: act.title,
            address: act.address || snapshot?.address || resolvedDestination || undefined,
            location,
            categories: act.category ? [act.category] : snapshot?.categories || ["ATTRACTION"],
            rating: snapshot?.rating,
            userRatingCount: snapshot?.userRatingCount,
            photos: act.photoUrl ? [act.photoUrl] : snapshot?.photos || [],
            primaryPhoto: snapshot?.primaryPhoto,
            media: snapshot?.media,
            phone: snapshot?.phone,
            website: snapshot?.website,
            openingHours: snapshot?.openingHours,
            description: act.description || snapshot?.description,
          });
        }
      }
    }
  }

  // In "All Days" / discovery mode, include curated places recommended directly in chat
  if (selectedDayNumber === null) {
    for (const raw of standaloneAiPlaces) {
      const { place, missingId } = fromSearchResult(raw, placeSnapshots);
      if (missingId && !placeSnapshots[missingId]) {
        missingIds.add(missingId);
      }
      pushUniquePlace(collectedPlaces, seenKeys, place);
    }
  }

  const dayNumbers = Array.from(dayNumbersSet).sort((a, b) => a - b);
  const placesSignature = collectedPlaces
    .map((p) => `${p.id}:${p.location?.lat?.toFixed(4) ?? ""},${p.location?.lng?.toFixed(4) ?? ""}`)
    .join("|");

  return {
    places: collectedPlaces,
    dayNumbers,
    missingPlaceIds: Array.from(missingIds),
    resolvedDestination,
    destinationPin,
    weatherText,
    placesSignature,
  };
}
