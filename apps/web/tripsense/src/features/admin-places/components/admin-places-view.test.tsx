import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPlacesView } from "./admin-places-view";
import { listAdminPlaces, reverseGeocodeAdminPlace } from "../services/admin-places-api";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/i18n", () => ({
  useTranslation: () => ({ locale: "vi", t: (key: string) => key }),
}));

vi.mock("next/dynamic", () => ({
  default: () => ({ onChange }: { onChange: (point: { lat: number; lng: number }) => void }) => (
    <div>
      <button type="button" data-testid="map-a" onClick={() => onChange({ lat: 16.05, lng: 108.2 })}>Point A</button>
      <button type="button" data-testid="map-b" onClick={() => onChange({ lat: 16.06, lng: 108.21 })}>Point B</button>
    </div>
  ),
}));

vi.mock("../services/admin-places-api", () => ({
  listAdminPlaces: vi.fn(),
  reverseGeocodeAdminPlace: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

type LookupResponse = Awaited<ReturnType<typeof reverseGeocodeAdminPlace>>;

function lookupResponse(address: string): LookupResponse {
  return { success: true, data: { matched: true, address, distanceMeters: 10, source: "MAPVINA" } };
}

describe("admin place map address lookup", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    vi.mocked(listAdminPlaces).mockResolvedValue({ success: true, data: { items: [], nextCursor: null } });
    vi.mocked(reverseGeocodeAdminPlace).mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<AdminPlacesView />); });
    await act(async () => { button("admin.places.addPlace").click(); });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
  });

  function button(text: string): HTMLButtonElement {
    const found = [...document.querySelectorAll("button")].find((element) => element.textContent === text);
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  }

  function addressInput(): HTMLInputElement {
    const label = [...document.querySelectorAll("label")]
      .find((element) => element.textContent === "admin.places.fields.address");
    const input = label?.parentElement?.querySelector("input");
    if (!input) throw new Error("Missing address input");
    return input;
  }

  it("fills the address from the latest map click, not a stale response", async () => {
    const first = deferred<LookupResponse>();
    const second = deferred<LookupResponse>();
    vi.mocked(reverseGeocodeAdminPlace).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => { button("Point A").click(); button("Point B").click(); });
    await act(async () => { second.resolve(lookupResponse("New address")); });
    expect(addressInput().value).toBe("New address");
    await act(async () => { first.resolve(lookupResponse("Old address")); });
    expect(addressInput().value).toBe("New address");
  });

  it("does not overwrite an address typed while the lookup is pending", async () => {
    const pending = deferred<LookupResponse>();
    vi.mocked(reverseGeocodeAdminPlace).mockReturnValueOnce(pending.promise);
    await act(async () => { button("Point A").click(); });
    const input = addressInput();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Manually typed address");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { pending.resolve(lookupResponse("Provider address")); });
    expect(addressInput().value).toBe("Manually typed address");
    expect(button("admin.places.reverseGeocode.useSuggestion")).toBeTruthy();
  });

  it("keeps the current address when no precise result is found", async () => {
    vi.mocked(reverseGeocodeAdminPlace).mockResolvedValueOnce({
      success: true,
      data: { matched: false, address: null, distanceMeters: null, source: "MAPVINA" },
    });
    await act(async () => { button("Point A").click(); });
    expect(addressInput().value).toBe("");
    expect(document.body.textContent).toContain("admin.places.reverseGeocode.noMatch");
  });

  it("ignores a lookup that completes after closing and reopening the form", async () => {
    const pending = deferred<LookupResponse>();
    vi.mocked(reverseGeocodeAdminPlace).mockReturnValueOnce(pending.promise);
    await act(async () => { button("Point A").click(); });
    await act(async () => { button("admin.places.cancel").click(); button("admin.places.addPlace").click(); });
    await act(async () => { pending.resolve(lookupResponse("Stale address")); });
    expect(addressInput().value).toBe("");
  });
});
