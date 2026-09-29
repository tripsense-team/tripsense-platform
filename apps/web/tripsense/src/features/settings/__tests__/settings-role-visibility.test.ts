import { describe, it, expect } from "vitest";
import { UserRole } from "@/features/auth";

describe("Settings Role Visibility & Access Control", () => {
  const secondaryNavDefs = [
    {
      key: "nav.dataEnrichment",
      fallbackTitle: "Data Enrichment",
      href: "/settings",
      adminOnly: true,
    },
    {
      key: "nav.support",
      fallbackTitle: "Help & Support",
      href: "/support",
      adminOnly: false,
    },
  ];

  const filterVisibleNav = (role?: string) =>
    secondaryNavDefs.filter(
      (item) => !item.adminOnly || role === UserRole.ADMIN,
    );

  it("filters out adminOnly items for regular USER role", () => {
    const visibleItems = filterVisibleNav(UserRole.USER);

    expect(visibleItems.some((i) => i.href === "/settings")).toBe(false);
    expect(visibleItems.some((i) => i.href === "/support")).toBe(true);
    expect(visibleItems).toHaveLength(1);
  });

  it("filters out adminOnly items for unauthenticated / guest user (undefined role)", () => {
    const visibleItems = filterVisibleNav(undefined);

    expect(visibleItems.some((i) => i.href === "/settings")).toBe(false);
    expect(visibleItems.some((i) => i.href === "/support")).toBe(true);
  });

  it("keeps adminOnly items for ADMIN role", () => {
    const visibleItems = filterVisibleNav(UserRole.ADMIN);

    expect(visibleItems.some((i) => i.href === "/settings")).toBe(true);
    expect(visibleItems.some((i) => i.href === "/support")).toBe(true);
    expect(visibleItems).toHaveLength(2);
  });
});
