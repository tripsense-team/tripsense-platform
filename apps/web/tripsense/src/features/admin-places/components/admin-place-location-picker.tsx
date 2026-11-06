"use client";

import * as React from "react";
import * as mapvinagl from "mapvina-gl";
import "mapvina-gl/dist/mapvina-gl.css";
import { useTranslation } from "@/i18n";

type Coordinates = { lat: number; lng: number };

interface AdminPlaceLocationPickerProps {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
}

const DEFAULT_CENTER: [number, number] = [108.2208, 16.0678];

export function AdminPlaceLocationPicker({ value, onChange }: AdminPlaceLocationPickerProps) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<mapvinagl.Map | null>(null);
  const markerRef = React.useRef<mapvinagl.Marker | null>(null);
  const onChangeRef = React.useRef(onChange);
  const initialValueRef = React.useRef(value);
  const key = process.env.NEXT_PUBLIC_MAPVINA_API_KEY;
  const selectedLat = value?.lat;
  const selectedLng = value?.lng;

  React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  React.useEffect(() => {
    if (!containerRef.current || !key) return;
    const map = new mapvinagl.Map({
      container: containerRef.current,
      style: `https://maps.mapvina.com/styles/v2/streets.json?key=${encodeURIComponent(key)}`,
      center: initialValueRef.current
        ? [initialValueRef.current.lng, initialValueRef.current.lat] : DEFAULT_CENTER,
      zoom: initialValueRef.current ? 14 : 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new mapvinagl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (event) => {
      onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
    const resizeTimer = window.setTimeout(() => map.resize(), 200);
    return () => {
      window.clearTimeout(resizeTimer);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [key]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedLat === undefined || selectedLng === undefined) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) markerRef.current = new mapvinagl.Marker();
    markerRef.current.setLngLat([selectedLng, selectedLat]).addTo(map);
  }, [selectedLat, selectedLng]);

  if (!key) return <p role="status" className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">{t("admin.places.locationMapUnavailable")}</p>;

  return (
    <div className="h-56 w-full overflow-hidden rounded-xl border border-border bg-muted">
      <div ref={containerRef} aria-label={t("admin.places.locationMapLabel")} className="h-full w-full" />
    </div>
  );
}
