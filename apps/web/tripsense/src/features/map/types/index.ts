import type { Place } from "@/features/places/types";

export interface MapMarkerItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  rating?: number;
  address?: string;
  photo?: string;
}

export interface MapVinaContainerProps {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string | null) => void;
  onAddAndSelectPlace?: (place: Place) => void;
  onViewDetails?: (place: Place) => void;
  onViewportChange?: (viewport: { lat: number; lng: number; zoom: number; radius: number }) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  className?: string;
}

// Backward compatibility alias
export type MapLibreContainerProps = MapVinaContainerProps;
