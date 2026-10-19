import { describe, expect, it } from "vitest";
import { validatePartnerImageFile } from "./partner-image-file";

describe("partner menu image file validation", () => {
  it("accepts supported menu photo MIME types within the size limit", () => {
    const file = new File([new Uint8Array(1024)], "dish.webp", { type: "image/webp" });
    expect(validatePartnerImageFile(file, {
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    })).toBeNull();
  });

  it("rejects unsupported types and oversized photos", () => {
    const unsupported = new File(["markup"], "dish.svg", { type: "image/svg+xml" });
    const tooLarge = new File([new Uint8Array(10)], "dish.png", { type: "image/png" });
    const rules = { maxBytes: 5, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] } as const;
    expect(validatePartnerImageFile(unsupported, rules)).toBe("invalidType");
    expect(validatePartnerImageFile(tooLarge, rules)).toBe("tooLarge");
  });
});
