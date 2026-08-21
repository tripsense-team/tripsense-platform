"use client";

import * as React from "react";
import Image from "next/image";
import {
  MapPin,
  Clock,
  Star,
  Phone,
  Globe,
  ExternalLink,
  Navigation,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPlacePhotoUrl, getPlaceGalleryPhotos } from "../utils/place-photo";
import { fetchGoogleReviews } from "../services/places-api";
import type { Place } from "../types";

export interface PlaceDetailModalProps {
  place: Place | null;
  isOpen: boolean;
  isLoadingDetails?: boolean;
  onClose: () => void;
}

export function PlaceDetailModal({ place: initialPlace, isOpen, isLoadingDetails = false, onClose }: PlaceDetailModalProps) {
  const [currentPlace, setCurrentPlace] = React.useState<Place | null>(initialPlace);
  const [isLoadingReviews, setIsLoadingReviews] = React.useState(false);

  React.useEffect(() => {
    setCurrentPlace(initialPlace);
  }, [initialPlace]);

  if (!currentPlace) return null;

  const place = currentPlace;
  const primaryCategory = place.categories && place.categories.length > 0 ? place.categories[0] : null;
  const photoUrl = getPlacePhotoUrl(place);
  const galleryPhotos = getPlaceGalleryPhotos(place);

  const handleFetchGoogleReviews = async () => {
    if (!place) return;
    setIsLoadingReviews(true);
    try {
      const res = await fetchGoogleReviews(place.id, place.name, place.location?.lat, place.location?.lng);
      if (res && res.success && res.data) {
        setCurrentPlace(res.data);
      }
    } catch (err) {
      console.error("Error fetching Google reviews:", err);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header Block - Clean, Modern, Never Overlaps */}
        <div className="w-full p-6 bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-medium text-xs mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="capitalize">{primaryCategory?.replace(/_/g, " ") || "Địa điểm khám phá"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            {place.name}
          </h2>
          {typeof place.rating === "number" && place.rating > 0 && (
            <div className="flex items-center gap-1.5 pt-2 text-xs font-bold text-amber-500">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-foreground">{place.rating.toFixed(1)}</span>
              {typeof place.userRatingCount === "number" && (
                <span className="text-muted-foreground font-normal">
                  ({place.userRatingCount.toLocaleString()} đánh giá)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {isLoadingDetails ? (
            /* Full-card skeleton loading — hide MapVina data until ZioMap enrichment completes */
            <div className="space-y-5 animate-pulse">
              {/* Address skeleton */}
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/50 border border-border/40">
                <div className="w-4 h-4 rounded bg-muted-foreground/20 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 bg-muted-foreground/20 rounded" />
                  <div className="h-3 w-1/2 bg-muted-foreground/15 rounded" />
                </div>
              </div>

              {/* Opening hours skeleton */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-muted/50 border border-border/40">
                <div className="w-4 h-4 rounded bg-muted-foreground/20 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-muted-foreground/20 rounded" />
                  <div className="space-y-1.5 pt-1">
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i} className="flex justify-between">
                        <div className="h-2.5 w-16 bg-muted-foreground/15 rounded" />
                        <div className="h-2.5 w-24 bg-muted-foreground/15 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons skeleton */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-9 w-28 rounded-xl bg-emerald-600/30" />
                <div className="h-9 w-36 rounded-xl bg-muted-foreground/15" />
                <div className="h-9 w-24 rounded-xl bg-muted-foreground/15" />
              </div>

              {/* Reviews skeleton */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted-foreground/20" />
                  <div className="h-4 w-40 bg-muted-foreground/20 rounded" />
                </div>
                <div className="p-6 rounded-2xl bg-muted/40 border border-border/60 flex flex-col items-center justify-center gap-3">
                  <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Đang tải thông tin chi tiết từ Google...
                  </span>
                </div>
              </div>

              {/* Footer skeleton */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <div className="h-9 w-16 rounded-xl bg-muted-foreground/15" />
                <div className="h-9 w-32 rounded-xl bg-muted-foreground/20" />
              </div>
            </div>
          ) : (
            /* Real content — only shown after enrichment is complete */
            <>
          {/* Key Info Grid */}
          <div className="grid grid-cols-1 gap-3 text-xs">
            {place.address && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/50 border border-border/40">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium leading-relaxed">{place.address}</p>
                  {place.oldAddress && (
                    <p className="text-[11px] text-muted-foreground/80 italic mt-1">
                      Địa chỉ cũ: {place.oldAddress}
                    </p>
                  )}
                </div>
              </div>
            )}

            {place.openingHours && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-muted/50 border border-border/40">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-foreground text-xs">Giờ hoạt động</span>
                    {place.businessStatus && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {place.businessStatus === "OPERATIONAL" ? "Đang mở cửa" : place.businessStatus}
                      </span>
                    )}
                  </div>
                  {place.openingHours.includes(";") ? (
                    <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                      {place.openingHours.split(";").map((line, idx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        const colonIdx = trimmed.indexOf(":");
                        if (colonIdx > -1) {
                          const day = trimmed.substring(0, colonIdx).trim();
                          const time = trimmed.substring(colonIdx + 1).trim();
                          return (
                            <div key={idx} className="flex items-center justify-between py-0.5">
                              <span className="font-medium text-foreground/80">{day}</span>
                              <span className="text-foreground/90 font-mono text-[11px]">{time}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="py-0.5 text-foreground/80">
                            {trimmed}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-foreground leading-relaxed">{place.openingHours}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {place.location && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Dẫn đường</span>
                </a>
              )}

              {place.phone && (
                <a
                  href={`tel:${place.phone}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted border border-border/40 text-foreground transition-colors cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{place.phone}</span>
                </a>
              )}

              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted border border-border/40 text-foreground transition-colors cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate max-w-[200px]">Trang web</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              )}

              {((place.socials && place.socials.length > 0) || place.website?.includes("facebook.com")) && (
                <a
                  href={place.socials?.[0] || place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold transition-colors cursor-pointer"
                >
                  <span>📘 Facebook</span>
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {place.description && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-foreground">Giới thiệu</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {place.description}
              </p>
            </div>
          )}

          {/* Customer Reviews Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  Đánh giá từ khách hàng {place.reviews && place.reviews.length > 0 ? `(${place.reviews.length})` : ""}
                </span>
              </div>
            </div>

            {place.reviews && place.reviews.length > 0 ? (
              <div className="space-y-3">
                {place.reviews.map((rev, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-muted/50 border border-border/60 space-y-1.5 text-xs transition-opacity duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rev.profilePhotoUrl && (
                          <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0">
                            <Image src={rev.profilePhotoUrl} alt={rev.authorName} fill className="object-cover" />
                          </div>
                        )}
                        <span className="font-bold text-foreground">{rev.authorName}</span>
                      </div>
                      {rev.rating && (
                        <div className="flex items-center gap-1 text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{rev.rating}</span>
                        </div>
                      )}
                    </div>
                    {rev.relativeTimeDescription && (
                      <span className="text-[11px] text-muted-foreground block">{rev.relativeTimeDescription}</span>
                    )}
                    {rev.text && (
                      <p className="text-muted-foreground leading-relaxed pt-1 text-xs">{rev.text}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* On-Demand Google Reviews Button - only if loading done and still no reviews */
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 text-center space-y-2.5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-foreground">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Đánh giá từ Google Maps</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Xem nhận xét và cảm nhận thực tế từ du khách đã trải nghiệm địa điểm này.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFetchGoogleReviews}
                  disabled={isLoadingReviews}
                  className="rounded-xl px-4 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer hover:bg-secondary/80"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Xem đánh giá từ Google</span>
                </Button>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl px-5 text-xs font-semibold">
              Đóng
            </Button>
            {place.location && (
              <Button
                asChild
                className="rounded-xl px-5 text-xs font-semibold gap-1.5"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Mở bản đồ ngoài</span>
                </a>
              </Button>
            )}
          </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
