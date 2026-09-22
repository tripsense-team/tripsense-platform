"use client";

import * as React from "react";
import Image from "next/image";
import type { Place } from "../types";
import { approvedPhotoGallery } from "../utils/approved-photo";

export function PlacePhotoGallery({ place, loading }: { place: Place; loading: boolean }) {
  const [failed, setFailed] = React.useState<Set<string>>(() => new Set());
  const photos = approvedPhotoGallery(place.photoGallery, place.primaryPhoto, place.photos);
  const supportingGrid = photos.length === 2 ? "grid-cols-1"
    : photos.length === 3 ? "grid-cols-1 grid-rows-2"
      : "grid-cols-2 grid-rows-2";

  if (!photos.length) {
    return <div className="flex h-40 items-center justify-center bg-muted px-4 text-sm text-muted-foreground" role="status">
      {loading ? "Đang tải ảnh địa điểm..." : "Chưa có ảnh được cấp phép"}
    </div>;
  }

  const tile = (photo: (typeof photos)[number], index: number) => (
    <div key={photo.url} className="relative h-full min-h-0 overflow-hidden bg-muted">
      {failed.has(photo.url) ? (
        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Không tải được ảnh</div>
      ) : (
        <Image
          src={photo.url}
          alt={`${place.name} — ảnh ${index + 1}`}
          fill
          sizes={index === 0 ? "(max-width: 640px) 50vw, 400px" : "(max-width: 640px) 25vw, 200px"}
          unoptimized
          priority={index === 0}
          className="object-cover"
          onError={() => setFailed((previous) => new Set(previous).add(photo.url))}
        />
      )}
    </div>
  );

  return <figure className="bg-card" aria-label={`Ảnh địa điểm ${place.name}`}>
    <div className={`grid h-56 gap-1 sm:h-80 ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {tile(photos[0], 0)}
      {photos.length > 1 && <div className={`grid min-h-0 gap-1 bg-muted ${supportingGrid}`}>
        {photos.slice(1).map((photo, index) => <div key={photo.url}
          className={photos.length === 4 && index === 2 ? "col-span-2 min-h-0" : "min-h-0"}>
          {tile(photo, index + 1)}
        </div>)}
      </div>}
    </div>
    <figcaption className="sr-only">Ảnh địa điểm {place.name}.</figcaption>
  </figure>;
}
