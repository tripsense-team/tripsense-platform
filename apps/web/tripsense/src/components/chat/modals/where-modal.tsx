"use client";

import * as React from "react";
import Image from "next/image";
import { X, MapPin, Check, Search, Compass } from "lucide-react";
import { ModalBackdrop } from "./modal-backdrop";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  POPULAR_DESTINATIONS,
  filterDestinations,
  type DestinationRegion,
  type PopularDestination,
} from "./popular-destinations";

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
  const [searchQuery, setSearchQuery] = React.useState(initialLocation);
  const [selectedLocation, setSelectedLocation] = React.useState(initialLocation);
  const [isRoadTrip, setIsRoadTrip] = React.useState(initialRoadTrip);
  const [activeRegion, setActiveRegion] = React.useState<DestinationRegion>("all");

  React.useEffect(() => {
    setSearchQuery(initialLocation);
    setSelectedLocation(initialLocation);
    setIsRoadTrip(initialRoadTrip);
    setActiveRegion("all");
  }, [initialLocation, initialRoadTrip, isOpen]);

  // Client-side instant filter of famous travel cities (no external search API)
  const filteredDestinations = React.useMemo(() => {
    return filterDestinations(searchQuery, activeRegion);
  }, [searchQuery, activeRegion]);

  const handleSelect = (dest: PopularDestination) => {
    setSelectedLocation(dest.name);
    setSearchQuery(dest.name);
  };

  const handleSave = () => {
    const finalLocation = selectedLocation.trim() || searchQuery.trim();
    if (!finalLocation) return;
    onSave({ location: finalLocation, isRoadTrip });
    onClose();
  };

  const canSave = selectedLocation.trim().length > 0 || searchQuery.trim().length > 0;

  const isCustomInput =
    searchQuery.trim().length > 0 &&
    !POPULAR_DESTINATIONS.some(
      (d) => d.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );

  const regionTabs: { id: DestinationRegion; label: string }[] = [
    { id: "all", label: t("trip.intakeTabAll") || "All" },
    { id: "vietnam", label: t("trip.intakeTabVietnam") || "Vietnam" },
    { id: "asia", label: t("trip.intakeTabAsia") || "Asia" },
    { id: "world", label: t("trip.intakeTabWorld") || "International" },
  ];

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title={t("trip.intakeWhereTitle") || "Where"}
      maxWidth="max-w-lg"
      zIndexClassName={zIndexClassName}
    >
      <div className="flex flex-col space-y-4">
        {/* Search Input with Search Icon */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedLocation(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) handleSave();
            }}
            placeholder={t("trip.intakeWherePlaceholder") || "Select destination..."}
            autoFocus
            className="w-full rounded-full border border-neutral-700 bg-background/80 pl-11 pr-11 py-3 text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedLocation("");
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Region Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {regionTabs.map((tab) => {
            const isActive = activeRegion === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRegion(tab.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-2xs"
                    : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Destinations Scrollable List */}
        <div className="min-h-[220px] max-h-[340px] overflow-y-auto space-y-2 pr-1">
          {/* Custom typed location fallback if not in list */}
          {isCustomInput ? (
            <button
              type="button"
              onClick={() => {
                setSelectedLocation(searchQuery.trim());
                handleSave();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left bg-muted/40 hover:bg-muted/70 text-foreground transition-all cursor-pointer border border-border/50 group mb-2"
            >
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <MapPin className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate leading-snug">
                  {searchQuery.trim()}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {t("trip.intakeCustomDestination", { name: searchQuery.trim() }) ||
                    `Use "${searchQuery.trim()}" as destination`}
                </p>
              </div>
            </button>
          ) : null}

          {/* Curated list */}
          {filteredDestinations.length > 0 ? (
            filteredDestinations.map((dest) => {
              const isSelected =
                selectedLocation.toLowerCase() === dest.name.toLowerCase() ||
                searchQuery.toLowerCase() === dest.name.toLowerCase();

              return (
                <button
                  type="button"
                  key={dest.id}
                  onClick={() => handleSelect(dest)}
                  onDoubleClick={handleSave}
                  className={cn(
                    "w-full flex items-center gap-3.5 p-2.5 rounded-2xl text-left transition-all cursor-pointer group border",
                    isSelected
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 border-neutral-700 shadow-xs"
                      : "bg-background/60 hover:bg-muted/50 border-border/40 text-foreground"
                  )}
                >
                  {/* City Landmark Photo + Country Flag Logo Badge */}
                  <div className="size-12 rounded-xl overflow-hidden bg-muted/60 shrink-0 relative flex items-center justify-center border border-border/50 shadow-2xs">
                    <Image
                      src={dest.image}
                      alt={dest.name}
                      fill
                      sizes="48px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Country Flag Badge on Logo Corner */}
                    <div className="absolute bottom-0.5 right-0.5 size-4.5 rounded-full bg-background/90 dark:bg-neutral-900/90 flex items-center justify-center text-xs leading-none shadow-xs border border-white/20">
                      {dest.flag}
                    </div>
                  </div>

                  {/* Destination Information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate leading-snug">
                        {dest.name}
                      </span>
                      <span className="text-xs opacity-80 shrink-0">
                        ({dest.country})
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-xs truncate mt-0.5",
                        isSelected
                          ? "text-neutral-300 dark:text-neutral-600"
                          : "text-muted-foreground"
                      )}
                    >
                      {dest.landmark}
                    </p>
                  </div>

                  {/* Selected check indicator */}
                  {isSelected ? (
                    <div className="shrink-0 size-6 rounded-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white flex items-center justify-center shadow-xs">
                      <Check className="size-3.5 stroke-[3]" />
                    </div>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Compass className="size-7 text-muted-foreground/60" />
              <span>
                {t("trip.intakeNoPlacesFound") ||
                  "No destinations found. Press Save to use custom location."}
              </span>
            </div>
          )}
        </div>

        {/* Footer: Save Button aligned to right */}
        <div className="flex justify-end pt-3 border-t border-border/40">
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={cn(
              "rounded-full px-8 py-2.5 text-sm font-semibold transition-all cursor-pointer shadow-xs",
              canSave
                ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
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
