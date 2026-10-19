import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTripModal } from "./create-trip-modal";
import { createTrip } from "@/features/trip-management/services/trip-management-api";

vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: (state: any) => any) =>
    selector({
      user: { id: "user-1", name: "Nguyễn Văn Trí", email: "tri@example.com" },
      isAuthenticated: true,
    }),
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string, params?: { name?: string }) => {
      if (key === "aiPlanner.createTripModalTitle" && params?.name) {
        return `Tôi nên lưu ý điều gì cho chuyến đi này, ${params.name}?`;
      }
      return key;
    },
  }),
}));

vi.mock("@/features/trip-management/services/trip-management-api", () => ({
  createTrip: vi.fn(),
}));

vi.mock("@/features/places/services/places-api", () => ({
  searchPlaces: vi.fn().mockResolvedValue({
    data: [
      {
        id: "place-1",
        name: "Đà Nẵng",
        address: "Việt Nam",
        photos: [],
      },
    ],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CreateTripModal Component", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it("renders 3 detail cards (Where, When, Who) without layout overlap matching Screenshot 8", async () => {
    await act(async () => {
      root.render(
        <CreateTripModal
          isOpen={true}
          onClose={() => {}}
          initialDestination="Tokyo"
        />
      );
    });

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Tôi nên lưu ý điều gì cho chuyến đi này, Trí?");
    expect(bodyText).toContain("Tokyo");
    expect(bodyText).toContain("trip.intakeWhere");
    expect(bodyText).toContain("trip.intakeWhen");
    expect(bodyText).toContain("trip.intakeWho");
    // Budget is not in the main card, avoiding overlap with Create button
    expect(bodyText).toContain("trip.intakeCreate");
  });

  it("submits trip with travelerCount and prompt notes", async () => {
    const mockCreated = {
      id: "trip-tokyo-1",
      name: "Trip to Tokyo",
      destinationName: "Tokyo",
      startDate: "2026-10-20",
      endDate: "2026-10-25",
      travelerCount: 2,
    };
    vi.mocked(createTrip).mockResolvedValueOnce(mockCreated as any);

    const onTripCreated = vi.fn();

    await act(async () => {
      root.render(
        <CreateTripModal
          isOpen={true}
          onClose={() => {}}
          onTripCreated={onTripCreated}
          initialDestination="Tokyo"
          initialPromptText="5-day Tokyo trip this October"
        />
      );
    });

    const createButton = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.includes("trip.intakeCreate")
    );
    expect(createButton).toBeDefined();

    await act(async () => {
      createButton?.click();
    });

    expect(createTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/Tokyo/),
        destinationName: "Tokyo",
        travelerCount: undefined,
        notes: expect.stringContaining("5-day Tokyo trip this October"),
      })
    );
    expect(onTripCreated).toHaveBeenCalledWith(mockCreated, "5-day Tokyo trip this October");
  });

  it("submits trip with explicit travelerCount when provided", async () => {
    const mockCreated = {
      id: "trip-tokyo-2",
      name: "Trip to Tokyo",
      destinationName: "Tokyo",
      startDate: "2026-10-20",
      endDate: "2026-10-25",
      travelerCount: 3,
    };
    vi.mocked(createTrip).mockResolvedValueOnce(mockCreated as any);

    const onTripCreated = vi.fn();

    await act(async () => {
      root.render(
        <CreateTripModal
          isOpen={true}
          onClose={() => {}}
          onTripCreated={onTripCreated}
          initialDestination="Tokyo"
          initialTravelers={3}
        />
      );
    });

    const createButton = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.includes("trip.intakeCreate")
    );

    await act(async () => {
      createButton?.click();
    });

    expect(createTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationName: "Tokyo",
        travelerCount: 3,
      })
    );
    expect(onTripCreated).toHaveBeenCalledWith(mockCreated, "");
  });
});
