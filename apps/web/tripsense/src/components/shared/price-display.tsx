import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  priceLevel?: 1 | 2 | 3 | 4 | number;
  priceText?: string;
  currencySymbol?: string;
  className?: string;
}

export function PriceDisplay({
  priceLevel,
  priceText,
  currencySymbol = "$",
  className,
}: PriceDisplayProps) {
  if (priceText) {
    return <span className={cn("text-sm font-semibold text-foreground", className)}>{priceText}</span>;
  }

  if (!priceLevel) return null;

  const activeCount = Math.min(Math.max(priceLevel, 1), 4);
  const activeDollars = currencySymbol.repeat(activeCount);
  const inactiveDollars = currencySymbol.repeat(4 - activeCount);

  return (
    <span className={cn("text-xs font-semibold tracking-wider", className)}>
      <span className="text-foreground">{activeDollars}</span>
      <span className="text-muted-foreground/40">{inactiveDollars}</span>
    </span>
  );
}
