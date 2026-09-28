import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { UserSettingsView } from "../components/user-settings-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mockReplace = vi.fn();
let mockSearchParamTab = "personalization";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? mockSearchParamTab : null),
  }),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    user: { id: "user-test-123", name: "Bao Le", email: "bao@example.com", role: "USER" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/features/profile", () => ({
  useUserProfile: () => ({
    data: { id: "user-test-123", displayName: "Bao Le", email: "bao@example.com", bio: "Traveler" },
    isLoading: false,
  }),
  useUpdateProfile: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isLoading: false,
  }),
}));

vi.mock("../components/personalization-editor", () => ({
  PersonalizationEditor: () => <div data-testid="mock-personalization-editor">Mock Personalization Editor</div>,
}));

describe("UserSettingsView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamTab = "personalization";
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

  it("renders Mindtrip navigation tabs and defaults to Personalization", async () => {
    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <UserSettingsView />
        </I18nProvider>
      );
    });

    // Check tabs
    expect(container.textContent).toContain("Cài đặt");
    expect(container.textContent).toContain("Cá nhân hóa");
    expect(container.textContent).toContain("Hồ sơ cá nhân");
    expect(container.textContent).toContain("Tài khoản của bạn");

    // Check active component
    expect(container.querySelector("[data-testid='mock-personalization-editor']")).toBeDefined();
  });

  it("switches to profile panel when Edit profile tab is clicked", async () => {
    await act(async () => {
      root.render(
        <I18nProvider initialLocale="vi">
          <UserSettingsView />
        </I18nProvider>
      );
    });

    const profileTabBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Hồ sơ cá nhân")
    );
    expect(profileTabBtn).toBeDefined();

    await act(async () => {
      profileTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockReplace).toHaveBeenCalledWith("/settings?tab=profile");
  });
});
