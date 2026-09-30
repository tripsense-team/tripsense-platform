"use client";

import * as React from "react";
import { ModalBackdrop } from "./modal-backdrop";

export type BudgetTier = "any" | "budget" | "sensible" | "upscale" | "luxury";

type BudgetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialBudget?: BudgetTier;
  onSave: (budget: BudgetTier) => void;
};

const BUDGET_OPTIONS: { id: BudgetTier; label: string; prefix?: string }[] = [
  { id: "any", label: "Any budget" },
  { id: "budget", prefix: "$", label: "On a budget" },
  { id: "sensible", prefix: "$$", label: "Sensibly priced" },
  { id: "upscale", prefix: "$$$", label: "Upscale" },
  { id: "luxury", prefix: "$$$$", label: "Luxury" },
];

export function BudgetModal({
  isOpen,
  onClose,
  initialBudget = "any",
  onSave,
}: BudgetModalProps) {
  const [selectedBudget, setSelectedBudget] = React.useState<BudgetTier>(initialBudget);

  React.useEffect(() => {
    setSelectedBudget(initialBudget);
  }, [initialBudget, isOpen]);

  const handleSave = () => {
    onSave(selectedBudget);
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Budget"
      subtitle="Select your budget range"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col space-y-4">
        {/* Radio List */}
        <div className="flex flex-col space-y-3.5 py-2">
          {BUDGET_OPTIONS.map((option) => {
            const isSelected = selectedBudget === option.id;

            return (
              <label
                key={option.id}
                onClick={() => setSelectedBudget(option.id)}
                className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer select-none group"
              >
                {/* Custom radio button */}
                <div
                  className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-black dark:border-white"
                      : "border-neutral-400 group-hover:border-foreground"
                  }`}
                >
                  {isSelected && (
                    <div className="size-2.5 rounded-full bg-black dark:bg-white" />
                  )}
                </div>

                {/* Option text */}
                <div className="flex items-center gap-2 text-sm md:text-base font-medium text-foreground">
                  {option.prefix && (
                    <span className="font-semibold text-foreground/90 w-8">
                      {option.prefix}
                    </span>
                  )}
                  <span>{option.label}</span>
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer: Update button aligned to right matching Mindtrip screenshot */}
        <div className="flex justify-end pt-4 border-t border-border/40">
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
