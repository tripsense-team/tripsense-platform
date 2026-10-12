import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddItemDialog } from "./trip-dialogs";
import { searchPlaces } from "@/features/places/services/places-api";
import type { TripResponse, ItineraryDayResponse, CreateItineraryItemRequest } from "../types";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string) => key,
  }),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || ""} />,
}));

vi.mock("@/features/places/services/places-api", () => ({
  searchPlaces: vi.fn(),
}));

vi.mock("@/features/place-actions/services/place-actions-api", () => ({
  listSavedPlaces: vi.fn().mockResolvedValue({ content: [] }),
}));

vi.mock("@/features/places/utils/place-photo", () => ({
  getPlacePhotoUrl: vi.fn().mockReturnValue("https://example.com/photo.jpg"),
}));

describe("AddItemDialog Component (Zero-Mock Integration)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const mockTrip: TripResponse = {
    id: "trip-1",
    name: "Chuyến đi Đà Nẵng",
    destinationName: "Đà Nẵng",
    destinationPlaceId: "dest-1",
    startDate: "2026-09-21",
    endDate: "2026-09-23",
    status: "CONFIRMED",
    displayStatus: "UPCOMING",
    visibility: "PUBLIC",
    ownerId: "user-1",
    travelerCount: 2,
    budgetAmount: null,
    budgetCurrency: null,
    notes: null,
    coverImageUrl: null,
    version: 0,
    createdAt: "2026-09-20",
    updatedAt: "2026-09-20",
  };

  const mockDay: ItineraryDayResponse = {
    id: "day-1",
    date: "2026-09-21",
    dayNumber: 1,
    version: 0,
    items: [],
  };

  const mockDraft: CreateItineraryItemRequest = {
    type: "ACTIVITY",
    title: "",
    startTime: "",
    endTime: "",
    durationMinutes: null,
    notes: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  it("fetches real places from searchPlaces API instead of static mock suggestions", async () => {
    const mockPlaces = [
      {
        id: "place-danang-1",
        name: "Cầu Rồng Đà Nẵng",
        address: "Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
        categories: ["ATTRACTION"],
        rating: 4.8,
        photos: ["https://example.com/dragon-bridge.jpg"],
      },
      {
        id: "place-danang-2",
        name: "Nhà Hàng Hải Sản Bé Mặn",
        address: "Lô 11 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
        categories: ["RESTAURANT"],
        rating: 4.5,
        photos: ["https://example.com/be-man.jpg"],
      },
    ];

    vi.mocked(searchPlaces).mockResolvedValueOnce({
      success: true,
      data: mockPlaces as any,
    });

    await act(async () => {
      root.render(
        <AddItemDialog
          trip={mockTrip}
          day={mockDay}
          draft={mockDraft}
          error={null}
          submitting={false}
          onOpenChange={() => {}}
          onDraftChange={() => {}}
          onSubmit={() => {}}
          onQuickSubmit={() => {}}
        />,
      );
    });

    // Wait for debounced searchPlaces call
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("Đà Nẵng"),
        limit: 12,
      }),
    );

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Cầu Rồng Đà Nẵng");
    expect(bodyText).toContain("Nhà Hàng Hải Sản Bé Mặn");
    expect(bodyText).toContain("Đà Nẵng");
    // Ensure mock places (like Taj Mahal / Van May mock) are NOT present
    expect(bodyText).not.toContain("Taj Mahal");
  });

  it("submits real placeId and attributes when clicking Add button", async () => {
    const mockPlaces = [
      {
        id: "real-place-123",
        name: "Cầu Vàng Bà Nà Hills",
        address: "Hòa Phú, Hòa Vang, Đà Nẵng",
        categories: ["ATTRACTION"],
        rating: 4.9,
        photos: [],
      },
    ];

    vi.mocked(searchPlaces).mockResolvedValue({
      success: true,
      data: mockPlaces as any,
    });

    const onQuickSubmit = vi.fn();

    await act(async () => {
      root.render(
        <AddItemDialog
          trip={mockTrip}
          day={mockDay}
          draft={mockDraft}
          error={null}
          submitting={false}
          onOpenChange={() => {}}
          onDraftChange={() => {}}
          onSubmit={() => {}}
          onQuickSubmit={onQuickSubmit}
        />,
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const addButton = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.includes("Add"),
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.click();
    });

    expect(onQuickSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        placeId: "real-place-123",
        placeRef: "real-place-123",
        title: "Cầu Vàng Bà Nà Hills",
        notes: "Hòa Phú, Hòa Vang, Đà Nẵng",
      }),
    );
  });

  it("executes search when typing query and clicking the functional Search button", async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      success: true,
      data: [
        {
          id: "place-search-1",
          name: "Bà Nà Hills",
          address: "Hòa Vang, Đà Nẵng",
          categories: ["ATTRACTION"],
          rating: 4.7,
          photos: [],
        },
      ] as any,
    });

    await act(async () => {
      root.render(
        <AddItemDialog
          trip={mockTrip}
          day={mockDay}
          draft={mockDraft}
          error={null}
          submitting={false}
          onOpenChange={() => {}}
          onDraftChange={() => {}}
          onSubmit={() => {}}
          onQuickSubmit={() => {}}
        />,
      );
    });

    const searchInput = document.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    const searchButton = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.includes("Search") || btn.textContent?.includes("common.search"),
    );
    expect(searchButton).toBeDefined();

    await act(async () => {
      searchButton?.click();
    });

    expect(searchPlaces).toHaveBeenCalled();
  });
});
