"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<
  HTMLInputElement,
  SearchInputProps
>(({ className, value, onChange, onClear, placeholder = "Search destinations, places...", ...props }, ref) => {
  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9 pr-8"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear search</span>
        </button>
      )}
    </div>
  );
});
SearchInput.displayName = "SearchInput";
