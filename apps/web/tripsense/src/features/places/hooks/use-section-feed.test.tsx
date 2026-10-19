import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSectionFeed } from "./use-section-feed";
import type { DiscoverySection, SectionFeed } from "../services/recommendations-api";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../services/recommendations-api", () => ({ getExploreSections: request }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function response(section: DiscoverySection | null): SectionFeed {
  return { recommendationId: section ?? "preview", seedId: "opaque-seed", destinationId: "danang",
    expiresAt: new Date(Date.now() + 300_000).toISOString(), seedReused: false, previewOrderPreserved: false,
    resultMode: "GENERIC_DESTINATION", personalization: { enabled: true, applied: false, signalCount: 0 },
    stale: false, requestedCount: section ? 48 : 16, returnedCount: 0,
    sections: [{ category: section ?? "CAFE", status: "EMPTY", degradations: [], items: [] }] };
}
describe("useSectionFeed scoped navigation", () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: ReturnType<typeof useSectionFeed>;
  function Harness({ user = "user-a", destination = "danang" }: { user?: string; destination?: string }) {
    const hook = useSectionFeed(user, destination, "session");
    React.useLayoutEffect(() => { latest = hook; });
    return <div>{hook.response?.recommendationId}</div>;
  }
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(async ({ section }) => response(section));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("reuses preview and expanded category with the original feedback snapshot", async () => {
    await act(async () => { await latest.load(null); });
    await act(async () => { await latest.load("CAFE"); });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ section: "CAFE", seedId: "opaque-seed" }));
    await act(async () => { await latest.load(null); });
    expect(request).toHaveBeenCalledTimes(2);
    expect(latest.response?.recommendationId).toBe("preview");
  });
  it("does not use cached data or seed across identities or destinations", async () => {
    await act(async () => { await latest.load(null); });
    act(() => root.render(<Harness user="user-b" destination="hue" />));
    expect(latest.response).toBeNull();
    await act(async () => { await latest.load(null); });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ destinationId: "hue", seedId: undefined }));
  });
  it("aborts and ignores a late previous category response", async () => {
    let resolve!: (value: SectionFeed) => void;
    request.mockImplementation(({ section }) => section === "CAFE" ? new Promise<SectionFeed>((done) => { resolve = done; }) : Promise.resolve(response(section)));
    let pending!: Promise<SectionFeed | null>;
    act(() => { pending = latest.load("CAFE"); });
    const signal = request.mock.calls[0][0].signal as AbortSignal;
    await act(async () => { await latest.load("FOOD"); });
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(response("CAFE")); await pending; });
    expect(latest.response?.recommendationId).toBe("FOOD");
  });
  it("retries failures and never treats them as empty cached success", async () => {
    request.mockRejectedValueOnce(new Error("private transport detail"));
    await act(async () => { await latest.load(null); });
    expect(latest.error).toBe(true);
    expect(container.textContent).not.toContain("private transport detail");
    await act(async () => { await latest.load(null); });
    expect(latest.error).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
