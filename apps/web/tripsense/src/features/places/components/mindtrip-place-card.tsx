"use client";

import * as React from "react";
import Image from "next/image";
import {
  Heart,
  PlusCircle,
  CheckCircle2,
  Info,
  Star,
  Utensils,
  Coffee,
  Waves,
  Landmark,
  Compass,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Hotel,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Place } from "../types";
import { loadPlacePhotoGallery } from "../services/place-photo-enrichment";
import {
  approvedPhotoGallery,
  freshApprovedPhotoGallery,
} from "../utils/approved-photo";

export interface MindtripPlaceCardProps {
  place: Place;
  isSelected?: boolean;
  isFavorite?: boolean;
  isAddedToTrip?: boolean;
  onClick?: () => void;
  onViewDetails?: () => void;
  onToggleFavorite?: (placeId: string, isFav: boolean) => void;
  onAddToTrip?: (place: Place) => void;
  /** Optional override for the price/status row (row 4). When provided, replaces default price text. */
  priceLabel?: React.ReactNode;
  className?: string;
}

function CategoryIcon({ category = "" }: { category?: string }) {
  const className = "h-3.5 w-3.5 text-muted-foreground/80 shrink-0";
  const text = category.toLowerCase();
  if (/cà phê|cafe|coffee/i.test(text)) return <Coffee className={className} />;
  if (/ăn|quán|bún|phở|mì|cơm|bánh|lẩu|restaurant|food|ẩm thực|nướng|pizza|vietnamese/i.test(text))
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

function MindtripPlaceCardComponent({
  place,
  isSelected = false,
  isFavorite = false,
  isAddedToTrip = false,
  onClick,
  onViewDetails,
  onToggleFavorite,
  onAddToTrip,
  priceLabel,
  className,
}: MindtripPlaceCardProps) {
  const { t, locale } = useTranslation();
  const visibilityRef = React.useRef<HTMLDivElement>(null);
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [failedPhotoUrls, setFailedPhotoUrls] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [loadedPhotos, setLoadedPhotos] = React.useState(() =>
    freshApprovedPhotoGallery(place),
  );

  React.useEffect(() => {
    setPhotoIndex(0);
    setFailedPhotoUrls(new Set());
    setLoadedPhotos(freshApprovedPhotoGallery(place));
  }, [place.id]);
  const [priceCheckedAt] = React.useState(() => Date.now());
  const evidence = place.priceEvidence;
  const evidenceTime = evidence ? Date.parse(evidence.observedAt) : NaN;
  const hasSourcedPrice = evidence && Number.isSafeInteger(evidence.amountVnd)
    && evidence.amountVnd >= 0 && evidence.amountVnd <= 1_000_000_000
    && ["PER_PERSON_VISIT", "PER_PERSON_NIGHT"].includes(evidence.basis)
    && /^https:\/\//i.test(evidence.sourceUrl)
    && Number.isFinite(evidenceTime) && evidenceTime <= priceCheckedAt
    && evidenceTime >= priceCheckedAt - 30 * 24 * 60 * 60 * 1000;

  const primaryCategory =
    place.categories?.[0] || t("places.defaultCategory", { defaultValue: "Place" });

  const isStay = React.useMemo(() => {
    const cat = (place.categories || []).join(" ").toLowerCase();
    const name = (place.name || "").toLowerCase();
    return (
      cat.includes("stay") ||
      cat.includes("hotel") ||
      cat.includes("resort") ||
      cat.includes("lodging") ||
      cat.includes("khách sạn") ||
      cat.includes("nhà nghỉ") ||
      cat.includes("homestay") ||
      name.includes("hotel") ||
      name.includes("khách sạn") ||
      name.includes("resort") ||
      name.includes("homestay")
    );
  }, [place.categories, place.name]);

  const photosEnabled = process.env.NEXT_PUBLIC_PLACE_PHOTOS_ENABLED === "true";
  const freshPlacePhotos = React.useMemo(
    () => freshApprovedPhotoGallery(place),
    [place],
  );
  const candidatePhotos = React.useMemo(
    () =>
      photosEnabled
        ? loadedPhotos.length > 0
          ? loadedPhotos
          : freshPlacePhotos
        : approvedPhotoGallery(
            place.photoGallery,
            place.primaryPhoto,
            place.photos,
          ),
    [
      freshPlacePhotos,
      loadedPhotos,
      photosEnabled,
      place.photoGallery,
      place.primaryPhoto,
      place.photos,
    ],
  );
  const displayPhotos = React.useMemo(
    () => candidatePhotos.filter((photo) => !failedPhotoUrls.has(photo.url)),
    [candidatePhotos, failedPhotoUrls],
  );

  React.useEffect(() => {
    if (!photosEnabled || freshPlacePhotos.length > 0) return;
    const element = visibilityRef.current;
    if (!element) return;

    let active = true;
    let requested = false;
    const requestPhotos = () => {
      if (requested) return;
      requested = true;
      void loadPlacePhotoGallery(place).then((photos) => {
        if (active && photos.length > 0) setLoadedPhotos(photos);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      requestPhotos();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            requestPhotos();
            observer.disconnect();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
      };
    }

    return () => {
      active = false;
    };
  }, [freshPlacePhotos.length, photosEnabled, place]);

  const validPhotos = displayPhotos;

  const safePhotoIndex = validPhotos.length > 0
    ? Math.min(photoIndex, validPhotos.length - 1)
    : 0;
  const currentPhoto = validPhotos[safePhotoIndex];

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : validPhotos.length - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev < validPhotos.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(place.id, !isFavorite);
  };

  const handleAddTrip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToTrip?.(place);
  };

  const locationDisplay =
    [place.district, place.city].filter(Boolean).join(", ") ||
    place.address ||
    (locale === "vi" ? "Đà Nẵng" : "Da Nang");

  return (
    <div
      ref={visibilityRef}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group flex flex-col shrink-0 w-full cursor-pointer select-none outline-hidden",
        className
      )}
    >
      {/* Photo Frame Container (Rounded-2xl, Borderless, Aspect 4/3) */}
      <div
        className={cn(
          "relative aspect-[4/3] w-full min-h-[170px] shrink-0 overflow-hidden rounded-2xl bg-muted transition-all duration-200 select-none",
          isSelected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
            : ""
        )}
      >
        {currentPhoto?.url ? (
          <Image
            src={currentPhoto.url}
            alt={place.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => {
              setFailedPhotoUrls((previous) => {
                const next = new Set(previous);
                next.add(currentPhoto.url);
                return next;
              });
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/80 via-muted to-muted/60 text-muted-foreground select-none p-4 text-center">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs">
              {t("places.noLicensedPhotos", { defaultValue: "No photos available" })}
            </span>
          </div>
        )}

        {/* Carousel Left / Right Navigation Arrows */}
        {validPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevPhoto}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7.5 w-7.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 duration-200 shadow-md active:scale-95 z-20 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={handleNextPhoto}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7.5 w-7.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 duration-200 shadow-md active:scale-95 z-20 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Top-Right Action Buttons: Heart + Plus Circle */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20">
          {/* Favorite / Heart */}
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={isFavorite ? t("places.unsavePlace") : t("places.savePlace")}
            className="p-1 text-white hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            <Heart
              className={cn(
                "h-6 w-6 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
                isFavorite
                  ? "fill-rose-500 text-rose-500 stroke-rose-500"
                  : "text-white fill-none stroke-[2]"
              )}
            />
          </button>

          {/* Add to Trip / Plus */}
          <button
            type="button"
            onClick={handleAddTrip}
            aria-label={isAddedToTrip ? t("places.addedToTrip") : t("places.addToTrip")}
            className="p-1 text-white hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            {isAddedToTrip ? (
              <CheckCircle2 className="h-6 w-6 text-primary fill-background drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] stroke-[2]" />
            ) : (
              <PlusCircle className="h-6 w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] stroke-[2]" />
            )}
          </button>
        </div>

        {/* Bottom-Right Info (i) Button */}
        {onViewDetails && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            aria-label={t("places.viewDetails")}
            className="absolute bottom-2.5 right-2.5 p-1 text-white hover:scale-110 active:scale-90 transition-transform z-20 cursor-pointer"
          >
            <Info className="h-5 w-5 text-white stroke-[2] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          </button>
        )}

        {/* Pagination Dots (Center Bottom) */}
        {validPhotos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 pointer-events-none">
            {validPhotos.slice(0, 5).map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 drop-shadow-sm",
                  idx === safePhotoIndex
                    ? "w-2.5 bg-white"
                    : "w-1.5 bg-white/60"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Content Details Underneath Photo */}
      <div className="pt-2.5 space-y-1">
        {/* Row 1: Title and Star Rating */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "font-bold text-[15px] sm:text-base leading-snug line-clamp-2 transition-colors flex-1",
              isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
            )}
          >
            {place.name}
          </h3>

          {typeof place.rating === "number" && place.rating > 0 && (
            <div className="flex items-center gap-1 text-[13px] sm:text-sm shrink-0 font-semibold pt-0.5">
              <Star className="h-3.5 w-3.5 fill-foreground text-foreground shrink-0" />
              <span className="text-foreground">{formatRating(place.rating, locale)}</span>
              {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({formatReviewCount(place.userRatingCount, locale)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Category with Icon */}
        <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-muted-foreground">
          <CategoryIcon category={primaryCategory} />
          <span className="capitalize line-clamp-1">
            {primaryCategory.replace(/_/g, " ")}
          </span>
        </div>

        {/* Row 3: Location */}
        <p className="text-xs sm:text-[13px] text-muted-foreground line-clamp-1">
          {locationDisplay}
        </p>

        {/* Row 4: Price Level / Nightly Rate */}
        {priceLabel ? (
          <div>{priceLabel}</div>
        ) : hasSourcedPrice ? (
          <p className="text-xs sm:text-[13px] text-muted-foreground font-medium">
            <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              title={place.dailyBudgetExceeded ? t("places.dailyBudget.exceeded") : undefined}>
              {t(evidence.basis === "PER_PERSON_NIGHT" ? "places.dailyBudget.perNight" : "places.dailyBudget.perVisit", {
                amount: new Intl.NumberFormat(locale).format(evidence.amountVnd),
              })}
              {place.dailyBudgetExceeded && ` · ${t("places.dailyBudget.exceeded")}`}
            </a>
          </p>
        ) : (
          <p className="text-xs sm:text-[13px] text-muted-foreground font-medium">
            {isStay ? (locale === "vi" ? "Liên hệ đặt phòng" : "Contact for rates") : "$$"}
          </p>
        )}
      </div>
    </div>
  );
}

export const MindtripPlaceCard = React.memo(
  MindtripPlaceCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isFavorite === nextProps.isFavorite &&
      prevProps.isAddedToTrip === nextProps.isAddedToTrip &&
      prevProps.priceLabel === nextProps.priceLabel &&
      prevProps.place.id === nextProps.place.id &&
      prevProps.place.name === nextProps.place.name &&
      prevProps.place.rating === nextProps.place.rating &&
      prevProps.place.userRatingCount === nextProps.place.userRatingCount &&
      prevProps.place.primaryPhoto?.url === nextProps.place.primaryPhoto?.url &&
      prevProps.place.address === nextProps.place.address &&
      prevProps.className === nextProps.className
    );
  }
);
