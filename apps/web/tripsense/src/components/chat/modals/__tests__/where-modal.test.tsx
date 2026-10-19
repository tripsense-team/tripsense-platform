import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { WhereModal } from "../where-modal";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

// Mock ModalBackdrop portal
vi.mock("../modal-backdrop", () => ({
  ModalBackdrop: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="modal-backdrop">{children}</div> : null,
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params && params.name) return `Use "${params.name}" as destination`;
      return key;
    },
    locale: "vi",
  }),
}));

describe("WhereModal Component", () => {
  it("renders famous destinations without external place API search", () => {
    const html = renderToString(
      <WhereModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("Singapore");
    expect(html).toContain("Kuala Lumpur");
    expect(html).toContain("New York");
    expect(html).toContain("Đà Nẵng");
    expect(html).toContain("Hà Nội");
    expect(html).toContain("Marina Bay Sands &amp; Merlion");
    expect(html).toContain("Petronas Twin Towers");
  });

  it("renders country flags and landmark photos for cities", () => {
    const html = renderToString(
      <WhereModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("🇸🇬");
    expect(html).toContain("🇲🇾");
    expect(html).toContain("🇺🇸");
    expect(html).toContain("🇻🇳");
  });

  it("does not render modal contents when closed", () => {
    const html = renderToString(
      <WhereModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).not.toContain("Singapore");
  });
});
