import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiLoadingSpinnerProps {
  className?: string;
  iconClassName?: string;
  size?: number;
}

/**
 * AI Loading Spinner - Mindtrip-style animated rotating circular arc
 * around a centered Sparkles icon.
 */
export function AiLoadingSpinner({
  className,
  iconClassName,
  size = 20,
}: AiLoadingSpinnerProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label="Loading AI response"
      role="status"
    >
      {/* Rotating outer arc */}
      <svg
        className="animate-spin motion-reduce:animate-none text-current"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="44 18"
          className="opacity-90"
        />
      </svg>
      {/* Centered Sparkles icon */}
      <Sparkles
        className={cn(
          "absolute inset-0 m-auto h-[55%] w-[55%] text-current pointer-events-none",
          iconClassName,
        )}
      />
    </div>
  );
}
