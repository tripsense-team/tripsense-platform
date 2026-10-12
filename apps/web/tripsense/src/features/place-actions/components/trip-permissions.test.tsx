import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TripResponse } from "@/features/trip-management/types";
import { TripSharingWorkspace } from "@/features/social-post/components/trip-sharing-workspace";
import { AddToTripDialog } from "./add-to-trip-dialog";

const mocks = vi.hoisted(() => ({
  user: { id: "owner", name: "Traveler" } as { id: string; name: string } | null,
  canEdit: true,
  trips: [] as TripResponse[],
  list: vi.fn(), get: vi.fn(), itinerary: vi.fn(),
  pool: vi.fn(), add: vi.fn(), remove: vi.fn(), posts: vi.fn(), publish: vi.fn(),
}));
vi.mock("@/features/auth/store/use-auth-store", () => ({
  useAuthStore: (select: (state: { user: typeof mocks.user }) => unknown) => select({ user: mocks.user }),
}));
vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key, locale: "en" }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: ({ children }: React.PropsWithChildren) => <span>{children}</span> }));
vi.mock("@/features/trip-management", () => ({
  useUserTrips: () => ({ trips: mocks.trips, isLoading: false, isError: false }),
}));
vi.mock("@/features/trip-management/hooks", () => ({ useCollaborativeItinerarySync: () => "connected" }));
vi.mock("@/features/trip-management/components/trip-members-dialog", () => ({ TripMembersDialog: () => null }));
vi.mock("@/features/trip-management/components/pending-invitations-banner", () => ({ PendingInvitationsBanner: () => null }));
vi.mock("@/features/trip-management/components/trip-dialogs", () => ({ AddItemDialog: () => null, EditItemDialog: () => null }));
vi.mock("@/features/trip-management/services/trip-management-api", () => ({
  listTrips: mocks.list, getTrip: mocks.get, getItinerary: mocks.itinerary,
  createItineraryItem: vi.fn(), deleteItineraryItem: vi.fn(), reorderItineraryItems: vi.fn(), updateItineraryItem: vi.fn(),
}));
vi.mock("@/features/social-post/services", () => ({ socialPostRepository: {
  getUserPosts: mocks.posts, previewTripShare: mocks.publish,
} }));
vi.mock("@/features/places/services/places-api", () => ({ searchPlaces: vi.fn(), getPlaceDetails: vi.fn() }));
vi.mock("../services/place-actions-api", () => ({
  listTripPlaces: mocks.pool, addPlaceToTrip: mocks.add, removePlaceFromTrip: mocks.remove,
}));
vi.mock("@/features/place-actions", async () => ({
  TripPlacePool: (await import("./trip-place-pool")).TripPlacePool,
  ScheduleTripPlaceDialog: () => null,
}));
vi.mock("@/components/shared", () => ({
  ResponsiveDialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => open ? <div>{children}</div> : null,
  EmptyState: ({ title, description }: { title: string; description: string }) => <div>{title}{description}</div>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingState: () => <div>Loading</div>,
}));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => open ? <div role="dialog">{children}</div> : null,
    DialogContent: Wrapper, DialogDescription: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper,
  };
});

function trip(id: string, ownerId = "owner", status: TripResponse["status"] = "DRAFT"): TripResponse {
  return {
    id, ownerId, name: id, destinationName: "Da Nang", destinationPlaceId: null,
    startDate: "2026-10-20", endDate: "2026-10-20", status, displayStatus: "DRAFT", visibility: "PRIVATE",
    travelerCount: 2, budgetAmount: null, budgetCurrency: null, notes: null, coverImageUrl: null,
    version: 0, createdAt: "2026-10-12", updatedAt: "2026-10-12",
  };
}
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
async function render(element: React.ReactNode) {
  await act(async () => { root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
async function click(element: HTMLElement) {
  await act(async () => { element.click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
function button(text: string) {
  const result = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(text));
  expect(result, text).toBeDefined();
  return result!;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.user = { id: "owner", name: "Traveler" };
  mocks.canEdit = true;
  mocks.trips = [trip("owned"), trip("shared", "someone-else")];
  mocks.list.mockImplementation(async () => ({ content: mocks.trips }));
  mocks.get.mockImplementation(async (id: string) => mocks.trips.find((item) => item.id === id));
  mocks.itinerary.mockImplementation(async (id: string) => ({
    tripId: id, revision: 0, capabilities: { canView: true, canEdit: mocks.canEdit, canManageMembers: false },
    days: [{ id: "day", date: "2026-10-20", dayNumber: 1, version: 0, items: [] }],
  }));
  mocks.pool.mockResolvedValue({ content: [] });
  mocks.posts.mockResolvedValue({ items: [] });
  mocks.add.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe("trip workspace ownership", () => {
  it("loads the owner's pool, keeps real errors visible and permits sharing", async () => {
    mocks.pool.mockRejectedValue(Object.assign(new Error("Trip not found"), { status: 404 }));
    await render(<TripSharingWorkspace initialTripId="owned" />);
    expect(mocks.pool).toHaveBeenCalledWith("owned");
    expect(container.textContent).toContain("Trip not found");
    expect(container.textContent).toContain("trip.ownerView");
    expect(button("trip.shareTrip")).toBeDefined();
    expect(button("common.retry")).toBeDefined();
  });

  it.each([true, false])("member canEdit=%s never fetches pool or exposes publication", async (canEdit) => {
    mocks.canEdit = canEdit;
    await render(<TripSharingWorkspace initialTripId="shared" />);
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.posts).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("trip.shareTrip");
    expect(container.textContent).not.toContain("Community Share Preview");
    expect(container.textContent).toContain(canEdit ? "trip.editorView" : "trip.viewerView");
    expect(button("Add Place").disabled).toBe(!canEdit);
    expect(button("trip.members")).toBeDefined();
  });

  it("fails closed when auth user is missing", async () => {
    mocks.user = null;
    await render(<TripSharingWorkspace initialTripId="owned" />);
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.posts).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("trip.ownerView");
    expect(container.textContent).not.toContain("trip.shareTrip");
  });

  it("closes owner dialogs and ignores a late share response after switching trips", async () => {
    let resolvePosts!: (value: { items: unknown[] }) => void;
    mocks.posts.mockReturnValueOnce(new Promise((resolve) => { resolvePosts = resolve; }));
    await render(<TripSharingWorkspace initialTripId="owned" />);
    await click(button("trip.shareTrip"));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await click(button("shared"));
    await act(async () => resolvePosts({ items: [{ id: "old-post", type: "TRIP_SHARE", trip: { tripId: "owned" }, visibility: "PRIVATE" }] }));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.pool.mock.calls.every(([id]) => id === "owned")).toBe(true);
    expect(container.textContent).not.toContain("trip.shareTrip");
    await click(button("owned"));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toContain("old-post");
  });
});

describe("add-to-trip eligibility", () => {
  const place = { id: "place", name: "Cafe", categories: [], photos: [] };
  it("offers only active owned trips and preserves memberships outside the page", async () => {
    mocks.trips.push(trip("archived", "owner", "ARCHIVED"), trip("cancelled", "owner", "CANCELLED"), trip("new-owned"));
    const onAdded = vi.fn();
    await render(<AddToTripDialog place={place} open selectedTripIds={["owned", "outside-page", "shared"]} onOpenChange={vi.fn()} onAdded={onAdded} />);
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(container.textContent).not.toContain("shared");
    expect(container.textContent).not.toContain("archived");
    expect(container.textContent).not.toContain("cancelled");
    await click(boxes[0]);
    await click(boxes[1]);
    await click(button("common.confirm"));
    expect(mocks.add).toHaveBeenCalledExactlyOnceWith("new-owned", "place");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("owned", "place");
    expect(onAdded).toHaveBeenCalledWith(true);
  });

  it("keeps the added state when the last visible membership is removed but another page still has one", async () => {
    const onAdded = vi.fn();
    await render(<AddToTripDialog place={place} open selectedTripIds={["owned", "outside-page"]} onOpenChange={vi.fn()} onAdded={onAdded} />);
    await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await click(button("common.confirm"));
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("owned", "place");
    expect(onAdded).toHaveBeenCalledWith(true);
  });

  it("does not offer or mutate trips without an authenticated owner", async () => {
    mocks.user = null;
    await render(<AddToTripDialog place={place} open selectedTripIds={[]} onOpenChange={vi.fn()} />);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(button("common.confirm").disabled).toBe(true);
    await click(button("common.confirm"));
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
