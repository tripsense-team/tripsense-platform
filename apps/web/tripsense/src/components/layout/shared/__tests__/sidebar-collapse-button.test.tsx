import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SidebarCollapseButton,
  SidebarCollapseIcon,
  SidebarExpandIcon,
} from "../sidebar-collapse-button";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("SidebarCollapseButton Component", () => {
  it("renders with rounded-full circular styling and collapse icon when expanded", () => {
    const html = renderToString(
      <TooltipProvider>
        <SidebarCollapseButton
          collapsed={false}
          onToggleCollapse={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(html).toContain("rounded-full");
    expect(html).toContain('aria-label="Collapse Sidebar"');
    expect(html).toContain("points=\"16.5,8.5 12.5,12 16.5,15.5\"");
  });

  it("renders with expand icon when collapsed", () => {
    const html = renderToString(
      <TooltipProvider>
        <SidebarCollapseButton
          collapsed={true}
          onToggleCollapse={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(html).toContain("rounded-full");
    expect(html).toContain('aria-label="Expand Sidebar"');
    expect(html).toContain("points=\"12.5,8.5 16.5,12 12.5,15.5\"");
  });

  it("renders standalone icons with correct SVG structure", () => {
    const collapseIconHtml = renderToString(<SidebarCollapseIcon />);
    expect(collapseIconHtml).toContain("viewBox=\"0 0 24 24\"");
    expect(collapseIconHtml).toContain("rect");

    const expandIconHtml = renderToString(<SidebarExpandIcon />);
    expect(expandIconHtml).toContain("viewBox=\"0 0 24 24\"");
    expect(expandIconHtml).toContain("polygon");
  });
});
