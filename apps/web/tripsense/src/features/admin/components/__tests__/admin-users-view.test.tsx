import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminUsers,
  fetchAdminUserTripCounts,
} from "../../api/admin-users-api";
import { AdminUsersView } from "../admin-users-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/features/auth/store/use-auth-store", () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: "admin-1" } }),
}));

vi.mock("../../api/admin-users-api", () => ({
  fetchAdminUsers: vi.fn(),
  fetchAdminUserTripCounts: vi.fn(),
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: vi.fn(),
}));

describe("AdminUsersView", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.mocked(fetchAdminUsers).mockReset();
    vi.mocked(fetchAdminUserTripCounts).mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("renders Neon DB users with real trip counts and updates filters", async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      items: [
        {
          id: "admin-1",
          email: "admin@tripsense.app",
          displayName: "Admin Owner",
          avatarUrl: null,
          role: "ADMIN",
          status: "ACTIVE",
          authProvider: "LOCAL",
          partnerEnrolled: false,
          onboardingRequired: false,
          location: null,
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
        {
          id: "user-2",
          email: "traveler@tripsense.app",
          displayName: "Real Traveler",
          avatarUrl: null,
          role: "USER",
          status: "UNVERIFIED",
          authProvider: "GOOGLE",
          partnerEnrolled: true,
          onboardingRequired: true,
          location: "Hanoi",
          createdAt: "2026-10-02T00:00:00Z",
          updatedAt: "2026-10-02T00:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
      summary: {
        totalUsers: 2,
        activeUsers: 1,
        inactiveUsers: 0,
        unverifiedUsers: 1,
      },
    });
    vi.mocked(fetchAdminUserTripCounts).mockResolvedValue({
      "admin-1": 3,
      "user-2": 7,
    });

    await act(async () => {
      root.render(<AdminUsersView />);
    });

    expect(host.textContent).toContain("Admin Owner");
    expect(host.textContent).toContain("Real Traveler");
    expect(host.textContent).toContain("admin.users.actions.currentAccount");
    expect(host.textContent).toContain("7");

    const partnerFilterBtn = [...host.querySelectorAll("button")].find(
      (btn) => btn.textContent === "admin.users.roles.partner",
    );
    expect(partnerFilterBtn).toBeTruthy();

    await act(async () => {
      partnerFilterBtn?.click();
    });

    expect(fetchAdminUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 0,
        role: "PARTNER",
      }),
    );
  });

  it("falls back cleanly to em-dash when trip-service counts are unavailable", async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      items: [
        {
          id: "user-9",
          email: "solo@tripsense.app",
          displayName: null,
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
          authProvider: "LOCAL",
          partnerEnrolled: false,
          onboardingRequired: false,
          location: null,
          createdAt: "2026-10-03T00:00:00Z",
          updatedAt: "2026-10-03T00:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      summary: {
        totalUsers: 1,
        activeUsers: 1,
        inactiveUsers: 0,
        unverifiedUsers: 0,
      },
    });
    vi.mocked(fetchAdminUserTripCounts).mockResolvedValue(null);

    await act(async () => {
      root.render(<AdminUsersView />);
    });

    expect(host.textContent).toContain("solo@tripsense.app");
    expect(host.textContent).toContain("—");
  });
});

