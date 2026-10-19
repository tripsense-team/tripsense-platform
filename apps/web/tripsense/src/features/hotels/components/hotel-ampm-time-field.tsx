import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HotelAmPmTimeFieldProps {
  name: string;
  label: string;
  defaultValue: string;
  className?: string;
  compact?: boolean;
}

export function HotelAmPmTimeField({
  name,
  label,
  defaultValue,
  className,
  compact = false,
}: HotelAmPmTimeFieldProps) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Input
        aria-label={label}
        className={cn(compact && "h-9 text-xs")}
        defaultValue={defaultValue}
        lang="en-US"
        name={name}
        required
        step={60}
        type="time"
      />
    </label>
  );
}
