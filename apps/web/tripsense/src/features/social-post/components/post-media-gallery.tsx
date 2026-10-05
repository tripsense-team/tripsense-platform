"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { ImageLightbox } from "./image-lightbox";

interface PostMediaGalleryProps {
  mediaUrls?: string[];
  className?: string;
}

export function PostMediaGallery({
  mediaUrls,
  className,
}: PostMediaGalleryProps) {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  if (!mediaUrls || mediaUrls.length === 0) {
    return null;
  }

  const count = mediaUrls.length;

  return (
    <>
      {/* 1 Photo: Full-width responsive hero */}
      {count === 1 && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border/80 bg-muted/40",
            className,
          )}
        >
          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(0)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(0);
              }
            }}
            className="group relative w-full aspect-[16/9] sm:aspect-[21/10] max-h-[480px] overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[0]}
              alt="Post media 1"
              fill
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
              priority={false}
            />
          </figure>
        </div>
      )}

      {/* 2 Photos: 2 side-by-side balanced columns */}
      {count === 2 && (
        <div
          className={cn(
            "grid grid-cols-2 gap-2 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 h-[220px] sm:h-[280px]",
            className,
          )}
        >
          {mediaUrls.map((url, idx) => (
            <figure
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => setLightboxIndex(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLightboxIndex(idx);
                }
              }}
              className="group relative h-full w-full overflow-hidden cursor-pointer"
              aria-label={t("social.viewImage")}
            >
              <Image
                src={url}
                alt={`Post media ${idx + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, 576px"
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
              />
            </figure>
          ))}
        </div>
      )}

      {/* 3 Photos: Magazine asymmetric grid (1 large left, 2 stacked right) */}
      {count === 3 && (
        <div
          className={cn(
            "grid grid-cols-2 sm:grid-cols-[1.45fr_0.8fr] grid-rows-[210px_105px] sm:grid-rows-[150px_150px] gap-2 overflow-hidden rounded-2xl border border-border/80 bg-muted/40",
            className,
          )}
          aria-label={t("social.communityFeed")}
        >
          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(0)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(0);
              }
            }}
            className="group relative col-span-2 sm:col-span-1 sm:row-span-2 overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[0]}
              alt="Post media 1"
              fill
              sizes="(max-width: 640px) 100vw, 720px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
          </figure>

          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(1)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(1);
              }
            }}
            className="group relative col-span-1 overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[1]}
              alt="Post media 2"
              fill
              sizes="(max-width: 640px) 50vw, 400px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
          </figure>

          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(2)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(2);
              }
            }}
            className="group relative col-span-1 overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[2]}
              alt="Post media 3"
              fill
              sizes="(max-width: 640px) 50vw, 400px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
          </figure>
        </div>
      )}

      {/* 4 or more photos: Magazine asymmetric grid with "+N" badge on 3rd photo */}
      {count >= 4 && (
        <div
          className={cn(
            "grid grid-cols-2 sm:grid-cols-[1.45fr_0.8fr] grid-rows-[210px_105px] sm:grid-rows-[150px_150px] gap-2 overflow-hidden rounded-2xl border border-border/80 bg-muted/40",
            className,
          )}
          aria-label={t("social.communityFeed")}
        >
          {/* Main featured photo (Left side on desktop, top on mobile) */}
          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(0)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(0);
              }
            }}
            className="group relative col-span-2 sm:col-span-1 sm:row-span-2 overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[0]}
              alt="Post media 1"
              fill
              sizes="(max-width: 640px) 100vw, 720px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
          </figure>

          {/* Second photo (Top right) */}
          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(1)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(1);
              }
            }}
            className="group relative col-span-1 overflow-hidden cursor-pointer"
            aria-label={t("social.viewImage")}
          >
            <Image
              src={mediaUrls[1]}
              alt="Post media 2"
              fill
              sizes="(max-width: 640px) 50vw, 400px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
          </figure>

          {/* Third photo (Bottom right with "+N photos" overlay) */}
          <figure
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(2)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxIndex(2);
              }
            }}
            className="group relative col-span-1 overflow-hidden cursor-pointer"
            aria-label={t("social.morePhotos", { count: count - 3 })}
          >
            <Image
              src={mediaUrls[2]}
              alt="Post media 3"
              fill
              sizes="(max-width: 640px) 50vw, 400px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            />
            {count > 3 && (
              <span className="absolute right-2.5 bottom-2.5 z-10 px-2.5 py-1 rounded-full bg-black/75 text-white font-bold text-xs tracking-tight backdrop-blur-xs shadow-md">
                {t("social.morePhotos", { count: count - 3 })}
              </span>
            )}
          </figure>
        </div>
      )}

      {/* Lightbox Modal */}
      <ImageLightbox
        images={mediaUrls}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
