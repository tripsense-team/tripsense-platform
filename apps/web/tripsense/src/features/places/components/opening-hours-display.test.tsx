import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { OpeningHoursDisplay } from "./opening-hours-display";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("OpeningHoursDisplay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders fallback message when openingHours is missing", () => {
    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <OpeningHoursDisplay openingHours={null} />
        </I18nProvider>
      );
    });

    expect(container.textContent).toContain("Chưa có thông tin giờ mở cửa");
  });

  it("renders operational badge and expands schedule on toggle click", async () => {
    const sample =
      "Thứ Hai: 06:00–22:00; Thứ Ba: 06:00–22:00; Thứ Tư: 06:00–22:00; Thứ Năm: 06:00–22:00; Thứ Sáu: 06:00–22:00; Thứ Bảy: 06:00–22:00; Chủ Nhật: 06:00–22:00";

    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <OpeningHoursDisplay
            openingHours={sample}
            businessStatus="OPERATIONAL"
          />
        </I18nProvider>
      );
    });

    expect(container.textContent).toContain("Đang mở cửa");
    expect(container.textContent).toContain("06:00–22:00");
    expect(container.textContent).toContain("Xem cả tuần");

    // Click toggle button to expand
    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Thu gọn");
    expect(container.textContent).toContain("Thứ Hai");
    expect(container.textContent).toContain("Chủ Nhật");
  });
});
