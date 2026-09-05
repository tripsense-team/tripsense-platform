"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PostMediaGalleryProps {
  mediaUrls?: string[];
  className?: string;
}

export function PostMediaGallery({ mediaUrls, className }: PostMediaGalleryProps) {
  if (!mediaUrls || mediaUrls.length === 0) {
    return null;
  }

  const count = mediaUrls.length;

  if (count === 1) {
    return (
      <div className={cn("overflow-hidden rounded-xl border border-border bg-muted/30", className)}>
        <div className="relative aspect-[16/9] w-full max-h-[560px] sm:aspect-[21/10]">
          <Image
            src={mediaUrls[0]}
            alt="Post media"
            fill
            sizes="(max-width: 768px) 100vw, 1152px"
            className="object-cover transition-transform duration-300 hover:scale-[1.01]"
            priority={false}
          />
        </div>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-3 overflow-hidden rounded-xl", className)}>
        {mediaUrls.map((url, idx) => (
          <div
            key={idx}
            className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            <Image
              src={url}
              alt={`Post media ${idx + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 576px"
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-hidden rounded-xl", className)}>
        {mediaUrls.map((url, idx) => (
          <div
            key={idx}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            <Image
              src={url}
              alt={`Post media ${idx + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        ))}
      </div>
    );
  }

  // 4 or more media items
  const displayItems = mediaUrls.slice(0, 4);
  const remaining = count - 4;

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-hidden rounded-xl", className)}>
      {displayItems.map((url, idx) => (
        <div
          key={idx}
          className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted/30"
        >
          <Image
            src={url}
            alt={`Post media ${idx + 1}`}
            fill
            sizes="(max-width: 768px) 50vw, 288px"
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
          {idx === 3 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-bold text-white backdrop-blur-[2px]">
              +{remaining}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
