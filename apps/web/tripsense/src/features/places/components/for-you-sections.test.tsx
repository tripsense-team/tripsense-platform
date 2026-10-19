import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { ForYouSections } from "./for-you-sections";
import type { SectionFeed, DiscoverySection } from "../services/recommendations-api";

function feed(): SectionFeed {
  return { recommendationId: "rec", seedId: "seed", expiresAt: new Date(Date.now() + 60_000).toISOString(), seedReused: false,
    previewOrderPreserved: false, destinationId: "danang", resultMode: "GENERIC_DESTINATION", personalization: { enabled: true, applied: false, signalCount: 0 }, stale: false,
    requestedCount: 16, returnedCount: 24,
    sections: (["ATTRACTION", "HOMESTAY", "FOOD", "CAFE"] as DiscoverySection[]).map((category) => ({ category, status: "READY", degradations: [], items: Array.from({ length: 6 }, (_, i) => ({ place: { id: `${category}-${i}`, name: `${category}-${i}`, categories: [], photos: [] }, rank: i + 1, score: 1, availableCriteria: [], reasons: [] })) })) };
}
function render(response: SectionFeed | null, loading = false, error = false) {
  return renderToStaticMarkup(<I18nProvider initialLocale="vi"><ForYouSections feed={response} loading={loading} error={error}
    renderCard={(p) => <article key={p.id}>{p.name}</article>} onMore={() => {}} onRetry={() => {}} /></I18nProvider>);
}
describe("For You section previews", () => {
  it("uses compact, medium-weight typography for category headings", () => {
    const html = render(feed());
    const headings = html.match(/<h2[^>]*>/g) ?? [];
    expect(headings).toHaveLength(4);
    for (const heading of headings) {
      expect(heading).toContain("text-heading font-medium");
      expect(heading).not.toContain("font-bold");
      expect(heading).not.toContain("text-xl");
    }
  });
  it("caps every section at four regardless of server count or responsive grid width", () => {
    const html = render(feed());
    expect((html.match(/<article/g) ?? [])).toHaveLength(16);
    expect(html).not.toContain("CAFE-4");
    expect(html).not.toContain("HOMESTAY-5");
    expect(html.indexOf("Điểm tham quan")).toBeLessThan(html.indexOf("Homestay"));
    expect((html.match(/aria-label="Xem thêm:/g) ?? [])).toHaveLength(4);
  });
  it("does not fill an empty homestay section with hotels or render See more for it", () => {
    const response = feed();
    response.sections[1] = { category: "HOMESTAY", status: "EMPTY", items: [], degradations: [] };
    const html = render(response);
    expect(html).toContain("chưa có địa điểm phù hợp");
    expect((html.match(/<article/g) ?? [])).toHaveLength(12);
    expect(html).not.toContain('aria-label="Xem thêm: Homestay"');
  });
  it("distinguishes error and empty and keeps healthy groups", () => {
    const response = feed();
    response.sections[1] = { category: "HOMESTAY", status: "ERROR", items: [], degradations: ["LOCAL_UNAVAILABLE"] };
    const html = render(response);
    expect(html).toContain("Chưa thể tải địa điểm");
    expect(html).toContain("Thử lại");
    expect(html).not.toContain("LOCAL_UNAVAILABLE");
    expect((html.match(/<article/g) ?? [])).toHaveLength(12);
  });
  it("uses fixed skeletons instead of falsely claiming empty data during loading", () => {
    const html = render(null, true);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("chưa có địa điểm phù hợp");
  });
});
