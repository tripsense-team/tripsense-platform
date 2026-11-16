import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ChatZioMapPanel } from "../chat-ziomap-panel";
import { ChatHeader } from "../chat-header";

let capturedMapProps: Record<string, unknown> | null = null;

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockDynamicMap = (props: Record<string, unknown>) => {
      capturedMapProps = props;
      return React.createElement("div", { "data-testid": "mock-mapvina" });
    };
    return MockDynamicMap;
  },
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    locale: "vi",
  }),
}));

vi.mock("@/hooks/use-ai-chats", () => ({
  isGenericChatTitle: () => false,
}));

describe("ChatZioMapPanel & ChatHeader map controls", () => {
  it("renders full-bleed ZioMap panel with floating translucent controls and omits redundant top bar clutter", () => {
    const html = renderToString(
      <ChatZioMapPanel
        places={[
          {
            id: "p1",
            name: "Bãi biển Mỹ Khê",
            categories: ["BEACH"],
            location: { lat: 16.0592, lng: 108.2465 },
            photos: [],
          },
        ]}
        dayNumbers={[1, 2]}
        selectedDayNumber={null}
        onSelectDayNumber={vi.fn()}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        destinationPin={{ name: "Đà Nẵng", lat: 16.0544, lng: 108.2022 }}
        resolvedDestination="Đà Nẵng"
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="chat-ziomap-panel"');
    expect(html).toContain('data-testid="chat-ziomap-floating-controls"');
    expect(html).toContain("backdrop-blur-md");
    expect(html).toContain("trip.allDays");
    expect(html).toContain("aiPlanner.mapDayNumber:{&quot;day&quot;:1}");
    expect(html).toContain("aiPlanner.mapDayNumber:{&quot;day&quot;:2}");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-testid="mock-mapvina"');

    // Removed header clutter should not appear on expanded map overlay
    expect(html).not.toContain("Đà Nẵng");
    expect(html).not.toContain("aiPlanner.mapPlacesCount");
    expect(html).not.toContain("trip.fitMap");
    expect(html).not.toContain("aiPlanner.viewTripDetails");
  });

  it("renders collapsed w-14 strip when isCollapsed is true", () => {
    const html = renderToString(
      <ChatZioMapPanel
        places={[]}
        dayNumbers={[]}
        selectedDayNumber={null}
        onSelectDayNumber={vi.fn()}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        destinationPin={{ name: "Đà Lạt", lat: 11.9404, lng: 108.4583 }}
        resolvedDestination="Đà Lạt"
        isCollapsed={true}
        onToggleCollapse={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("w-14");
    expect(html).toContain("Đà Lạt");
    expect(html).not.toContain('data-testid="mock-mapvina"');
  });

  it("renders ZioMap toggle button in ChatHeader with active aria-pressed state", () => {
    const htmlOpen = renderToString(
      <ChatHeader
        chatTitle="Lịch trình Đà Nẵng"
        isMapOpen={true}
        onToggleMap={vi.fn()}
      />,
    );
    expect(htmlOpen).toContain('data-testid="header-map-toggle"');
    expect(htmlOpen).toContain('aria-pressed="true"');

    const htmlClosed = renderToString(
      <ChatHeader
        chatTitle="Lịch trình Đà Nẵng"
        isMapOpen={false}
        onToggleMap={vi.fn()}
      />,
    );
    expect(htmlClosed).toContain('aria-pressed="false"');
  });

  it("forwards MapVina popup onViewDetails click to onViewPlaceDetails without rendering modal popup", () => {
    capturedMapProps = null;
    const onViewPlaceDetails = vi.fn();
    const targetPlace = {
      id: "p-bao-tang",
      name: "Bảo tàng Mỹ thuật Đà Nẵng",
      categories: ["museum"],
      location: { lat: 16.0715, lng: 108.2195 },
      photos: [],
    };

    const html = renderToString(
      <ChatZioMapPanel
        places={[targetPlace]}
        dayNumbers={[1]}
        selectedDayNumber={null}
        onSelectDayNumber={vi.fn()}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        destinationPin={{ name: "Đà Nẵng", lat: 16.0544, lng: 108.2022 }}
        resolvedDestination="Đà Nẵng"
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        onClose={vi.fn()}
        onViewPlaceDetails={onViewPlaceDetails}
      />,
    );

    expect(html).not.toContain('role="dialog"');
    const props = capturedMapProps as
      | {
          onViewDetails?: (place: typeof targetPlace) => void;
          openDetailsOnMarkerClick?: boolean;
        }
      | null;
    expect(props?.openDetailsOnMarkerClick).toBe(true);
    const onViewDetails = props?.onViewDetails;
    expect(typeof onViewDetails).toBe("function");
    onViewDetails?.(targetPlace);
    expect(onViewPlaceDetails).toHaveBeenCalledTimes(1);
    expect(onViewPlaceDetails).toHaveBeenCalledWith(targetPlace);
  });
});
