import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/components/layout/user/user-sidebar.tsx"),
  "utf8",
);

describe("UserSidebar navigation contract", () => {
  it("keeps only the requested primary navigation entries", () => {
    expect(sidebarSource).not.toContain('href: "/explore"');
    expect(sidebarSource).not.toContain('href: "/collections"');
    expect(sidebarSource).not.toContain('href: "/support"');
    expect(sidebarSource).not.toContain('t("nav.menu")');
    expect(sidebarSource).not.toContain('t("nav.account")');
  });

  it("uses a search icon for Places & Map", () => {
    expect(sidebarSource).toMatch(
      /key: "nav\.places",[\s\S]*?href: "\/places",[\s\S]*?icon: Search/,
    );
  });

  it("shows the centered Create a trip action below the main navigation", () => {
    const mainNavigationEnd = sidebarSource.indexOf("</nav>");
    const createTripAction = sidebarSource.indexOf('href="/trips/new"');

    expect(mainNavigationEnd).toBeGreaterThan(-1);
    expect(createTripAction).toBeGreaterThan(mainNavigationEnd);
    expect(sidebarSource).toContain('href="/trips/new"');
    expect(sidebarSource).toContain('t("nav.createTrip")');
    expect(sidebarSource).toContain("items-center justify-center text-center");
    expect(sidebarSource).toContain("bg-secondary");
    expect(sidebarSource).not.toContain("<Plus");
    expect(sidebarSource).not.toContain('t("chat.dialogs.newChat.title")');
  });

  it("keeps the same vertical rhythm when expanded or collapsed", () => {
    expect(sidebarSource).toContain('className="w-full space-y-2.5"');
    expect(sidebarSource).not.toContain(
      'collapsed ? "space-y-1" : "space-y-2.5"',
    );
    expect(sidebarSource).toContain('"h-10 w-10 justify-center p-0 mx-auto"');
    expect(sidebarSource).toContain('"h-10 w-full px-0"');
    expect(sidebarSource).toContain(
      '"h-20 pt-6 pb-2 transition-all duration-300 ease-in-out"',
    );
  });
});
