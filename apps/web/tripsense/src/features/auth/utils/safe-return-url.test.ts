import { describe, expect, it } from "vitest";
import { safeInternalReturnUrl } from "./safe-return-url";

describe("safeInternalReturnUrl", () => {
  it("preserves a trip invitation token", () => {
    expect(safeInternalReturnUrl("/trips/join?token=abc123")).toBe(
      "/trips/join?token=abc123",
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeInternalReturnUrl("https://evil.example/steal")).toBeNull();
    expect(safeInternalReturnUrl("//evil.example/steal")).toBeNull();
  });
});
