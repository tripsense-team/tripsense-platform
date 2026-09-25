import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AiLoadingSpinner } from "../ai-loading-spinner";

describe("AiLoadingSpinner", () => {
  it("renders with status role and accessible label", () => {
    const html = renderToStaticMarkup(<AiLoadingSpinner />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading AI response"');
  });

  it("renders rotating SVG with motion reduction support", () => {
    const html = renderToStaticMarkup(<AiLoadingSpinner size={24} />);
    expect(html).toContain("animate-spin");
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
    expect(html).toContain('stroke-dasharray="44 18"');
  });

  it("renders centered sparkles icon inside the spinner", () => {
    const html = renderToStaticMarkup(<AiLoadingSpinner iconClassName="text-amber-400" />);
    expect(html).toContain("lucide-sparkles");
    expect(html).toContain("text-amber-400");
  });

  it("applies custom className", () => {
    const html = renderToStaticMarkup(<AiLoadingSpinner className="custom-test-class" />);
    expect(html).toContain("custom-test-class");
  });
});
