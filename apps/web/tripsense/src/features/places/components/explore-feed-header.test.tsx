import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExploreFeedHeader,
  DESTINATION_PRESETS,
} from "./explore-feed-header";
import { I18nProvider } from "@/i18n";

describe("ExploreFeedHeader", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders destination title, search input, and category tabs", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <ExploreFeedHeader
          currentDestination={DESTINATION_PRESETS[1]} // Huế
          onSelectDestination={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          onSearchSubmit={() => {}}
          activeCategoryId="food"
          onSelectCategory={() => {}}
        />
      </I18nProvider>
    );

    // Destination title
    expect(html).toContain("Huế");
    // Search placeholder
    expect(html).toContain("Tìm kiếm");
    // Filter button
    expect(html).toContain("Bộ lọc");
    // Category tabs
    expect(html).toContain("Ẩm thực");
    expect(html).toContain("Cà phê");
    expect(html).toContain("Điểm tham quan");
    expect(html).not.toContain("Trải nghiệm");
  });

  it("renders clear button when search query is present", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <ExploreFeedHeader
          currentDestination={DESTINATION_PRESETS[1]} // Huế
          onSelectDestination={() => {}}
          searchQuery="xe múc huế"
          onSearchChange={() => {}}
          onSearchSubmit={() => {}}
          activeCategoryId="for-you"
          onSelectCategory={() => {}}
        />
      </I18nProvider>
    );

    expect(html).toContain('value="xe múc huế"');
    expect(html).toContain('aria-label="Xóa tìm kiếm"');
  });

  it("does not submit while typing or clearing and submits only on Enter", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      const [query, setQuery] = React.useState("");
      return (
        <I18nProvider initialLocale="vi">
          <ExploreFeedHeader
            currentDestination={DESTINATION_PRESETS[0]}
            onSelectDestination={() => {}}
            searchQuery={query}
            onSearchChange={setQuery}
            onSearchSubmit={onSubmit}
            activeCategoryId="for-you"
            onSelectCategory={() => {}}
          />
        </I18nProvider>
      );
    }

    await act(async () => root.render(<Harness />));
    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "cafe");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("cafe");

    act(() => root.unmount());
    container.remove();
  });
});
