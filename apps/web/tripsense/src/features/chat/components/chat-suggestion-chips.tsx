import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSuggestionChipsProps {
  suggestions?: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

const defaultSuggestions = [
  "Build a 3-day itinerary for Tokyo",
  "Top 5 vegetarian restaurants in Rome",
  "Best time to visit Danang beach",
  "Budget breakdown for 5 days in Paris",
];

export function ChatSuggestionChips({
  suggestions = defaultSuggestions,
  onSelect,
  className,
}: ChatSuggestionChipsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 my-3", className)}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer shadow-2xs"
        >
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span>{suggestion}</span>
        </button>
      ))}
    </div>
  );
}
