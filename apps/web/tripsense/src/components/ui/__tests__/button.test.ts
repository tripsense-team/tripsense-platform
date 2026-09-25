import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "../button";

describe("button sizing contract", () => {
  it.each([
    ["xs", "h-8", "[&_svg]:size-3.5"],
    ["sm", "h-9", "[&_svg]:size-4"],
    ["default", "h-10", "[&_svg]:size-4.5"],
    ["lg", "h-11", "[&_svg]:size-5"],
    ["icon", "h-10", "[&_svg]:size-5"],
  ] as const)(
    "maps %s to the approved control and icon sizes",
    (size, controlClass, iconClass) => {
      const classes = buttonVariants({ size });

      expect(classes).toContain(controlClass);
      expect(classes).toContain(iconClass);
    },
  );

  it("keeps the icon variant square", () => {
    const classes = buttonVariants({ size: "icon" });

    expect(classes).toContain("h-10");
    expect(classes).toContain("w-10");
  });

  it("preserves disabled and busy semantics while loading", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Button,
        { loading: true, loadingText: "Loading", size: "lg" },
        "Submit",
      ),
    );

    expect(markup).toContain("h-11");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("Loading");
  });

  it("preserves variant text color when combined with typography sizing classes", () => {
    const defaultSmMarkup = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "default", size: "sm" },
        "Start a trip",
      ),
    );
    expect(defaultSmMarkup).toContain("bg-primary");
    expect(defaultSmMarkup).toContain("text-primary-foreground");
    expect(defaultSmMarkup).toContain("text-caption");

    const destructiveSmMarkup = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "destructive", size: "sm" },
        "Delete",
      ),
    );
    expect(destructiveSmMarkup).toContain("bg-destructive");
    expect(destructiveSmMarkup).toContain("text-destructive-foreground");
    expect(destructiveSmMarkup).toContain("text-caption");

    const defaultSizeMarkup = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "default", size: "default" },
        "Confirm",
      ),
    );
    expect(defaultSizeMarkup).toContain("bg-primary");
    expect(defaultSizeMarkup).toContain("text-primary-foreground");
    expect(defaultSizeMarkup).toContain("text-control");
  });
});

