import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MessageResponse } from "../message";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MessageResponse", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("enables word-level Streamdown animation while streaming and settles to static when finished without text change", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const text = "Khám phá **Đà Nẵng** thư thái bên biển Mỹ Khê";

    act(() => {
      root.render(<MessageResponse isAnimating={true}>{text}</MessageResponse>);
    });

    expect(container.querySelectorAll('[data-sd-animate="true"]').length).toBeGreaterThan(0);

    // Rerender with identical text but isAnimating flipped to false: memo must allow transition
    act(() => {
      root.render(<MessageResponse isAnimating={false}>{text}</MessageResponse>);
    });

    expect(container.querySelectorAll('[data-sd-animate="true"]').length).toBe(0);
    expect(container.textContent).toContain("Đà Nẵng");

    act(() => {
      root.unmount();
    });
  });

  it("defaults to static mode with no word animation for historical messages", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<MessageResponse>Lịch sử chuyến đi Đà Nẵng 3N2Đ</MessageResponse>);
    });

    expect(container.querySelectorAll('[data-sd-animate="true"]').length).toBe(0);
    expect(container.textContent).toContain("Lịch sử chuyến đi Đà Nẵng 3N2Đ");

    act(() => {
      root.unmount();
    });
  });
});
