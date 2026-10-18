"use client";

import * as React from "react";
import Image from "next/image";
import { X, MapPin, Loader2 } from "lucide-react";
import { ModalBackdrop } from "./modal-backdrop";
import { useTranslation } from "@/i18n";
import { searchPlaces } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { Place } from "@/features/places/types";
import { cn } from "@/lib/utils";

type WhereModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: string;
  initialRoadTrip?: boolean;
  onSave: (data: { location: string; isRoadTrip: boolean }) => void;
  zIndexClassName?: string;
};

export function WhereModal({
  isOpen,
  onClose,
  initialLocation = "",
  initialRoadTrip = false,
  onSave,
  zIndexClassName,
}: WhereModalProps) {
  const { t } = useTranslation();
  const [location, setLocation] = React.useState(initialLocation);
  const [isRoadTrip, setIsRoadTrip] = React.useState(initialRoadTrip);
  const [suggestions, setSuggestions] = React.useState<Place[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocation(initialLocation);
    setIsRoadTrip(initialRoadTrip);
    setSelectedPlaceId(null);
  }, [initialLocation, initialRoadTrip, isOpen]);

  // Debounced search via real ZioMap / Places API (never mock)
  React.useEffect(() => {
    if (!isOpen) return;

    const trimmed = location.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await searchPlaces({
          q: trimmed,
          limit: 6,
          signal: controller.signal,
        });
        if (active) {
          setSuggestions(res.data || []);
        }
      } catch {
        if (active) {
          setSuggestions([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [location, isOpen]);

  const handleSelectSuggestion = (place: Place) => {
    setSelectedPlaceId(place.id);
    setLocation(place.name);
  };

  const handleSave = () => {
    const finalLocation = location.trim();
    if (!finalLocation) return;
    onSave({ location: finalLocation, isRoadTrip });
    onClose();
  };

  const canSave = location.trim().length > 0;

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title={t("trip.intakeWhereTitle") || "Where"}
      maxWidth="max-w-md"
      zIndexClassName={zIndexClassName}
    >
      <div className="flex flex-col space-y-4">
        {/* Search Input matching Screenshot 5 */}
        <div className="relative">
          <input
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setSelectedPlaceId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) handleSave();
            }}
            placeholder={t("trip.intakeWherePlaceholder") || "Select destination..."}
            autoFocus
            className="w-full rounded-full border border-neutral-700 bg-background/80 px-5 py-3 pr-11 text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
          />
          {location ? (
            <button
              type="button"
              onClick={() => {
                setLocation("");
                setSelectedPlaceId(null);
                setSuggestions([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Real Autocomplete Results list matching Screenshot 5 */}
        <div className="min-h-[160px] max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-xs">
              <Loader2 className="size-4 animate-spin" />
              <span>{t("common.loading") || "Loading..."}</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((place) => {
              const photoUrl = getPlacePhotoUrl(place);
              const isSelected = selectedPlaceId === place.id || location.toLowerCase() === place.name.toLowerCase();

              return (
                <button
                  type="button"
                  key={place.id}
                  onClick={() => handleSelectSuggestion(place)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all cursor-pointer group",
                    isSelected
                      ? "bg-neutral-800 text-white shadow-xs"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  {/* Thumbnail / Photo */}
                  <div className="size-11 rounded-xl overflow-hidden bg-muted/60 shrink-0 relative flex items-center justify-center border border-border/40">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={place.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <MapPin className="size-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Name and Address */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate leading-snug">
                      {place.name}
                    </p>
                    {place.address && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {place.address}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          ) : location.trim().length >= 2 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("trip.intakeNoPlacesFound") || "No destinations found. Press Save to use custom location."}
            </div>
          ) : null}
        </div>

        {/* Footer: Save Button aligned to right matching Screenshot 5 */}
        <div className="flex justify-end pt-3 border-t border-border/40">
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={cn(
              "rounded-full px-8 py-2.5 text-sm font-semibold transition-all cursor-pointer shadow-xs",
              canSave
                ? "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
                : "bg-muted text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {t("common.save") || "Save"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
