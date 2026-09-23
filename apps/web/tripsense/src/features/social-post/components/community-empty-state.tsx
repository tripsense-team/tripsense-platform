"use client";

import * as React from "react";
import { Compass, Sparkles, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface CommunityEmptyStateProps {
  filter?: "all" | "updates" | "trips";
  onActionClick?: () => void;
  className?: string;
}

export function CommunityEmptyState({
  filter = "all",
  onActionClick,
  className,
}: CommunityEmptyStateProps) {
  const { t } = useTranslation();

  const content = React.useMemo(() => {
    switch (filter) {
      case "trips":
        return {
          title: t("social.emptyTripsTitle"),
          description: t("social.emptyTripsDescription"),
          buttonText: t("social.firstTrip"),
        };
      default:
        return {
          title: t("social.emptyFeed"),
          description: t("social.emptyFeedDescription"),
          buttonText: t("social.firstPost"),
        };
    }
  }, [filter, t]);

  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/60 p-8 text-center backdrop-blur-xs transition-all",
        className,
      )}
    >
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
        <Compass className="h-8 w-8 transition-transform duration-500 hover:rotate-45" />
        <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-500 animate-bounce" />
      </div>

      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
        {content.title}
      </h3>

      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        {content.description}
      </p>

      {onActionClick && (
        <div className="mt-6">
          <Button
            onClick={onActionClick}
            className="rounded-full px-6 text-sm font-semibold shadow-xs gap-2 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            {content.buttonText}
          </Button>
        </div>
      )}
    </div>
  );
}
