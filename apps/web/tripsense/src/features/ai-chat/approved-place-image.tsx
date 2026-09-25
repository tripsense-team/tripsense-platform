"use client";

import * as React from "react";
import Image from "next/image";
import { Coffee, Landmark, MapPin, Mountain, ShoppingBag, Utensils, Waves } from "lucide-react";
import type { PlacePhotoEvidence } from "@/features/places/types";
import { approvedPhoto } from "@/features/places/utils/approved-photo";

function getCategoryIcon(name: string, category = "") {
  const text = `${name} ${category}`.toLowerCase();
  if (/cà phê|cafe|coffee/i.test(text)) return Coffee;
  if (/ăn|quán|bún|phở|mì|mỳ|cao lầu|cơm|bánh|lẩu|restaurant|food|ẩm thực|nướng|thịt/i.test(text)) return Utensils;
  if (/biển|bãi|beach|sea|đảo|ocean|mỹ khê/i.test(text)) return Waves;
  if (/núi|hills|bà nà|sơn trà|đèo|hải vân|ngũ hành sơn|rừng/i.test(text)) return Mountain;
  if (/chợ|market|phố|đêm|mua sắm|shop/i.test(text)) return ShoppingBag;
  if (/chùa|temple|pagoda|linh ứng|tháp|nhà thờ|di tích|lăng|heritage|bảo tàng|museum/i.test(text)) return Landmark;
  return MapPin;
}

export function PlacePlaceholder({
  name,
  category,
  className = "h-32",
}: {
  name: string;
  category?: string;
  className?: string;
}) {
  const Icon = getCategoryIcon(name, category);
  return (
    <div
      className={`${className} relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-muted/80 p-3 select-none text-muted-foreground`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-primary shadow-2xs ring-1 ring-border/50 mb-1.5 transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-micro font-semibold text-foreground/90 text-center line-clamp-1 max-w-full px-2">
        {name}
      </span>
      <span className="text-micro text-muted-foreground line-clamp-1">
        {category || "Địa điểm thực tế"}
      </span>
    </div>
  );
}

export function ApprovedPlaceImage({
  photo,
  name,
  category,
  className = "h-32",
}: {
  photo?: PlacePhotoEvidence | { url: string; source?: string; attribution?: Array<{ displayName: string; uri?: string | null }> };
  name: string;
  category?: string;
  className?: string;
}) {
  let usable: PlacePhotoEvidence | null = null;
  if (photo) {
    usable = approvedPhoto(photo as PlacePhotoEvidence);
    if (!usable && typeof photo.url === "string" && /^https?:\/\//i.test(photo.url)) {
      usable = {
        url: photo.url,
        source: photo.source || "TripSense",
        attribution: photo.attribution || [],
        fetchedAt: new Date().toISOString(),
        displayApproved: true,
      };
    }
  }

  if (!usable) {
    return <PlacePlaceholder name={name} category={category} className={className} />;
  }

  return (
    <ImageWithFallback
      key={usable.url}
      photo={usable}
      name={name}
      category={category}
      className={className}
    />
  );
}

function ImageWithFallback({
  photo,
  name,
  category,
  className,
}: {
  photo: PlacePhotoEvidence;
  name: string;
  category?: string;
  className: string;
}) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    return <PlacePlaceholder name={name} category={category} className={className} />;
  }

  const attributionText = photo.attribution?.length
    ? photo.attribution.map((author) => author.displayName).join(" · ")
    : photo.source || "Điểm đến";

  return (
    <figure className="overflow-hidden rounded-lg bg-muted relative group">
      <Image
        src={photo.url}
        alt={`Ảnh ${name}`}
        width={640}
        height={360}
        unoptimized
        loading="lazy"
        onError={() => setHasError(true)}
        className={`${className} w-full object-cover transition-transform duration-300 group-hover:scale-105`}
      />
      <figcaption className="px-2 py-1 text-micro text-muted-foreground truncate bg-card/80 backdrop-blur-xs">
        Ảnh: {attributionText}
      </figcaption>
    </figure>
  );
}
