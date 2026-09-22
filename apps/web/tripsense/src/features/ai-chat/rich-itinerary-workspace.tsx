"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Compass, Info, MapPin, Sparkles, Star, X } from "lucide-react";
import type { Place } from "@/features/places/types";
import { approvedPhoto, getFallbackPlacePhoto } from "@/features/places/utils/approved-photo";
import { ApprovedPlaceImage } from "./approved-place-image";
import { PlaceDetailModal } from "@/features/places/components/place-detail-modal";
import type { AiItineraryPreview, AiPlaceEvidence } from "./types";

const MapVinaContainer = dynamic(
  () => import("@/features/map/components/mapvina-container").then((module) => module.MapVinaContainer),
  { ssr: false },
);

import { getPlaceDetails } from "@/features/places/services/places-api";

type Stop = AiPlaceEvidence & { dayNumber: number };

export function RichItineraryWorkspace({
  preview,
  places = [],
  selectedPlaceId,
  onSelectPlace,
  onViewDetails,
  onCreateTripFromPlan,
}: {
  preview?: AiItineraryPreview;
  places?: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string | null) => void;
  onViewDetails?: (place: Place) => void;
  onCreateTripFromPlan?: () => void;
}) {
  const [enrichedPlaces, setEnrichedPlaces] = React.useState<Record<string, Partial<Place>>>({});
  const inFlightRef = React.useRef<Set<string>>(new Set());
  const [detailPlace, setDetailPlace] = React.useState<Place | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [fitTrigger, setFitTrigger] = React.useState(0);

  const handleOpenDetails = React.useCallback(async (place: Place) => {
    if (onViewDetails) {
      onViewDetails(place);
      return;
    }
    setDetailPlace(place);
    setIsDetailOpen(true);
    setIsLoadingDetails(true);

    try {
      const lookupId = place.providerPlaceId || place.id;
      const res = await getPlaceDetails(
        lookupId,
        place.name,
        place.location?.lat,
        place.location?.lng,
        undefined,
        true
      );
      if (res?.success && res.data) {
        setDetailPlace((curr) => {
          if (!curr || (curr.id !== place.id && curr.providerPlaceId !== place.id)) return curr;
          return {
            ...curr,
            ...res.data,
            primaryPhoto: res.data.primaryPhoto || curr.primaryPhoto,
            photoGallery: res.data.photoGallery || curr.photoGallery,
          };
        });
      }
    } catch (err) {
      console.warn("Could not enrich details for modal:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [onViewDetails]);

  const rawStops = React.useMemo<Stop[]>(() => (preview?.days || []).flatMap((day) =>
    (day.items || []).filter((item) => Boolean(item.canonicalPlaceId && item.title))
      .map((item) => ({ ...item, dayNumber: day.dayNumber }))), [preview]);

  React.useEffect(() => {
    rawStops.forEach((stop) => {
      const id = stop.canonicalPlaceId;
      if (!id || (stop.location && stop.primaryPhoto)) return;
      if (enrichedPlaces[id] || inFlightRef.current.has(id)) return;

      inFlightRef.current.add(id);
      getPlaceDetails(id, stop.title, undefined, undefined, undefined, true)
        .then((res) => {
          if (res.data) {
            setEnrichedPlaces((prev) => ({
              ...prev,
              [id]: res.data,
            }));
          }
        })
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(id);
        });
    });
  }, [rawStops, enrichedPlaces]);

  const stops = React.useMemo<Stop[]>(() => rawStops.map((stop) => {
    const enriched = enrichedPlaces[stop.canonicalPlaceId];
    if (!enriched) return stop;
    return {
      ...stop,
      address: stop.address || enriched.address,
      location: stop.location || enriched.location,
      primaryPhoto: stop.primaryPhoto || enriched.primaryPhoto,
      ratingSummary: stop.ratingSummary || (enriched.rating != null ? {
        value: enriched.rating,
        count: enriched.userRatingCount,
        source: enriched.provider || "place-service",
      } : undefined),
    };
  }), [rawStops, enrichedPlaces]);

  const mapPlaces = React.useMemo<Place[]>(() => {
    if (stops.length > 0) {
      return stops.filter((stop) => stop.location &&
        Number.isFinite(stop.location.lat) && Number.isFinite(stop.location.lng)).map((stop) => ({
          id: stop.canonicalPlaceId,
          name: stop.title,
          address: stop.address,
          location: stop.location,
          categories: [],
          photos: [],
          primaryPhoto: approvedPhoto(stop.primaryPhoto) || getFallbackPlacePhoto(stop.title),
          rating: stop.ratingSummary?.value,
        }));
    }
    return (places || []).filter((p) => p.location &&
      Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng)).map((p) => ({
        ...p,
        primaryPhoto: approvedPhoto(p.primaryPhoto) || getFallbackPlacePhoto(p.name),
      }));
  }, [stops, places]);
  const center: [number, number] | undefined = mapPlaces[0]?.location
    ? [mapPlaces[0].location.lng, mapPlaces[0].location.lat] : undefined;

  const selectedPlace = React.useMemo(() => {
    if (!selectedPlaceId) return null;
    return mapPlaces.find((p) => p.id === selectedPlaceId) || null;
  }, [mapPlaces, selectedPlaceId]);

  const defaultCenter: [number, number] = [108.328, 15.880];

  return (
    <aside aria-label="Bản đồ và địa điểm trong lịch trình" className="relative flex h-full w-full min-h-[34rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:min-h-0">
      {/* Floating Header Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3.5 py-1.5 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>{rawStops.length > 0 ? "Bản đồ hành trình" : "Bản đồ địa điểm"}</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">· {mapPlaces.length} {rawStops.length > 0 ? "điểm dừng" : "địa điểm"}</span>
        {mapPlaces.length > 1 && (
          <button
            type="button"
            onClick={() => {
              onSelectPlace(null);
              setFitTrigger((n) => n + 1);
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Compass className="h-3 w-3" />
            Xem tất cả
          </button>
        )}
        {onCreateTripFromPlan && mapPlaces.length > 0 && (
          <button
            type="button"
            onClick={onCreateTripFromPlan}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
            title="Lưu các địa điểm này vào chuyến đi thực tế"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{rawStops.length > 0 ? "Tạo chuyến đi từ lịch trình" : "Tạo chuyến đi từ gợi ý"}</span>
          </button>
        )}
      </div>


      {/* Full-height Map */}
      <div className="relative h-full w-full flex-1">
        <MapVinaContainer
          places={mapPlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
          onViewDetails={handleOpenDetails}
          autoFitBounds={true}
          fitBoundsTrigger={fitTrigger}
          center={center || defaultCenter}
          zoom={center ? 13 : 12}
          className="h-full w-full min-h-0 rounded-none border-0 shadow-none"
        />
      </div>

      {/* Floating Selected Place Bottom Card Preview */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 sm:left-auto sm:right-4 sm:max-w-xs">
          <div
            className="flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={() => handleOpenDetails(selectedPlace)}
            title="Bấm để xem chi tiết địa điểm"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
              <ApprovedPlaceImage photo={selectedPlace.primaryPhoto} name={selectedPlace.name} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-xs text-foreground truncate hover:text-primary transition-colors">{selectedPlace.name}</h4>
              <p className="text-[11px] text-muted-foreground truncate">{selectedPlace.address || "Địa điểm trong lịch trình"}</p>
              {selectedPlace.rating && (
                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                  <Star className="h-3 w-3 fill-amber-500" />
                  {selectedPlace.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenDetails(selectedPlace)}
              className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
              title="Xem thông tin chi tiết (ⓘ)"
              aria-label="Xem thông tin chi tiết"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectPlace(null)}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Đóng chi tiết"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Place Detail Modal */}
      {!onViewDetails && (
        <PlaceDetailModal
          place={detailPlace}
          isOpen={isDetailOpen}
          isLoadingDetails={isLoadingDetails}
          onClose={() => {
            setIsDetailOpen(false);
            setIsLoadingDetails(false);
          }}
        />
      )}
    </aside>
  );
}
