import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Avatar, AvatarImage, AvatarFallback } from "../avatar";

describe("Avatar Component Framing & Styling (test.html parity)", () => {
  it("renders with border-2 border-card and shadow ring matching test.html specification", () => {
    const html = renderToString(
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://example.com/avatar.jpg" alt="User Avatar" />
        <AvatarFallback>TS</AvatarFallback>
      </Avatar>,
    );

    // Must include the signature 2px card gap and 1px hairline border shadow
    expect(html).toContain("border-2");
    expect(html).toContain("border-card");
    expect(html).toContain("shadow-[0_0_0_1px_var(--border)]");
    expect(html).toContain("rounded-full");
  });

  it("merges custom size classes without stripping border-card and shadow", () => {
    const html = renderToString(
      <Avatar className="h-11 w-11 sm:h-[46px] sm:w-[46px]">
        <AvatarFallback>TS</AvatarFallback>
      </Avatar>,
    );

    expect(html).toContain("h-11");
    expect(html).toContain("w-11");
    expect(html).toContain("sm:h-[46px]");
    expect(html).toContain("sm:w-[46px]");
    expect(html).toContain("border-2");
    expect(html).toContain("border-card");
    expect(html).toContain("shadow-[0_0_0_1px_var(--border)]");
  });
});
