"use client";

import * as React from "react";
import { ModalBackdrop } from "./modal-backdrop";

type WhereModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: string;
  initialRoadTrip?: boolean;
  onSave: (data: { location: string; isRoadTrip: boolean }) => void;
};

export function WhereModal({
  isOpen,
  onClose,
  initialLocation = "",
  initialRoadTrip = false,
  onSave,
}: WhereModalProps) {
  const [location, setLocation] = React.useState(initialLocation);
  const [isRoadTrip, setIsRoadTrip] = React.useState(initialRoadTrip);

  React.useEffect(() => {
    setLocation(initialLocation);
    setIsRoadTrip(initialRoadTrip);
  }, [initialLocation, initialRoadTrip, isOpen]);

  const handleSave = () => {
    onSave({ location: location.trim(), isRoadTrip });
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Where"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col space-y-4">
        {/* Large Rounded Pill Location Input */}
        <div>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder="Location"
            autoFocus
            className="w-full rounded-full border border-neutral-900/80 dark:border-neutral-200/80 bg-background px-6 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
          />
        </div>

        {/* Road Trip Toggle aligned to right */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <span className="text-sm font-semibold text-foreground select-none">
            Road trip?
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isRoadTrip}
            onClick={() => setIsRoadTrip(!isRoadTrip)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isRoadTrip ? "bg-black dark:bg-white" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-black shadow-md ring-0 transition duration-200 ease-in-out ${
                isRoadTrip ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Centered Save Pill Button */}
        <div className="flex justify-center pt-8 pb-1">
          <button
            type="button"
            onClick={handleSave}
            className={`rounded-full px-12 py-3 text-sm font-semibold transition-all cursor-pointer ${
              location.trim().length > 0
                ? "bg-black text-white hover:bg-neutral-800 shadow-sm"
                : "bg-neutral-400/80 hover:bg-neutral-500 text-white"
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
