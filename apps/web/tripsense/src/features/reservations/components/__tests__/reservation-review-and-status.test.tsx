import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import {
  ReservationReviewModal,
  getStoredReview,
  saveStoredReview,
  type ReservationReview,
} from "../reservation-review-modal";
import { InChatReservationCard } from "../in-chat-reservation-card";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
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
    t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue || k,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ReservationReviewModal & Storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("stores and retrieves review from localStorage", () => {
    const sampleReview: ReservationReview = {
      reservationId: "res-123",
      businessName: "Hawa Food Đà Nẵng",
      rating: 5,
      content: "Món ăn rất ngon, phục vụ chu đáo!",
      tags: ["Món ăn đậm đà", "Phục vụ nhiệt tình"],
      createdAt: new Date().toISOString(),
    };

    saveStoredReview(sampleReview);
    const retrieved = getStoredReview("res-123");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.rating).toBe(5);
    expect(retrieved?.businessName).toBe("Hawa Food Đà Nẵng");
    expect(retrieved?.tags).toContain("Món ăn đậm đà");
  });

  it("dispatches tripsense:review-updated event on save", () => {
    const listener = vi.fn();
    window.addEventListener("tripsense:review-updated", listener);

    const sampleReview: ReservationReview = {
      reservationId: "res-event-test",
      businessName: "Bánh Xèo Làng",
      rating: 4,
      content: "Ăn rất vừa miệng.",
      tags: [],
      createdAt: new Date().toISOString(),
    };

    saveStoredReview(sampleReview);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("tripsense:review-updated", listener);
  });

  it("renders review modal markup when open", () => {
    const html = renderToString(
      <ReservationReviewModal
        open={true}
        onOpenChange={() => {}}
        reservationId="res-modal-test"
        businessName="Nhà Hàng Biển Đông"
      />
    );

    expect(html).toContain("Nhà Hàng Biển Đông");
    expect(html).toContain("Đánh giá trải nghiệm");
    expect(html).toContain("Món ăn đậm đà");
    expect(html).toContain("Hoàn tất đánh giá");
  });
});

describe("InChatReservationCard - Completed State & Time Formatting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks past reservation as 'Đã hoàn thành' and removes redundant seconds", () => {
    const pastOffer: ReservationOfferPreview = {
      id: "offer-1",
      conversationId: "conv-1",
      senderId: "partner-1",
      recipientId: "customer-1",
      businessType: "RESTAURANT",
      businessId: "biz-1",
      businessName: "Bánh Xèo Làng",
      itemTitle: "Bàn 4 người",
      checkInDate: "2020-01-01", // Past
      reservationTime: "19:00:00",
      adultsCount: 2,
      childrenCount: 0,
      totalPrice: 0,
      currency: "VND",
      expiresAt: "2020-01-01T23:59:59Z",
      status: "ACCEPTED",
      bookingCode: "TS-RES-PAST1",
    };

    const html = renderToString(<InChatReservationCard offer={pastOffer} />);

    // Shows "Đã hoàn thành" badge
    expect(html).toContain("Đã hoàn thành");

    // Redundant :00 seconds are removed: "19:00" rendered
    expect(html).toContain("19:00");
    expect(html).not.toContain("19:00:00");

    // Shows Rate experience button
    expect(html).toContain("Đánh giá trải nghiệm");
  });

  it("displays upcoming reservation as 'Đã xác nhận' without rate button", () => {
    const futureOffer: ReservationOfferPreview = {
      id: "offer-2",
      conversationId: "conv-2",
      senderId: "partner-1",
      recipientId: "customer-1",
      businessType: "RESTAURANT",
      businessId: "biz-1",
      businessName: "Bánh Xèo Làng",
      itemTitle: "Bàn 2 người",
      checkInDate: "2099-12-31", // Future
      reservationTime: "18:30:00",
      adultsCount: 2,
      childrenCount: 0,
      totalPrice: 0,
      currency: "VND",
      expiresAt: "2099-12-31T23:59:59Z",
      status: "ACCEPTED",
      bookingCode: "TS-RES-FUT1",
    };

    const html = renderToString(<InChatReservationCard offer={futureOffer} />);

    expect(html).toContain("Đã xác nhận");
    expect(html).not.toContain("Đã hoàn thành");
    expect(html).not.toContain("⭐ Đánh giá trải nghiệm");
    expect(html).toContain("18:30");
  });
});
