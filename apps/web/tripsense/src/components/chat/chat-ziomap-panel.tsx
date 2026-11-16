"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Place } from "@/features/places/types";
import type { DestinationMapPin } from "@/features/map/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

const FLOATING_TRANSLUCENT_BUTTON_CLASS =
  "border border-border/50 bg-background/65 text-foreground backdrop-blur-md shadow-sm hover:bg-background/85 dark:bg-card/65 dark:hover:bg-card/85 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

const DAY_FILTER_PILL_BASE_CLASS =
  "h-8 shrink-0 rounded-full px-3 text-xs font-semibold backdrop-blur-md shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

const DAY_FILTER_PILL_ACTIVE_CLASS =
  "border border-foreground/15 bg-foreground/80 text-background hover:bg-foreground/90";

const MapVinaContainer = dynamic(
  () =>
    import("@/features/map/components/mapvina-container").then(
      (mod) => mod.MapVinaContainer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 text-xs font-medium text-muted-foreground animate-pulse">
        <span>Loading map...</span>
      </div>
    ),
  },
);

export interface ChatZioMapPanelProps {
  places: Place[];
  dayNumbers: number[];
  selectedDayNumber: number | null;
  onSelectDayNumber: (day: number | null) => void;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  destinationPin: DestinationMapPin | null;
  resolvedDestination: string | null;
  weatherText?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  fitBoundsTrigger?: number;
  onViewPlaceDetails?: (place: Place) => void;
  className?: string;
}

export function ChatZioMapPanel({
  places,
  dayNumbers,
  selectedDayNumber,
  onSelectDayNumber,
  selectedPlaceId,
  onSelectPlace,
  destinationPin,
  resolvedDestination,
  weatherText,
  isCollapsed,
  onToggleCollapse,
  onClose,
  fitBoundsTrigger = 0,
  onViewPlaceDetails,
  className,
}: ChatZioMapPanelProps) {
  const { t } = useTranslation();

  const displayDestination =
    resolvedDestination || destinationPin?.name || t("aiPlanner.mapOpen");

  const mapCenter: [number, number] = React.useMemo(() => {
    if (places[0]?.location) {
      return [places[0].location.lng, places[0].location.lat];
    }
    if (destinationPin) {
      return [destinationPin.lng, destinationPin.lat];
    }
    return [108.2022, 16.0544];
  }, [places, destinationPin]);

  return (
    <aside
      data-testid="chat-ziomap-panel"
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden bg-background transition-all duration-300 ease-in-out select-none",
        isCollapsed
          ? "z-20 w-14 rounded-l-xl rounded-r-none border-l border-border/70"
          : "absolute inset-0 z-20 w-full md:static md:w-[50%] lg:w-[48%] xl:w-[46%] rounded-none md:rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l-0 md:border-l border-border/70 shadow-xl",
        className,
      )}
    >
      {isCollapsed ? (
        <div className="flex h-full w-full flex-col items-center gap-2.5 py-3.5 select-none">
          <SidebarCollapseButton
            collapsed={true}
            onToggleCollapse={onToggleCollapse}
            collapseTitle={t("aiPlanner.mapCollapse")}
            expandTitle={t("aiPlanner.mapExpand")}
            tooltipSide="left"
            iconClassName="h-4.5 w-4.5"
            className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none shrink-0"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("aiPlanner.mapClose")}
            title={t("aiPlanner.mapClose")}
            className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" />
          </button>

          <div className="my-1 h-px w-6 shrink-0 bg-border/40" />

          <div className="flex-1 flex items-center justify-center [writing-mode:vertical-rl] text-xs font-semibold text-muted-foreground tracking-wider uppercase select-none py-2">
            {displayDestination}
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full flex-1 overflow-hidden">
          <MapVinaContainer
            places={places}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={onSelectPlace}
            onViewDetails={(place) => onViewPlaceDetails?.(place)}
            openDetailsOnMarkerClick={true}
            center={mapCenter}
            zoom={places.length > 1 ? 12 : 13}
            autoFitBounds={true}
            fitBoundsTrigger={fitBoundsTrigger}
            hideBuiltInPois={true}
            disableBasePoiClick={true}
            destinationPin={places.length === 0 ? destinationPin : null}
            navigationPosition="bottom-right"
            weatherText={weatherText}
            showWeatherBadge={Boolean(weatherText)}
            isPanelCollapsed={isCollapsed}
            className="h-full w-full rounded-none lg:rounded-none"
          />

          {/* Floating translucent controls positioned directly over the full-bleed map */}
          <div
            data-testid="chat-ziomap-floating-controls"
            className="pointer-events-none absolute inset-x-3.5 top-3.5 z-20 flex items-center gap-2"
          >
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <SidebarCollapseButton
                collapsed={false}
                onToggleCollapse={onToggleCollapse}
                collapseTitle={t("aiPlanner.mapCollapse")}
                expandTitle={t("aiPlanner.mapExpand")}
                tooltipSide="bottom"
                iconClassName="h-4.5 w-4.5"
                className={cn(
                  "h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 active:scale-95",
                  FLOATING_TRANSLUCENT_BUTTON_CLASS,
                )}
              />
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t("aiPlanner.mapClose")}
                      className={cn(
                        "h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 active:scale-95",
                        FLOATING_TRANSLUCENT_BUTTON_CLASS,
                      )}
                    >
                      <X className="h-4.5 w-4.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {t("aiPlanner.mapClose")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {dayNumbers.length > 1 && (
              <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
                <button
                  type="button"
                  aria-pressed={selectedDayNumber === null}
                  onClick={() => onSelectDayNumber(null)}
                  className={cn(
                    DAY_FILTER_PILL_BASE_CLASS,
                    selectedDayNumber === null
                      ? DAY_FILTER_PILL_ACTIVE_CLASS
                      : FLOATING_TRANSLUCENT_BUTTON_CLASS,
                  )}
                >
                  {t("trip.allDays")}
                </button>
                {dayNumbers.map((day) => {
                  const isActive = selectedDayNumber === day;
                  return (
                    <button
                      type="button"
                      key={day}
                      aria-pressed={isActive}
                      onClick={() => onSelectDayNumber(day)}
                      className={cn(
                        DAY_FILTER_PILL_BASE_CLASS,
                        isActive
                          ? DAY_FILTER_PILL_ACTIVE_CLASS
                          : FLOATING_TRANSLUCENT_BUTTON_CLASS,
                      )}
                    >
                      {t("aiPlanner.mapDayNumber", { day })}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
