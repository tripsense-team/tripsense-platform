import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { chatApi } from "../services/chat-api";
import { ReservationOfferCard } from "../components/reservation-offer-card";
import { CreateReservationOfferModal } from "../components/create-reservation-offer-modal";
import { InChatReservationCard } from "@/features/reservations/components/in-chat-reservation-card";
import type { ReservationOfferPreview, ChatMessageItem } from "../types/chat.types";
import * as apiClientModule from "@/services/api-client";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && "time" in params) return `Hết hạn sau ${params.time}`;
      if (params && "hours" in params) return `${params.hours} giờ`;
      if (params && "name" in params) return `${params.name}`;
      return key;
    },
    language: "vi",
  }),
}));

describe("Chat Reservation Offer API & Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleOffer: ReservationOfferPreview = {
    id: "off-100",
    conversationId: "conv-1",
    senderId: "partner-user-1",
    recipientId: "guest-user-1",
    businessType: "HOTEL",
    businessId: "biz-hotel-1",
    businessName: "Khách sạn Mường Thanh Luxury",
    itemTitle: "Phòng Deluxe King view sông Hàn",
    checkInDate: "2026-11-10",
    checkOutDate: "2026-11-12",
    adultsCount: 2,
    childrenCount: 1,
    totalPrice: 2400000,
    currency: "VND",
    inclusions: "Bao gồm ăn sáng buffet và hồ bơi",
    expiresAt: new Date(Date.now() + 3600000 * 12).toISOString(),
    status: "PENDING",
    createdAt: "2026-11-02T10:00:00Z",
  };

  describe("API Client Methods", () => {
    it("chatApi.createOffer sends POST request to endpoint", async () => {
      const mockApiClient = vi.mocked(apiClientModule.apiClient);
      mockApiClient.mockResolvedValueOnce({
        data: { id: "msg-1", type: "RESERVATION_OFFER" },
      } as any);

      const payload = {
        clientMessageId: "cli-1",
        businessType: "HOTEL" as const,
        businessId: "biz-1",
        businessName: "Mường Thanh",
        itemTitle: "Deluxe King",
        checkInDate: "2026-11-10",
        adultsCount: 2,
        totalPrice: 2000000,
      };

      const result = await chatApi.createOffer("conv-1", payload);
      expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/conversations/conv-1/offers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      expect(result.id).toBe("msg-1");
    });

    it("chatApi.acceptOffer calls accept endpoint", async () => {
      const mockApiClient = vi.mocked(apiClientModule.apiClient);
      mockApiClient.mockResolvedValueOnce({
        data: { offerId: "off-100", status: "ACCEPTED", bookingCode: "TS-HTL-12345" },
      } as any);

      const res = await chatApi.acceptOffer("off-100");
      expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/offers/off-100/accept", {
        method: "POST",
      });
      expect(res.bookingCode).toBe("TS-HTL-12345");
    });

    it("chatApi.declineOffer calls decline endpoint with optional reason", async () => {
      const mockApiClient = vi.mocked(apiClientModule.apiClient);
      mockApiClient.mockResolvedValueOnce({
        data: { id: "off-100", status: "DECLINED", declineReason: "Lịch thay đổi" },
      } as any);

      const res = await chatApi.declineOffer("off-100", "Lịch thay đổi");
      expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/offers/off-100/decline", {
        method: "POST",
        body: JSON.stringify({ reason: "Lịch thay đổi" }),
      });
      expect(res.status).toBe("DECLINED");
    });

    it("chatApi.cancelOffer calls cancel endpoint", async () => {
      const mockApiClient = vi.mocked(apiClientModule.apiClient);
      mockApiClient.mockResolvedValueOnce({
        data: { id: "off-100", status: "CANCELLED" },
      } as any);

      const res = await chatApi.cancelOffer("off-100");
      expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/offers/off-100/cancel", {
        method: "POST",
      });
      expect(res.status).toBe("CANCELLED");
    });
  });

  describe("ReservationOfferCard Component", () => {
    it("renders offer details correctly", () => {
      const html = renderToString(
        <ReservationOfferCard
          offer={sampleOffer}
          isMe={false}
        />
      );

      expect(html).toContain("Khách sạn Mường Thanh Luxury");
      expect(html).toContain("Phòng Deluxe King view sông Hàn");
      expect(html).toContain("10/11/2026");
      expect(html).toContain("Bao gồm ăn sáng buffet và hồ bơi");
    });

    it("renders accept & decline buttons for guest (isMe=false) in pending state", () => {
      const html = renderToString(
        <ReservationOfferCard
          offer={sampleOffer}
          isMe={false}
        />
      );

      expect(html).toContain("chat.offer.acceptAction");
      expect(html).toContain("chat.offer.declineAction");
    });

    it("renders cancel button for host/partner (isMe=true) in pending state", () => {
      const html = renderToString(
        <ReservationOfferCard
          offer={sampleOffer}
          isMe={true}
        />
      );

      expect(html).toContain("chat.offer.cancelAction");
    });

    it("renders booking code and link to reservations hub when offer is accepted", () => {
      const acceptedOffer: ReservationOfferPreview = {
        ...sampleOffer,
        status: "ACCEPTED",
        bookingCode: "TS-HTL-998877",
        bookingId: "book-123",
      };

      const html = renderToString(
        <ReservationOfferCard
          offer={acceptedOffer}
          isMe={false}
        />
      );

      expect(html).toContain("#TS-HTL-998877");
      expect(html).toContain("chat.offer.viewReservations");
      expect(html).toContain("/reservations?tab=hotels&amp;bookingId=book-123");
    });

    it("renders decline reason if present in declined state", () => {
      const declinedOffer: ReservationOfferPreview = {
        ...sampleOffer,
        status: "DECLINED",
        declineReason: "Khách đã đổi phòng khác",
      };

      const html = renderToString(
        <ReservationOfferCard
          offer={declinedOffer}
          isMe={false}
        />
      );

      expect(html).toContain("chat.offer.statusDeclined");
      expect(html).toContain("Khách đã đổi phòng khác");
    });
  });

  describe("CreateReservationOfferModal Component", () => {
    it("renders dialog elements with defaults when open", () => {
      const html = renderToString(
        <CreateReservationOfferModal
          open={true}
          onOpenChange={() => {}}
          onSubmit={async () => {}}
          defaultBusinessName="Khách sạn Mường Thanh"
          defaultBusinessType="HOTEL"
        />
      );

      expect(html).toContain("chat.offer.createTitle");
      expect(html).toContain("chat.offer.hotel");
      expect(html).toContain("chat.offer.restaurant");
      expect(html).toContain("chat.offer.sendAction");
    });

    it("smart prefills dates, guests, and hotel name from guest inquiry message", () => {
      const messages: ChatMessageItem[] = [
        {
          id: "m-inquiry",
          clientMessageId: "c-inq",
          senderId: "guest-user",
          text: "Chào bạn, mình muốn hỏi thông tin đặt phòng tại Khách sạn Mường Thanh Luxury Sông Hàn từ ngày 2026-10-30 đến 2026-10-31 cho 2 khách. Khách sạn tư vấn phòng trống và giá giúp mình nhé!",
          createdAt: "2026-11-02T10:00:00Z",
          status: "read",
        },
      ];

      const html = renderToString(
        <CreateReservationOfferModal
          open={true}
          onOpenChange={() => {}}
          onSubmit={async () => {}}
          recentMessages={messages}
        />
      );

      expect(html).toContain("2026-10-30");
      expect(html).toContain("2026-10-31");
      expect(html).toContain("Mường Thanh Luxury Sông Hàn");
      expect(html).toContain("chat.offer.smartPrefillDetected");
    });
  });

  describe("InChatReservationCard Component (Reservations Hub Integration)", () => {
    it("renders accepted ticket card in UnifiedReservationsHub with booking code and open chat link", () => {
      const acceptedOffer: ReservationOfferPreview = {
        ...sampleOffer,
        status: "ACCEPTED",
        bookingCode: "TS-HTL-778899",
        bookingId: "b-hub-1",
      };

      const html = renderToString(
        <InChatReservationCard
          offer={acceptedOffer}
          isTarget={true}
        />
      );

      expect(html).toContain("#TS-HTL-778899");
      expect(html).toContain("reservations.inChatTag");
      expect(html).toContain("reservations.statusConfirmed");
      expect(html).toContain("reservations.openChat");
      expect(html).toContain("/chat?t=conv-1");
      expect(html).toContain("Khách sạn Mường Thanh Luxury");
      expect(html).toContain("Phòng Deluxe King view sông Hàn");
    });
  });
});