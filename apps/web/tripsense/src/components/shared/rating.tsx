import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  value: number;
  reviewCount?: number;
  showText?: boolean;
  className?: string;
}

export function Rating({
  value,
  reviewCount,
  showText = true,
  className,
}: RatingProps) {
  const formattedRating = Number(value).toFixed(1);
  const formattedReviewCount = reviewCount !== undefined ? reviewCount.toLocaleString("en-US") : "";

  return (
    <div className={cn("inline-flex items-center gap-1 text-sm font-medium", className)}>
      <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
      <span>{formattedRating}</span>
      {reviewCount !== undefined && showText && (
        <span className="text-muted-foreground text-xs">
          ({formattedReviewCount})
        </span>
      )}
    </div>
  );
}
