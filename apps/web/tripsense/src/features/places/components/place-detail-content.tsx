"use client";

import * as React from "react";
import Image from "next/image";
import {
  X,
  Heart,
  Plus,
  Check,
  Share2,
  Headphones,
  Star,
  Utensils,
  Coffee,
  Waves,
  Landmark,
  Compass,
  MapPin,
  ExternalLink,
  Clock,
  Phone,
  Info,
  ChevronRight,
  Maximize2,
  Navigation,
  ImageOff,
  Hotel,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import type { Place } from "../types";
import { approvedPhotoGallery } from "../utils/approved-photo";
import { OpeningHoursDisplay } from "./opening-hours-display";

export interface PlaceDetailContentProps {
  place: Place;
  isFavorite?: boolean;
  isAddedToTrip?: boolean;
  onClose: () => void;
  onToggleFavorite?: (placeId: string, isFav: boolean) => void;
  onAddToTrip?: (place: Place) => void;
  isPanelCollapsed?: boolean;
  onTogglePanel?: () => void;
  className?: string;

  /** Optional sticky sidebar card rendered on the right of the Overview section (e.g. Hotel Booking card). */
  overviewAside?: React.ReactNode;
  /** Optional amenities section rendered as its own tab between Overview and Reviews. */
  amenitiesSection?: React.ReactNode;
  /** Optional category label override. */
  categoryLabel?: string;
}

function CategoryIcon({ category = "" }: { category?: string }) {
  const className = "h-3.5 w-3.5 text-muted-foreground shrink-0";
  const text = category.toLowerCase();
  if (/cà phê|cafe|coffee/i.test(text)) return <Coffee className={className} />;
  if (/ăn|quán|bún|phở|mì|cơm|bánh|lẩu|restaurant|food|ẩm thực|nướng|pizza|steak|seafood|vietnamese/i.test(text))
    return <Utensils className={className} />;
  if (/biển|bãi|beach|sea|đảo|ocean/i.test(text)) return <Waves className={className} />;
  if (/chùa|temple|pagoda|linh ứng|tháp|nhà thờ|di tích|lăng|heritage|museum/i.test(text))
    return <Landmark className={className} />;
  if (/stay|hotel|resort|khách sạn|khu nghỉ|bungalow|villa|lodging/i.test(text))
    return <Hotel className={className} />;
  return <Compass className={className} />;
}

function formatRating(rating?: number, locale: string = "en"): string {
  if (typeof rating !== "number" || rating <= 0) return "";
  const val = rating.toFixed(1);
  return locale === "vi" ? val.replace(".", ",") : val;
}

function formatReviewCount(count?: number, locale: string = "en"): string {
  if (!count || count <= 0) return "0";
  if (count >= 1000) {
    const formatted = (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1);
    if (locale === "vi") {
      return `${formatted.replace(".", ",")} n`;
    }
    return `${formatted}k`;
  }
  return String(count);
}

export function PlaceDetailContent({
  place,
  isFavorite = false,
  isAddedToTrip = false,
  onClose,
  onToggleFavorite,
  onAddToTrip,
  isPanelCollapsed = false,
  onTogglePanel,
  className,
  overviewAside,
  amenitiesSection,
  categoryLabel,
}: PlaceDetailContentProps) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<"overview" | "amenities" | "reviews" | "location">("overview");
  const [isExpandedDesc, setIsExpandedDesc] = React.useState(false);

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const overviewRef = React.useRef<HTMLDivElement | null>(null);
  const amenitiesRef = React.useRef<HTMLDivElement | null>(null);
  const reviewsRef = React.useRef<HTMLDivElement | null>(null);
  const locationRef = React.useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = React.useRef(false);

  const primaryCategory =
    categoryLabel || place.categories?.[0] || t("places.defaultCategory", { defaultValue: "Restaurant" });

  const locationDisplay =
    [place.district, place.city].filter(Boolean).join(", ") ||
    place.address ||
    (locale === "vi" ? "Đà Nẵng" : "Da Nang");

  const reviewsLabel = locale === "vi" ? "đánh giá" : "reviews";

  const displayPhotos = React.useMemo(() => {
    return approvedPhotoGallery(
      place.photoGallery,
      place.primaryPhoto,
      place.photos
    );
  }, [place.photoGallery, place.primaryPhoto, place.photos]);

  const descriptionText = React.useMemo(() => {
    if (place.description?.trim()) return place.description;
    const addressStr = place.address || locationDisplay;
    const catStr = primaryCategory.replace(/_/g, " ");
    return locale === "vi"
      ? `${place.name} là điểm đến thuộc danh mục ${catStr} tại ${addressStr}.`
      : `${place.name} is a ${catStr} destination located at ${addressStr}.`;
  }, [place.description, place.name, place.address, locationDisplay, primaryCategory, locale]);

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: place.name,
        text: `${place.name} - ${locationDisplay}`,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleAudioGuide = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(descriptionText);
      utterance.lang = locale === "vi" ? "vi-VN" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  // Scrollspy: update active tab indicator when scrolling through sections
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const containerTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      if (containerTop + clientHeight >= scrollHeight - 60) {
        setActiveTab("location");
        return;
      }

      const offset = 140;
      const amenitiesEl = amenitiesRef.current;
      const reviewsEl = reviewsRef.current;
      const locationEl = locationRef.current;

      if (locationEl && containerTop >= locationEl.offsetTop - offset) {
        setActiveTab("location");
      } else if (reviewsEl && containerTop >= reviewsEl.offsetTop - offset) {
        setActiveTab("reviews");
      } else if (amenitiesEl && containerTop >= amenitiesEl.offsetTop - offset) {
        setActiveTab("amenities");
      } else {
        setActiveTab("overview");
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTabClick = (tab: "overview" | "amenities" | "reviews" | "location") => {
    setActiveTab(tab);
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetEl =
      tab === "overview"
        ? overviewRef.current
        : tab === "amenities"
        ? amenitiesRef.current
        : tab === "reviews"
        ? reviewsRef.current
        : locationRef.current;

    if (targetEl) {
      isProgrammaticScrollRef.current = true;
      const targetTop = Math.max(0, targetEl.offsetTop - 110);
      container.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });

      window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "absolute inset-0 z-30 bg-background overflow-y-auto scrollbar-thin flex flex-col transition-all duration-200 select-none animate-in fade-in-0 duration-150 scroll-smooth",
        isPanelCollapsed
          ? "rounded-none"
          : "rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border/70 shadow-xs",
        className
      )}
    >
      {/* 1. Top Action Bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/40 shrink-0">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 py-3.5">
          {/* Left: Close (X) & Collapse/Expand List Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={locale === "vi" ? "Đóng" : "Close"}
              title={locale === "vi" ? "Đóng" : "Close"}
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {onTogglePanel && (
              <TooltipProvider delayDuration={150}>
                <SidebarCollapseButton
                  collapsed={Boolean(isPanelCollapsed)}
                  onToggleCollapse={onTogglePanel}
                  collapseTitle={locale === "vi" ? "Thu gọn danh sách" : "Collapse list"}
                  expandTitle={locale === "vi" ? "Hiện danh sách" : "Expand list"}
                  tooltipSide="bottom"
                  className="hidden lg:flex h-8.5 w-8.5 rounded-full border border-border/70 items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none"
                />
              </TooltipProvider>
            )}
          </div>

          {/* Right: Save, Add to trip, Map directions, Audio guide, Share */}
          <div className="flex items-center gap-2">
            {/* Save button */}
            <button
              type="button"
              onClick={() => onToggleFavorite?.(place.id, !isFavorite)}
              className="px-3.5 py-1.5 rounded-full border border-border/70 bg-background hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5",
                  isFavorite
                    ? "fill-rose-500 text-rose-500"
                    : "text-foreground"
                )}
              />
              <span>
                {isFavorite
                  ? (locale === "vi" ? "Đã lưu" : "Saved")
                  : (locale === "vi" ? "Lưu" : "Save")}
              </span>
            </button>

            {/* Add to Trip button */}
            <button
              type="button"
              onClick={() => onAddToTrip?.(place)}
              className="px-3.5 py-1.5 rounded-full border border-border/70 bg-background hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isAddedToTrip ? (
                <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-foreground stroke-[2]" />
              )}
              <span>
                {isAddedToTrip
                  ? t("places.addedToTrip", { defaultValue: "Added" })
                  : t("places.addToTrip", { defaultValue: "Add to trip" })}
              </span>
            </button>

            {/* Directions Map button */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${place.name} ${place.address || locationDisplay}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={locale === "vi" ? "Chỉ đường" : "Directions"}
              title={locale === "vi" ? "Chỉ đường" : "Directions"}
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <MapPin className="h-4 w-4 text-foreground" />
            </a>

            {/* Audio Guide button */}
            <button
              type="button"
              onClick={handleAudioGuide}
              aria-label={locale === "vi" ? "Nghe thuyết minh" : "Audio guide"}
              title={locale === "vi" ? "Nghe thuyết minh" : "Audio guide"}
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Headphones className="h-4 w-4" />
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              aria-label={locale === "vi" ? "Chia sẻ" : "Share"}
              title={locale === "vi" ? "Chia sẻ" : "Share"}
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Content Body */}
      <div className="px-6 py-5 flex-1 pb-32">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          {/* Header Block: Title, Rating, Category */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
              {place.name}
            </h1>

            <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-muted-foreground flex-wrap">
              {typeof place.rating === "number" && place.rating > 0 && (
                <>
                  <Star className="h-3.5 w-3.5 fill-foreground text-foreground shrink-0" />
                  <span className="font-semibold text-foreground">
                    {formatRating(place.rating, locale)}
                  </span>
                  <span>·</span>
                </>
              )}
              {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                <>
                  <span>
                    {formatReviewCount(place.userRatingCount, locale)}{" "}
                    {reviewsLabel}
                  </span>
                  <span>·</span>
                </>
              )}
              <span>{locationDisplay}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-muted-foreground">
              <CategoryIcon category={primaryCategory} />
              <span className="capitalize">{primaryCategory.replace(/_/g, " ")}</span>
              <span>·</span>
              <span className="font-medium text-foreground/80">$$</span>
            </div>
          </div>

          {/* Adaptive gallery: render each verified photo exactly once */}
          {displayPhotos.length === 0 ? (
            <div className="flex h-[240px] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-muted text-muted-foreground sm:h-[300px]">
              <ImageOff className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm font-medium">
                {t("places.noLicensedPhotos", { defaultValue: "No photos available" })}
              </span>
            </div>
          ) : displayPhotos.length <= 2 ? (
            <div
              className={cn(
                "grid h-[280px] w-full overflow-hidden rounded-2xl bg-muted select-none sm:h-[340px] md:h-[380px]",
                displayPhotos.length === 2 ? "grid-cols-2 gap-2" : "grid-cols-1"
              )}
            >
              {displayPhotos.map((photo, idx) => (
                <div key={photo.url} className="group relative h-full w-full overflow-hidden bg-muted">
                  <Image
                    src={photo.url}
                    alt={idx === 0 ? place.name : `${place.name} - ${idx + 1}`}
                    fill
                    unoptimized
                    sizes={displayPhotos.length === 1 ? "100vw" : "50vw"}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {idx === 0 && (
                    <div className="absolute bottom-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white drop-shadow-md">
                      <Info className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-[280px] w-full grid-cols-2 gap-2 overflow-hidden rounded-2xl bg-muted select-none sm:h-[340px] md:h-[380px]">
              <div className="group relative h-full w-full overflow-hidden bg-muted">
                <Image
                  src={displayPhotos[0].url}
                  alt={place.name}
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute bottom-2.5 right-2.5 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center drop-shadow-md">
                  <Info className="h-3.5 w-3.5" />
                </div>
              </div>

              <div
                className={cn(
                  "grid h-full w-full gap-2",
                  displayPhotos.length === 3
                    ? "grid-cols-1 grid-rows-2"
                    : "grid-cols-2 grid-rows-2"
                )}
              >
                {displayPhotos.slice(1).map((photo, idx) => (
                  <div
                    key={photo.url}
                    className={cn(
                      "group relative h-full w-full overflow-hidden bg-muted",
                      displayPhotos.length === 4 && idx === 2 && "col-span-2"
                    )}
                  >
                    <Image
                      src={photo.url}
                      alt={`${place.name} - ${idx + 2}`}
                      fill
                      unoptimized
                      sizes="25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Sticky Navigation Tabs (Scrollspy) */}
          <div className="sticky top-[58px] z-10 bg-background/95 backdrop-blur-md -mx-6 px-6 py-2.5 border-b border-border/60 flex items-center gap-8 text-sm font-semibold">
            <button
              type="button"
              onClick={() => handleTabClick("overview")}
              className={cn(
                "pb-1 transition-colors cursor-pointer relative",
                activeTab === "overview"
                  ? "text-foreground font-bold border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {locale === "vi" ? "Tổng quan" : "Overview"}
            </button>
            {amenitiesSection && (
              <button
                type="button"
                onClick={() => handleTabClick("amenities")}
                className={cn(
                  "pb-1 transition-colors cursor-pointer relative",
                  activeTab === "amenities"
                    ? "text-foreground font-bold border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {locale === "vi" ? "Tiện nghi" : "Amenities"}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleTabClick("reviews")}
              className={cn(
                "pb-1 transition-colors cursor-pointer relative flex items-center gap-1.5",
                activeTab === "reviews"
                  ? "text-foreground font-bold border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{locale === "vi" ? "Đánh giá" : "Reviews"}</span>
              {place.reviews && place.reviews.length > 0 && (
                <span className="text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                  {place.reviews.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabClick("location")}
              className={cn(
                "pb-1 transition-colors cursor-pointer relative",
                activeTab === "location"
                  ? "text-foreground font-bold border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {locale === "vi" ? "Vị trí" : "Location"}
            </button>
          </div>

          {/* 4. Section 1: Overview (Split into 2 columns if overviewAside is passed) */}
          <div ref={overviewRef} id="section-overview" className="space-y-6 pt-2 scroll-mt-28">
            <div className={overviewAside ? "grid grid-cols-1 lg:grid-cols-12 gap-8" : "space-y-6"}>
              {/* Main Info Column */}
              <div className={overviewAside ? "lg:col-span-7 space-y-6" : "space-y-6"}>
                {/* Description */}
                <div className="space-y-2">
                  <p
                    className={cn(
                      "text-sm text-foreground/90 leading-relaxed",
                      !isExpandedDesc && "line-clamp-4"
                    )}
                  >
                    {descriptionText}
                  </p>
                  {descriptionText.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setIsExpandedDesc((prev) => !prev)}
                      className="px-4 py-1.5 rounded-full border border-border/80 text-xs font-semibold hover:bg-muted text-foreground transition-colors cursor-pointer"
                    >
                      {isExpandedDesc ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>

                {/* Structured Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 pt-5 border-t border-border/60">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                        Address
                      </span>
                      <p className="text-foreground/90 text-sm leading-snug">
                        {place.address || locationDisplay}
                      </p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${place.name} ${place.address || locationDisplay}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-0.5"
                      >
                        <span>Get directions</span>
                        <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Website */}
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                        Website
                      </span>
                      {place.website ? (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground/90 hover:text-primary hover:underline text-sm truncate block max-w-[240px]"
                        >
                          {place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        </a>
                      ) : (
                        <p className="text-muted-foreground text-xs">Not available</p>
                      )}
                    </div>
                  </div>

                  {/* Hours (if available) */}
                  {place.openingHours && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                          {t("places.openingHours", { defaultValue: "Hours" })}
                        </span>
                        <OpeningHoursDisplay
                          openingHours={place.openingHours}
                          businessStatus={place.businessStatus}
                        />
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  <div className="flex items-start gap-3">
                    <Phone className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                        Phone
                      </span>
                      {place.phone ? (
                        <a
                          href={`tel:${place.phone}`}
                          className="text-foreground/90 hover:text-primary text-sm font-medium"
                        >
                          {place.phone}
                        </a>
                      ) : (
                        <p className="text-muted-foreground text-xs">Not available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aside column (e.g. Booking widget for hotel) */}
              {overviewAside && (
                <div className="lg:col-span-5">
                  <div className="sticky top-28">{overviewAside}</div>
                </div>
              )}
            </div>
          </div>

          {/* Optional Amenities Section */}
          {amenitiesSection && (
            <div ref={amenitiesRef} id="section-amenities" className="space-y-6 pt-6 border-t border-border/60 scroll-mt-28">
              {amenitiesSection}
            </div>
          )}

          {/* 5. Section 2: Reviews */}
          <div ref={reviewsRef} id="section-reviews" className="space-y-6 pt-6 border-t border-border/60 scroll-mt-28">
            {/* Reviews Header & Overall Score */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  {locale === "vi" ? "Đánh giá" : "Reviews"}
                </h3>
                {typeof place.rating === "number" && place.rating > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {formatRating(place.rating, locale)}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {Number(place.rating || 0) >= 4.5
                        ? (locale === "vi" ? "Xuất sắc" : "Excellent")
                        : Number(place.rating || 0) >= 4.0
                        ? (locale === "vi" ? "Rất tốt" : "Very Good")
                        : (locale === "vi" ? "Tốt" : "Good")}
                    </span>
                    {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        · ★ {formatReviewCount(place.userRatingCount, locale)} {locale === "vi" ? "đánh giá" : "reviews"}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {locale === "vi" ? "Chưa có đánh giá nào" : "No reviews yet"}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="px-4 py-1.5 rounded-full border border-border/80 text-xs font-semibold hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                + {locale === "vi" ? "Viết đánh giá" : "Add review"}
              </button>
            </div>

            {/* Google Badge Card - Only render when rating data exists */}
            {typeof place.rating === "number" && place.rating > 0 && (
              <div className="rounded-xl border border-border/70 p-3.5 w-fit space-y-1 bg-card shadow-2xs">
                <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <span className="text-blue-500 font-bold">G</span>
                  <span className="text-red-500 font-bold">o</span>
                  <span className="text-amber-500 font-bold">o</span>
                  <span className="text-blue-500 font-bold">g</span>
                  <span className="text-green-500 font-bold">l</span>
                  <span className="text-red-500 font-bold">e</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-1" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRating(place.rating, locale)}/5
                  {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                    <> · {formatReviewCount(place.userRatingCount, locale)} {locale === "vi" ? "đánh giá" : "reviews"}</>
                  )}
                </div>
              </div>
            )}

            {/* Real Reviews Cards List */}
            {place.reviews && place.reviews.length > 0 ? (
              <div className="space-y-3.5 pt-2">
                <h4 className="text-sm font-bold text-foreground">
                  {locale === "vi" ? "Đánh giá từ khách hàng" : "Customer reviews"}
                </h4>
                <div className="space-y-3">
                  {place.reviews.map((rev, idx) => (
                    <div
                      key={`${rev.authorName}-${rev.time || idx}`}
                      className="rounded-xl border border-border/70 p-4 bg-card shadow-2xs space-y-2.5 transition-colors hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {rev.profilePhotoUrl ? (
                            <Image
                              src={rev.profilePhotoUrl}
                              alt={rev.authorName}
                              width={36}
                              height={36}
                              unoptimized
                              className="h-9 w-9 rounded-full object-cover shrink-0 border border-border/50"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                              {rev.authorName?.slice(0, 2).toUpperCase() || "U"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-foreground truncate block">
                              {rev.authorName}
                            </span>
                            {rev.relativeTimeDescription && (
                              <span className="text-xs text-muted-foreground block">
                                {rev.relativeTimeDescription}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Star rating for this review */}
                        {typeof rev.rating === "number" && rev.rating > 0 && (
                          <div className="flex items-center gap-1 shrink-0 bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-bold text-foreground">
                              {rev.rating}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Review text content */}
                      {rev.text && (
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                          {rev.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Community Reviews Section */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <h4 className="text-sm font-bold text-foreground">From our community</h4>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  TS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/90 font-medium">
                    {locale === "vi"
                      ? `Hãy là người đầu tiên chia sẻ cảm nhận về ${place.name} trên TripSense.`
                      : `Be the first to add a review for ${place.name} on TripSense.`}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3.5 py-1 rounded-full border border-border/80 text-xs font-semibold hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0"
                >
                  + {locale === "vi" ? "Viết đánh giá" : "Add review"}
                </button>
              </div>
            </div>
          </div>

          {/* 6. Section 3: Location */}
          <div ref={locationRef} id="section-location" className="space-y-4 pt-6 border-t border-border/60 scroll-mt-28">
            <h3 className="text-lg font-bold text-foreground">Location</h3>
            <div className="flex items-start gap-2 text-sm text-foreground/90">
              <MapPin className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
              <span>{place.address || locationDisplay}</span>
            </div>

            {/* Embedded Mini-Map Card */}
            <div className="relative h-[280px] sm:h-[340px] w-full rounded-2xl overflow-hidden border border-border/70 bg-muted">
              {/* Map Preview Background with Pin */}
              <div className="absolute inset-0 bg-sky-50 dark:bg-zinc-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1.5 animate-bounce">
                  <div className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg">
                    <CategoryIcon category={primaryCategory} />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-background/90 text-foreground border border-border/60 shadow-xs">
                    {place.name}
                  </span>
                </div>
              </div>

              {/* Floating Get Directions button */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${place.name} ${place.address || locationDisplay}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 left-3 px-3.5 py-1.5 rounded-full bg-background/90 hover:bg-background text-foreground text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
              >
                <Navigation className="h-3.5 w-3.5 text-primary" />
                <span>Get directions</span>
              </a>

              {/* Top-Right Expand button */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${place.name} ${place.address || locationDisplay}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/90 hover:bg-background text-foreground shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                aria-label="Expand map"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
