import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhoModal } from "./who-modal";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.update": "Cập nhật",
        "trip.intakeWhoTitle": "Số người",
      };
      return translations[key] || key;
    },
  }),
}));

describe("WhoModal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not enter an update loop when initial counts are omitted", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WhoModal isOpen={false} onClose={() => {}} onSave={() => {}} />,
      );
    });
    await act(async () => {
      root.render(
        <WhoModal isOpen={false} onClose={() => {}} onSave={() => {}} />,
      );
    });

    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes("Maximum update depth exceeded"),
      ),
    ).toBe(false);

    act(() => root.unmount());
  });

  it("renders localized update button instead of raw translation key", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WhoModal isOpen={true} onClose={() => {}} onSave={() => {}} />,
      );
    });

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Cập nhật");
    expect(bodyText).not.toContain("common.update");

    act(() => root.unmount());
  });
});
