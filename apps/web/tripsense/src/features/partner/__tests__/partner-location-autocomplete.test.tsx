import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import type { PlaceDetailsResponse, AutocompleteResponse } from "@/features/places/types";

const mocks = vi.hoisted(() => ({
  autocomplete: vi.fn(), details: vi.fn(), search: vi.fn(), candidates: vi.fn(),
  draft: vi.fn(), submit: vi.fn(),
}));
vi.mock("@/features/places/services/places-api", () => ({
  getAutocomplete: mocks.autocomplete, getPlaceDetails: mocks.details, searchPlaces: mocks.search,
}));
vi.mock("../services/partner-api", () => ({
  searchBusinessCandidates: mocks.candidates, createBusinessDraft: mocks.draft,
  submitBusinessApplication: mocks.submit, createManagementClaim: vi.fn(),
}));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
    DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper,
    DialogDescription: Wrapper, DialogFooter: Wrapper,
  };
});
import { PartnerWizardModal } from "../components/partner-wizard-modal";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const suggestions: AutocompleteResponse = {
  success: true, data: [
    { id: "provider-a", title: "Hotel A", subtitle: "Address A" },
    { id: "provider-b", title: "Hotel B", subtitle: "Address B" },
  ],
};
function details(letter: string): PlaceDetailsResponse {
  return { success: true, data: {
    id: `canonical-${letter}`, providerPlaceId: `provider-${letter}`,
    name: `Hotel ${letter.toUpperCase()}`, address: `Full address ${letter}`,
    location: { lat: 16.05, lng: 108.2 }, categories: [], photos: [],
  } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
function render(open = true) {
  act(() => root.render(<I18nProvider initialLocale="vi"><PartnerWizardModal open={open} onOpenChange={() => {}} /></I18nProvider>));
}
function item(text: string) {
  const result = Array.from(container.querySelectorAll<HTMLElement>("li, button")).find((node) => node.textContent?.includes(text));
  expect(result, text).toBeDefined();
  return result!;
}
async function click(text: string) {
  await act(async () => { item(text).click(); });
}
function input(placeholder: string) {
  const result = Array.from(container.querySelectorAll("input")).find((node) => node.placeholder.includes(placeholder));
  expect(result).toBeDefined();
  return result!;
}
function type(query: string) {
  act(() => {
    const field = input("Tìm tên");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, query);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function tick(ms = 300) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
async function openLookup() {
  render();
  await click("Khách sạn / Cơ sở lưu trú");
  await click("Tiếp tục");
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.autocomplete.mockResolvedValue(suggestions);
  mocks.candidates.mockResolvedValue([]);
  mocks.details.mockResolvedValue(details("a"));
  mocks.draft.mockResolvedValue({ id: "business", version: 1 });
  mocks.submit.mockResolvedValue({});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("partner location autocomplete", () => {
  it("debounces suggestions, resolves by ID, and submits canonical location", async () => {
    await openLookup();
    type("h"); await tick();
    expect(mocks.autocomplete).not.toHaveBeenCalled();
    type("hotel"); await tick(299);
    expect(mocks.autocomplete).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.autocomplete).toHaveBeenCalledWith("hotel", undefined, undefined, 10, expect.any(AbortSignal));
    expect(mocks.search).not.toHaveBeenCalled();
    expect(item("Hotel A").textContent).toContain("Address A");
    await click("Hotel A");
    expect(mocks.details).toHaveBeenCalledWith("provider-a", undefined, undefined, undefined, expect.any(AbortSignal));
    expect(input("Khách sạn Riverside").value).toBe("Hotel A");
    expect(input("Số 123").value).toBe("Full address a");
    await click("Tiếp tục"); await click("Nộp hồ sơ xét duyệt");
    expect(mocks.draft).toHaveBeenCalledWith(expect.objectContaining({
      draftProfile: expect.objectContaining({ placeId: "canonical-a", address: "Full address a", lat: 16.05, lng: 108.2 }),
    }));
  });

  it("ignores old searches after editing and clearing query", async () => {
    const old = deferred<AutocompleteResponse>();
    mocks.autocomplete.mockReturnValueOnce(old.promise);
    await openLookup(); type("old"); await tick();
    const signal = mocks.autocomplete.mock.calls[0][4] as AbortSignal;
    type("new"); await tick();
    expect(signal.aborted).toBe(true);
    type("");
    await act(async () => old.resolve(suggestions));
    expect(container.textContent).not.toContain("Hotel A");
    expect(mocks.details).not.toHaveBeenCalled();
  });

  it("keeps only the newest selection and blocks advance while resolving", async () => {
    const old = deferred<PlaceDetailsResponse>();
    mocks.details.mockReturnValueOnce(old.promise).mockResolvedValueOnce(details("b"));
    await openLookup(); type("hotel"); await tick();
    await click("Hotel A");
    expect((item("Tiếp tục") as HTMLButtonElement).disabled).toBe(true);
    expect(input("Số 123").disabled).toBe(true);
    await click("Hotel B");
    await act(async () => old.resolve(details("a")));
    expect(input("Số 123").value).toBe("Full address b");
    expect((item("Tiếp tục") as HTMLButtonElement).disabled).toBe(false);
  });

  it("aborts details on clear and external close", async () => {
    const pending = deferred<PlaceDetailsResponse>();
    mocks.details.mockReturnValue(pending.promise);
    await openLookup(); type("hotel"); await tick(); await click("Hotel A");
    type("");
    expect((mocks.details.mock.calls[0][4] as AbortSignal).aborted).toBe(true);
    type("hotel"); await tick(); await click("Hotel A");
    render(false);
    expect((mocks.details.mock.calls[1][4] as AbortSignal).aborted).toBe(true);
    await act(async () => pending.resolve(details("a")));
    render(true);
    expect(input("Số 123").value).toBe("");
  });

  it("does not select incomplete details and permits retry", async () => {
    mocks.details.mockResolvedValueOnce({ success: true, data: { id: "provider-a", name: "Hotel A" } });
    await openLookup(); type("hotel"); await tick(); await click("Hotel A");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Đã khớp địa điểm");
    expect(input("Số 123").value).toBe("");
    await click("Hotel A");
    expect(container.textContent).toContain("Đã khớp địa điểm");
  });

  it("shows empty results separately from search failure and retries", async () => {
    mocks.autocomplete.mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ success: true, data: [] });
    await openLookup(); type("hotel"); await tick();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click("Thử lại"); await tick();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Không có gợi ý");
  });
});
