import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { MINDTRIP_HOTELS } from "../../data/mock-hotels";
import { MindtripHotelCard } from "../mindtrip-hotel-card";
import { MindtripBookStayModal } from "../mindtrip-book-stay-modal";
import { MindtripAvailableRoomsView } from "../mindtrip-available-rooms-view";
import { MindtripHotelDetailOverlay } from "../mindtrip-hotel-detail-overlay";

vi.mock("@/features/community-reviews", () => ({
  CommunityReviewsSection: () => <div>Community reviews</div>,
}));

const testHotel = MINDTRIP_HOTELS[0]; // Crown Retreat Quy Nhon

describe("Mindtrip Hotel Components", () => {
  it("renders MindtripHotelCard matching Screenshot 3 format", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripHotelCard hotel={testHotel} />
      </I18nProvider>
    );

    // Title & rating
    expect(html).toContain("Crown Retreat Quy Nhon");
    expect(html).toContain("4.2");
    // Location
    expect(html).toContain("Phuong Phi, Bình Định");
    // Nightly rate
    expect(html).toContain("66 US$");
    expect(html).toContain("night");
    // Category Hotel
    expect(html).toContain("Hotel");
  });

  it("renders MindtripBookStayModal matching Screenshot 2 format", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripBookStayModal
          hotel={testHotel}
          isOpen={true}
          onClose={() => {}}
          onChooseRoom={() => {}}
          checkInDate="14 thg 10"
          checkOutDate="15 thg 10"
        />
      </I18nProvider>
    );

    // Hotel Mini Header
    expect(html).toContain("Crown Retreat Quy Nhon");
    expect(html).toContain("4.2");
    expect(html).toContain("Phuong Phi, Bình Định");

    // 3 Date & Guests segments
    expect(html).toContain("Check in");
    expect(html).toContain("14 thg 10");
    expect(html).toContain("Check out");
    expect(html).toContain("15 thg 10");
    expect(html).toContain("2 adults");

    // Feature Book your stay card & 3 value points
    expect(html).toContain("Book your stay");
    expect(html).toContain("66 US$");
    expect(html).toContain("per night");
    expect(html).toContain("Matches the best price we found");
    expect(html).toContain("Flights, stays and plans — all in one place");
    expect(html).toContain("Your personal travel assistant, throughout your trip");
    expect(html).toContain("Choose a room");

    // Other booking options
    expect(html).toContain("Other booking options");
    expect(html).toContain("Booking.com");
    expect(html).toContain("Priceline");
    expect(html).toContain("View deal");
  });

  it("renders MindtripAvailableRoomsView matching Screenshot 1 format", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripAvailableRoomsView
          hotel={testHotel}
          onBack={() => {}}
          checkInDate="14 thg 10"
          checkOutDate="15 thg 10"
        />
      </I18nProvider>
    );

    // Header mini card & dates
    expect(html).toContain("Crown Retreat Quy Nhon");
    expect(html).toContain("Available rooms");
    expect(html).toContain("Show total price (including taxes &amp; fees)");

    // Room cards with specs & badges
    expect(html).toContain("Standard Garden Double Bungalow");
    expect(html).toContain("6 rooms left");
    expect(html).toContain("388 sq ft");
    expect(html).toContain("Sleeps 2");
    expect(html).toContain("1 king");
    expect(html).toContain("Non-refundable");
    expect(html).toContain("More details");
    expect(html).toContain("Book");

    // Other room types
    expect(html).toContain("Standard Sea View Double Bungalow");
    expect(html).toContain("Executive Sea View Double Bungalow");
    expect(html).toContain("Deluxe Beach front Double bungalow");
  });

  it("renders MindtripHotelDetailOverlay matching Screenshot 3 format", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripHotelDetailOverlay
          hotel={testHotel}
          onClose={() => {}}
          checkInDate="14 thg 10"
          checkOutDate="15 thg 10"
        />
      </I18nProvider>
    );

    // Header actions
    expect(html).toContain("Save");
    expect(html).toContain("Add to trip");

    // Title
    expect(html).toContain("Crown Retreat Quy Nhon");

    // Tabs
    expect(html).toContain("Overview");
    expect(html).toContain("Amenities");
    expect(html).toContain("Reviews");
    expect(html).toContain("Location");

    // Description & details
    expect(html).toContain("luxury resort located on Trung Luong Beach");
    expect(html).toContain("Trung Luong Cat Tien Phu, Cat District, Quy Nhon, Vietnam");
    expect(html).toContain("Get directions");
    expect(html).toContain("+84 256 6502 468");

    // Sticky Booking Card
    expect(html).toContain("66 US$");
    expect(html).toContain("per night");
    expect(html).toContain("Check availability");
    expect(html).toContain("Set price alert");

    // Conversational AI bar removed per UX design
    expect(html).not.toContain("Ask TripSense...");
  });
});
