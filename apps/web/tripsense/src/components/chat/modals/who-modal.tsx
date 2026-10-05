"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { ModalBackdrop } from "./modal-backdrop";

type WhoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialCounts?: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  onSave: (counts: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  }) => void;
};

const DEFAULT_COUNTS = {
  adults: 1,
  children: 0,
  infants: 0,
  pets: 0,
} as const;

export function WhoModal({
  isOpen,
  onClose,
  initialCounts = DEFAULT_COUNTS,
  onSave,
}: WhoModalProps) {
  const [counts, setCounts] = React.useState(initialCounts);

  React.useEffect(() => {
    if (!isOpen) return;
    setCounts((current) => {
      if (
        current.adults === initialCounts.adults &&
        current.children === initialCounts.children &&
        current.infants === initialCounts.infants &&
        current.pets === initialCounts.pets
      ) {
        return current;
      }
      return initialCounts;
    });
  }, [
    initialCounts.adults,
    initialCounts.children,
    initialCounts.infants,
    initialCounts.pets,
    isOpen,
  ]);

  const updateCount = (key: keyof typeof counts, delta: number) => {
    setCounts((prev) => {
      const min = key === "adults" ? 1 : 0;
      const nextVal = Math.max(min, prev[key] + delta);
      return { ...prev, [key]: nextVal };
    });
  };

  // Traveler summary text
  const totalTravelers = counts.adults + counts.children;
  const travelerText =
    totalTravelers === 1 ? "1 traveler" : `${totalTravelers} travelers`;

  const handleSave = () => {
    onSave(counts);
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Who"
      subtitle={travelerText}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col space-y-4">
        {/* Counter Rows */}
        <div className="divide-y divide-border/50">
          {/* Adults */}
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="font-semibold text-sm text-foreground">Adults</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Ages 13 or above
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.adults <= 1}
                onClick={() => updateCount("adults", -1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Decrease adults"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-foreground">
                {counts.adults}
              </span>
              <button
                type="button"
                onClick={() => updateCount("adults", 1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Increase adults"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="font-semibold text-sm text-foreground">Children</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Ages 2–12
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.children <= 0}
                onClick={() => updateCount("children", -1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Decrease children"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-foreground">
                {counts.children}
              </span>
              <button
                type="button"
                onClick={() => updateCount("children", 1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Increase children"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Infants */}
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="font-semibold text-sm text-foreground">Infants</div>
              <div className="text-xs text-muted-foreground mt-0.5">Under 2</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.infants <= 0}
                onClick={() => updateCount("infants", -1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Decrease infants"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-foreground">
                {counts.infants}
              </span>
              <button
                type="button"
                onClick={() => updateCount("infants", 1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Increase infants"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Pets */}
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="font-semibold text-sm text-foreground">Pets</div>
              <a
                href="#service-animal"
                onClick={(e) => e.preventDefault()}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors mt-0.5 inline-block"
              >
                Bringing a service animal?
              </a>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.pets <= 0}
                onClick={() => updateCount("pets", -1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Decrease pets"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-foreground">
                {counts.pets}
              </span>
              <button
                type="button"
                onClick={() => updateCount("pets", 1)}
                className="size-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Increase pets"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Update button aligned to right matching Mindtrip screenshot */}
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-8 py-2.5 text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            Update
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
