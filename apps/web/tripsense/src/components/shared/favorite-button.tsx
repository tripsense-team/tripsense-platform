"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  isFavorite?: boolean;
  onToggle?: (favorite: boolean) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function FavoriteButton({
  isFavorite = false,
  onToggle,
  className,
  size = "default",
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = React.useState(isFavorite);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextState = !favorite;
    setFavorite(nextState);
    onToggle?.(nextState);
  };

  const buttonSize =
    size === "sm"
      ? "h-9 w-9 [&_svg]:size-4"
      : size === "lg"
        ? "h-11 w-11 [&_svg]:size-5"
        : "h-10 w-10 [&_svg]:size-5";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn(
        "rounded-full bg-background/80 backdrop-blur hover:bg-background shadow-sm transition-all",
        buttonSize,
        favorite
          ? "text-red-500 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Heart
        className={cn(
          "transition-transform active:scale-125",
          favorite && "fill-current",
        )}
      />
      <span className="sr-only">Toggle Favorite</span>
    </Button>
  );
}
