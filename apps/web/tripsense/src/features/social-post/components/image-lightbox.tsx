"use client";

import * as React from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onClose,
}: ImageLightboxProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  // Sync index when initialIndex changes or modal opens
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [open, initialIndex, images.length]);

  const total = images.length;
  const hasMultiple = total > 1;

  const handlePrev = React.useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext, onClose]);

  if (!open || total === 0) return null;

  const currentUrl = images[currentIndex] || "";

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Dark Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />

        {/* Lightbox Container */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-6 outline-hidden select-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {t("social.viewImage")}
          </DialogPrimitive.Title>

          {/* Top Bar: Counter & Close Button */}
          <header className="flex items-center justify-between text-white/90 z-10">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md">
                {t("social.imageCounter", { current: currentIndex + 1, total })}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label={t("social.closeLightbox")}
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Center Stage: Main Image & Navigation Arrows */}
          <div className="relative flex-1 flex items-center justify-center min-h-0 my-2 sm:my-4">
            {/* Previous Button */}
            {hasMultiple && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-1 sm:left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 hover:text-white cursor-pointer active:scale-95 focus:outline-hidden"
                aria-label={t("social.prevImage")}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Active Display Image */}
            <div className="relative h-full w-full max-h-[78vh] sm:max-h-[82vh] max-w-[94vw] sm:max-w-[86vw] flex items-center justify-center">
              <Image
                key={currentUrl}
                src={currentUrl}
                alt={`Photo ${currentIndex + 1}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1400px"
                className="object-contain transition-opacity duration-200"
              />
            </div>

            {/* Next Button */}
            {hasMultiple && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-1 sm:right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 hover:text-white cursor-pointer active:scale-95 focus:outline-hidden"
                aria-label={t("social.nextImage")}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip (if multiple photos) */}
          {hasMultiple && (
            <footer className="z-10 flex justify-center overflow-x-auto py-2 gap-2 max-w-full px-2">
              <div className="flex gap-2 p-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 overflow-x-auto max-w-xl">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl transition-all cursor-pointer",
                      currentIndex === idx
                        ? "ring-2 ring-primary scale-105 opacity-100"
                        : "opacity-50 hover:opacity-80",
                    )}
                    aria-label={`Thumbnail ${idx + 1}`}
                  >
                    <Image
                      src={url}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
