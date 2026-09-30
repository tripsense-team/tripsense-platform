"use client";

import * as React from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  Building2,
  Sun,
  Moon,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import type { MindtripHotel } from "../types";
import { searchRealHotels } from "../services/hotel-service-adapter";
import { MindtripHotelCard } from "./mindtrip-hotel-card";
import { MindtripHotelDetailOverlay } from "./mindtrip-hotel-detail-overlay";

export interface MindtripStaysDiscoveryProps {
  onSwitchToManagement?: () => void;
  isAdmin?: boolean;
}

const DESTINATIONS = [
  "Quy Nhơn",
  "Thi Xa An Khe",
  "Đà Nẵng",
  "Hội An",
  "Huế",
  "Nha Trang",
  "Phú Quốc",
];

const CATEGORIES = [
  { id: "stays", label: "Stays", active: true },
  { id: "for-you", label: "For you", active: false },
  { id: "experiences", label: "Experiences", active: false },
  { id: "restaurants", label: "Restaurants", active: false },
  { id: "locations", label: "Locations", active: false },
  { id: "guides", label: "Guides", active: false },
];

export function MindtripStaysDiscovery({
  onSwitchToManagement,
  isAdmin = false,
}: MindtripStaysDiscoveryProps) {
  const { t, locale } = useTranslation();

  const [selectedDestination, setSelectedDestination] = React.useState("Quy Nhơn");
  const [isDestMenuOpen, setIsDestMenuOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState("stays");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [hotels, setHotels] = React.useState<MindtripHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = React.useState<MindtripHotel | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [themeMode, setThemeMode] = React.useState<"light" | "dark">("light");

  // Sync initial theme
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      setThemeMode(isDark ? "dark" : "light");
    }
  }, []);

  const toggleTheme = () => {
    const next = themeMode === "light" ? "dark" : "light";
    setThemeMode(next);
    if (typeof document !== "undefined") {
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  // Load real hotels for the selected destination
  const loadHotels = React.useCallback(async (dest: string) => {
    setIsLoading(true);
    try {
      const result = await searchRealHotels(dest);
      setHotels(result);
      if (result.length > 0) {
        setSelectedHotel(result[0]);
      } else {
        setSelectedHotel(null);
      }
    } catch {
      // Error handled inside adapter
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHotels(selectedDestination);
  }, [selectedDestination, loadHotels]);

  // Filtered hotels based on search query
  const filteredHotels = React.useMemo(() => {
    if (!searchQuery.trim()) return hotels;
    const q = searchQuery.toLowerCase().trim();
    return hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.district && h.district.toLowerCase().includes(q)) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q))
    );
  }, [hotels, searchQuery]);

  return (
    <div className="relative flex h-[calc(100vh-var(--header-height,0px))] w-full overflow-hidden bg-background text-foreground">
      {/* LEFT PANEL: Feed & Hotel Cards */}
      <div
        className={cn(
          "flex flex-col h-full overflow-y-auto scrollbar-thin transition-all duration-300",
          selectedHotel && !isPanelCollapsed
            ? "w-full lg:w-[50%] xl:w-[46%] shrink-0 border-r border-border"
            : "w-full"
        )}
      >
        <div className="p-4 sm:p-6 lg:p-7 space-y-5 max-w-5xl mx-auto w-full">
          {/* Top Destination Selector + Actions Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDestMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xl sm:text-2xl font-bold text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
              >
                <span>{selectedDestination}</span>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Destination Dropdown */}
              {isDestMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-40 animate-in fade-in-0 zoom-in-95 duration-150">
                  {DESTINATIONS.map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => {
                        setSelectedDestination(dest);
                        setIsDestMenuOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer",
                        selectedDestination === dest
                          ? "bg-foreground text-background"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{dest}</span>
                      {selectedDestination === dest && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Controls: Theme Toggle + Management Switch */}
            <div className="flex items-center gap-2">
              {/* Quick Light/Dark Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
                className="h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title={themeMode === "light" ? "Chuyển chế độ tối" : "Chuyển chế độ sáng"}
              >
                {themeMode === "light" ? (
                  <Moon className="h-4 w-4 text-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-400" />
                )}
              </button>

              {/* Switch to Management if available */}
              {onSwitchToManagement && (
                <button
                  type="button"
                  onClick={onSwitchToManagement}
                  className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{isAdmin ? "Admin workspace" : "Partner workspace"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar + Filters Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === "vi" ? "Tìm khách sạn, khu vực..." : "Search hotels, districts..."}
                className="w-full h-11 pl-10 pr-9 rounded-2xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:border-foreground/30 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              className="h-11 px-4 rounded-2xl bg-muted/40 border border-border hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span>{locale === "vi" ? "Bộ lọc" : "Filters"}</span>
            </button>
          </div>

          {/* Category Navigation Pills (Mindtrip Screenshot 3) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                disabled={!cat.active}
                onClick={() => cat.active && setActiveCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-2xs",
                  activeCategory === cat.id
                    ? "bg-foreground text-background cursor-pointer"
                    : cat.active
                    ? "bg-muted/40 text-muted-foreground hover:text-foreground border border-border hover:bg-muted cursor-pointer"
                    : "opacity-45 bg-muted/20 text-muted-foreground border border-border/40 cursor-not-allowed"
                )}
                title={!cat.active ? (locale === "vi" ? "Tính năng đang được phát triển" : "Coming soon") : undefined}
              >
                {cat.label}
                {!cat.active && (
                  <span className="ml-1 text-micro font-normal opacity-70">
                    ({locale === "vi" ? "Sắp ra mắt" : "Soon"})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Subtitle / Status indicator */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {locale === "vi"
                ? `${filteredHotels.length} chỗ nghỉ tại ${selectedDestination}`
                : `Showing ${filteredHotels.length} stays in ${selectedDestination}`}
            </span>
            {isLoading && (
              <span className="flex items-center gap-1.5 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{locale === "vi" ? "Đang tải dữ liệu thực..." : "Loading real stays..."}</span>
              </span>
            )}
          </div>

          {/* Loading Skeleton */}
          {isLoading && hotels.length === 0 ? (
            <div
              className={cn(
                "grid gap-x-4 gap-y-7 pb-12 pt-2",
                selectedHotel && !isPanelCollapsed
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="aspect-[4/3] rounded-2xl bg-muted border border-border" />
                  <div className="h-4 bg-muted rounded-md w-3/4" />
                  <div className="h-3 bg-muted rounded-md w-1/2" />
                  <div className="h-3 bg-muted rounded-md w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredHotels.length === 0 ? (
            /* Empty State */
            <div className="py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <MapPin className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {locale === "vi" ? "Không tìm thấy chỗ nghỉ phù hợp" : "No stays found"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {locale === "vi"
                  ? "Thử tìm kiếm với từ khóa khác hoặc chuyển sang địa điểm khác."
                  : "Try clearing your search query or select another destination."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {locale === "vi" ? "Xóa bộ lọc" : "Clear search"}
                </button>
              )}
            </div>
          ) : (
            /* Hotel Grid: 3 columns on full view, 2 columns on split view */
            <div
              className={cn(
                "grid gap-x-4 gap-y-7 pb-12 pt-2",
                selectedHotel && !isPanelCollapsed
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {filteredHotels.map((hotel) => (
                <MindtripHotelCard
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={selectedHotel?.id === hotel.id}
                  onClick={() => {
                    setSelectedHotel(hotel);
                    setIsPanelCollapsed(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SPLIT PANEL: Mindtrip Hotel Detail Overlay */}
      {selectedHotel && (
        <div
          className={cn(
            "h-full relative overflow-hidden flex-1",
            isPanelCollapsed ? "hidden" : "block"
          )}
        >
          <MindtripHotelDetailOverlay
            hotel={selectedHotel}
            onClose={() => setSelectedHotel(null)}
            isPanelCollapsed={isPanelCollapsed}
            onTogglePanel={() => setIsPanelCollapsed((prev) => !prev)}
          />
        </div>
      )}
    </div>
  );
}
