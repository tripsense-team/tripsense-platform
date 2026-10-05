import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { PersonalizationEditor } from "../components/personalization-editor";
import { onboardingApi } from "@/features/onboarding";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    user: { id: "user-test-123", name: "Bao Le", email: "bao@example.com", role: "USER" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/features/onboarding/services/onboarding-api", () => ({
  onboardingApi: {
    get: vi.fn(),
    save: vi.fn(),
  },
}));

describe("PersonalizationEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockProfile = {
    version: 3,
    status: "COMPLETED" as const,
    selections: {
      TRAVEL_PARTY: ["COUPLE"],
      BUDGET_TIER: ["MID_RANGE"],
      STAY_STYLE: ["HOTEL", "RESORT"],
      FOOD_STYLE: ["LOCAL_FOOD", "CAFE"],
      ACTIVITY_INTEREST: ["NATURE", "BEACH"],
    },
    places: {
      VISITED: ["da-nang", "hoi-an"],
      WANT_TO_VISIT: ["tokyo"],
    },
    attributes: {
      HOME_CITY: JSON.stringify({ name: "Đà Nẵng", placeRef: "da-nang", country: "Vietnam" }),
      CUSTOM_PREFERENCE_LABELS: JSON.stringify({ GLAMPING: "Glamping Sang Chảnh" }),
    },
    freeText: "Love specialty coffee and nature walks",
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders loaded profile with all onboarding preference sections without AI voice", async () => {
    vi.mocked(onboardingApi.get).mockResolvedValueOnce(mockProfile);

    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PersonalizationEditor />
        </I18nProvider>
      );
    });

    expect(onboardingApi.get).toHaveBeenCalledTimes(1);

    // Verify Title & Onboarding Sections exist
    expect(container.textContent).toContain("Cá nhân hóa");
    expect(container.textContent).toContain("Kinh nghiệm & Điểm đến");
    expect(container.textContent).toContain("Thành phố cư trú");
    expect(container.textContent).toContain("Phong cách & Sở thích chuyến đi");
    expect(container.textContent).toContain("Ghi chú du lịch");

    // Verify AI voice is NOT rendered
    expect(container.textContent).not.toContain("Giọng nói trợ lý");
    expect(container.textContent).not.toContain("Phong cách giao tiếp");

    // Verify populated values
    expect(container.textContent).toContain("Đà Nẵng");
    expect(container.textContent).toContain("Hội An");
    expect(container.textContent).toContain("Tokyo");
    expect(container.textContent).toContain("Love specialty coffee and nature walks");
  });

  it("allows removing a visited destination tag", async () => {
    vi.mocked(onboardingApi.get).mockResolvedValueOnce(mockProfile);

    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PersonalizationEditor />
        </I18nProvider>
      );
    });

    // Expect 2 visited destinations initially
    expect(container.textContent).toContain("Đà Nẵng");
    expect(container.textContent).toContain("Hội An");

    // Find remove buttons
    const removeButtons = container.querySelectorAll("button[title='Xóa địa điểm']");
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);

    // Click remove on the first one
    await act(async () => {
      removeButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Visited tags should still contain Hội An
    expect(container.textContent).toContain("Hội An");
  });

  it("calls onboardingApi.save with valid cleaned payload when Save is clicked", async () => {
    vi.mocked(onboardingApi.get).mockResolvedValueOnce(mockProfile);
    vi.mocked(onboardingApi.save).mockResolvedValueOnce({
      ...mockProfile,
      version: 4,
    });

    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PersonalizationEditor />
        </I18nProvider>
      );
    });

    // Find Save changes button
    const saveButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Lưu thay đổi")
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onboardingApi.save).toHaveBeenCalledTimes(1);
    const savePayload = vi.mocked(onboardingApi.save).mock.calls[0][0];
    expect(savePayload.version).toBe(3);
    expect(savePayload.places.VISITED).toContain("da-nang");
    expect(savePayload.places.WANT_TO_VISIT).toContain("tokyo");
    expect(savePayload.selections.TRAVEL_PARTY).toEqual(["COUPLE"]);
    // Verify HOME_CITY is saved as JSON string
    expect(savePayload.attributes?.HOME_CITY).toBeDefined();
    expect(JSON.parse(savePayload.attributes!.HOME_CITY).name).toBe("Đà Nẵng");
  });

  it("supports adding a custom preference option", async () => {
    vi.mocked(onboardingApi.get).mockResolvedValueOnce(mockProfile);
    vi.mocked(onboardingApi.save).mockResolvedValueOnce({
      ...mockProfile,
      version: 4,
    });

    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PersonalizationEditor />
        </I18nProvider>
      );
    });

    // Find "+ Thêm lựa chọn khác" button
    const addCustomBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("lựa chọn khác")
    );
    expect(addCustomBtn).toBeDefined();

    // Click "+ Khác"
    await act(async () => {
      addCustomBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Input should appear
    const input = container.querySelector("input[placeholder*='Nhập lựa chọn']") as HTMLInputElement;
    await act(async () => {
      const tracker = (input as unknown as { _valueTracker?: { setValue: (val: string) => void } })._valueTracker;
      if (tracker) {
        tracker.setValue("");
      }
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(input, "Solo phượt");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Click "+ Thêm" inside the custom input wrapper
    const confirmAddBtn = input.parentElement?.querySelector("button");
    expect(confirmAddBtn).toBeDefined();

    await act(async () => {
      confirmAddBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Should now contain "Solo phượt"
    expect(container.textContent).toContain("Solo phượt");
  });
});
