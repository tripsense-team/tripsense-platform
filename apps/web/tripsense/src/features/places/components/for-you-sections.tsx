"use client";

import type * as React from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { DiscoverySection, SectionFeed } from "../services/recommendations-api";
import type { Place } from "../types";

const PREVIEW: DiscoverySection[] = ["ATTRACTION", "HOMESTAY", "FOOD", "CAFE"];
export const SECTION_LABELS = {
  ATTRACTION: "places.discoverySections.attractions",
  HOMESTAY: "places.discoverySections.homestays",
  FOOD: "places.discoverySections.food",
  CAFE: "places.discoverySections.cafes",
  STAY: "places.discoverySections.stays",
} as const;

export function ForYouSections({ feed, loading, error, renderCard, onMore, onRetry }: {
  feed: SectionFeed | null;
  loading: boolean;
  error: boolean;
  renderCard: (place: Place) => React.ReactNode;
  onMore: (category: DiscoverySection) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return <div className="@container space-y-8 pb-8" aria-busy={loading}>
    {error && <div role="alert" className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <p>{t("places.discoverySections.loadError")}</p>
      <Button variant="outline" className="mt-3" onClick={onRetry}>{t("common.retry")}</Button>
    </div>}
    {PREVIEW.map((category) => {
      const group = feed?.sections.find((s) => s.category === category);
      const items = group?.items.slice(0, 4) ?? [];
      const title = t(SECTION_LABELS[category]);
      return <section key={category} aria-labelledby={`discovery-${category}`}>
        <h2 id={`discovery-${category}`} className="mb-3 text-heading font-medium text-foreground">{title}</h2>
        {loading ? <div className="grid grid-cols-1 @min-[360px]:grid-cols-2 @min-[1000px]:grid-cols-4 gap-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />)}
        </div> : items.length > 0 ? <>
          <div className="grid grid-cols-1 @min-[360px]:grid-cols-2 @min-[1000px]:grid-cols-4 gap-x-4 gap-y-7">{items.map((item) => renderCard(item.place))}</div>
          <div className="mt-5 flex justify-center"><Button variant="outline" className="rounded-full" onClick={() => onMore(category)} aria-label={t("places.discoverySections.seeMoreCategory", { category: title })}>{t("places.discoverySections.seeMore")}</Button></div>
        </> : !error && <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground" role="status">
          {group?.status === "ERROR" ? <><p>{t("places.discoverySections.loadError")}</p><Button variant="outline" className="mt-3" onClick={onRetry}>{t("common.retry")}</Button></> : t("places.discoverySections.empty")}
        </div>}
      </section>;
    })}
  </div>;
}
