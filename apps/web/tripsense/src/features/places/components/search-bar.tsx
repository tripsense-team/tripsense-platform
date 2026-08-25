"use client";

import * as React from "react";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAutocomplete } from "../services/places-api";
import type { AutocompleteSuggestion } from "../types";

export interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string, suggestion?: AutocompleteSuggestion) => void;
  onClear?: () => void;
  isLoading?: boolean;
  className?: string;
}

const QUICK_SUGGESTIONS = [
  "top quán ăn ngon ở Đà Nẵng",
  "quán cafe chill gần biển",
  "nhà hàng hải sản ngon",
  "cafe đẹp để làm việc",
  "nhà hàng gần cầu Rồng",
];

export function SearchBar({
  initialQuery = "",
  onSearch,
  onClear,
  isLoading = false,
  className,
}: SearchBarProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [prevInitialQuery, setPrevInitialQuery] = React.useState(initialQuery);
  const [suggestions, setSuggestions] = React.useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Synchronize initialQuery if changed externally
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  // Debounced autocomplete fetch (300ms)
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await getAutocomplete(trimmed, undefined, undefined, 5, controller.signal);
        if (res.success && Array.isArray(res.data)) {
          setSuggestions(res.data);
          setIsOpen(res.data.length > 0);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSuggestions(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  // Handle outside click to close suggestions
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    onSearch(trimmed);
  };

  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    const selectedText = suggestion.title;
    setQuery(selectedText);
    setIsOpen(false);
    onSearch(selectedText, suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        handleSubmit();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full space-y-2", className)}>
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center w-full rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <Search className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
            setSelectedIndex(-1);
            if (nextQuery.trim().length < 2) {
              setSuggestions([]);
              setIsOpen(false);
              setIsSearchingSuggestions(false);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tìm địa điểm ở Đà Nẵng (vd: quán cafe view biển, bánh xèo...)"
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 text-sm placeholder:text-muted-foreground/70 h-12"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
              if (onClear) onClear();
            }}
            className="p-1 mr-1 text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {isSearchingSuggestions && (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin mr-2 shrink-0" />
        )}

        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="m-1 rounded-xl px-5 font-semibold text-xs h-10 shrink-0 cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tìm kiếm"}
        </Button>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg backdrop-blur-md animate-in fade-in-0 zoom-in-95">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5">
            Gợi ý địa điểm
          </div>
          <ul className="space-y-0.5">
            {suggestions.map((item, index) => (
              <li
                key={item.id || index}
                onClick={() => handleSelectSuggestion(item)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors",
                  selectedIndex === index
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{item.title}</span>
                  {item.subtitle && (
                    <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Suggestion Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs text-muted-foreground">
        <span className="shrink-0 font-medium mr-1 text-[11px]">Gợi ý:</span>
        {QUICK_SUGGESTIONS.map((sug) => (
          <button
            key={sug}
            type="button"
            onClick={() => {
              setQuery(sug);
              onSearch(sug);
            }}
            className="shrink-0 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-foreground hover:bg-accent transition-all cursor-pointer"
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  );
}
