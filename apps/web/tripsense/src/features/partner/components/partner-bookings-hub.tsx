"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Users,
  Utensils,
  Hotel,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  Phone,
  Mail,
  Search,
  Filter,
  Check,
  X,
  Copy,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowUpDown,
  Compass,
  Car,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  getBusinessRestaurantReservations,
  decideRestaurantReservation,
} from "../services/partner-api";
import {
  getPartnerRentalBookings,
  confirmRentalBooking,
  handoverRentalBooking,
  returnRentalBooking,
  rejectRentalBooking,
} from "../services/rental-api";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import { chatApi } from "@/features/chat/services/chat-api";
import type { BusinessDetailDto, RestaurantReservationDto, RentalBookingOrderDto } from "../types";
import type { HotelBooking, HotelProperty } from "@/features/hotels/types";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import { CreateDirectBookingModal } from "./create-direct-booking-modal";

export type BookingSourceType = "RESTAURANT" | "HOTEL" | "CHAT_OFFER" | "RENTAL";
export type NormalizedBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";

export interface UnifiedPartnerBooking {
  id: string;
  sourceType: BookingSourceType;
  businessId: string;
  businessName: string;
  bookingCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  threadId?: string | null;

  startDateTime: string;
  endDateTime?: string | null;
  createdAt?: string | null;
  timeSlot?: string | null;
  durationInfo?: string | null;

  serviceTitle: string;
  adultsCount: number;
  childrenCount: number;
  specialNotes?: string | null;

  totalPrice: number;
  isFreeOrPayAtVenue: boolean;
  currency: string;

  rawStatus: string;
  normalizedStatus: NormalizedBookingStatus;
  statusLabel: string;
  version: number;

  restaurantReservation?: RestaurantReservationDto;
  hotelBooking?: HotelBooking;
  chatOffer?: ReservationOfferPreview;
  rentalBooking?: RentalBookingOrderDto;
}

interface PartnerBookingsHubProps {
  businesses: BusinessDetailDto[];
  initialBusinessId?: string;
  onRefreshBusinesses?: () => void;
}

export function PartnerBookingsHub({
  businesses,
  initialBusinessId,
  onRefreshBusinesses,
}: PartnerBookingsHubProps) {
  const { t } = useTranslation();

  const [bookings, setBookings] = React.useState<UnifiedPartnerBooking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const PAGE_SIZE = 8;

  // Filters
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string>(
    initialBusinessId && businesses.some((b) => b.id === initialBusinessId)
      ? initialBusinessId
      : "ALL",
  );
  const [selectedServiceType, setSelectedServiceType] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [directBookingOpen, setDirectBookingOpen] = React.useState(false);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = React.useState(false);
  const [targetBooking, setTargetBooking] = React.useState<UnifiedPartnerBooking | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const loadAllBookings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const unifiedList: UnifiedPartnerBooking[] = [];

      // 1. Fetch Restaurant Table Reservations
      const restaurantBizs = businesses.filter((b) => b.kind === "RESTAURANT");
      const restaurantPromises = restaurantBizs.map(async (biz) => {
        try {
          const res = await getBusinessRestaurantReservations(biz.id, undefined, 0, 100);
          (res.content || []).forEach((item) => {
            const contactMatch = item.notes?.match(/\[Khách đặt:\s*([^|]+)\|\s*SĐT:\s*([^\]]+)\]/);
            const guestName = contactMatch ? contactMatch[1].trim() : item.customerName;
            const guestPhone = contactMatch ? contactMatch[2].trim() : null;
            const displayNotes = contactMatch
              ? item.notes?.replace(contactMatch[0], "").replace(/^\s*-\s*(Ghi chú:\s*)?/, "").trim()
              : item.notes;

            const isExpired = item.state === "REQUESTED" && (
              item.startAt ? new Date(item.startAt).getTime() < Date.now() : false
            );

            let normStatus: NormalizedBookingStatus = isExpired ? "EXPIRED" : "PENDING";
            let statusLabel = isExpired ? "Hết hạn" : "Chờ xác nhận";
            if (item.state === "CONFIRMED") {
              normStatus = "CONFIRMED";
              statusLabel = "Đã xác nhận giữ bàn";
            } else if (item.state === "REJECTED") {
              normStatus = "REJECTED";
              statusLabel = "Đã từ chối";
            } else if (item.state === "CANCELLED") {
              normStatus = "CANCELLED";
              statusLabel = "Đã hủy";
            }

            unifiedList.push({
              id: item.id,
              sourceType: "RESTAURANT",
              businessId: biz.id,
              businessName: biz.displayName,
              bookingCode: `#TS-RES-${item.id.slice(0, 8).toUpperCase()}`,
              customerName: guestName || "Khách đặt bàn",
              customerPhone: guestPhone,
              customerEmail: item.customerEmail,
              customerId: item.customerId,
              startDateTime: item.startAt,
              createdAt: item.createdAt || item.startAt,
              serviceTitle: `Bàn ${item.adults + item.children} khách`,
              adultsCount: item.adults,
              childrenCount: item.children,
              specialNotes: displayNotes,
              totalPrice: 0,
              isFreeOrPayAtVenue: true,
              currency: "VND",
              rawStatus: item.state,
              normalizedStatus: normStatus,
              statusLabel,
              version: item.version,
              restaurantReservation: item,
            });
          });
        } catch {
          // silently continue for other businesses
        }
      });

      // 2. Fetch Hotel Bookings
      const hotelBizs = businesses.filter((b) => b.kind === "HOTEL");
      const hotelPromises = (async () => {
        if (hotelBizs.length === 0) return;
        try {
          const properties = await hotelApi<HotelProperty[]>("/properties").catch(() => []);
          for (const biz of hotelBizs) {
            const prop = properties.find((p) => p.business_id === biz.id);
            if (!prop) continue;
            try {
              const bookingsRes = await hotelApi<HotelBooking[]>(`/properties/${prop.id}/bookings`);
              (bookingsRes || []).forEach((b) => {
                const isHeldExpired = (b.status === "HELD" || b.status === "PENDING") && (
                  b.expires_at
                    ? new Date(b.expires_at).getTime() < Date.now()
                    : b.check_in
                    ? new Date(b.check_in).getTime() < Date.now()
                    : false
                );

                let normStatus: NormalizedBookingStatus = isHeldExpired ? "EXPIRED" : "PENDING";
                let statusLabel = isHeldExpired ? "Hết hạn" : "Chờ xác nhận";
                if (b.status === "CONFIRMED") {
                  normStatus = "CONFIRMED";
                  statusLabel = "Đã xác nhận";
                } else if (b.status === "CHECKED_IN") {
                  normStatus = "COMPLETED";
                  statusLabel = "Đang lưu trú";
                } else if (b.status === "CHECKED_OUT") {
                  normStatus = "COMPLETED";
                  statusLabel = "Đã trả phòng";
                } else if (["CANCELLED", "NO_SHOW"].includes(b.status)) {
                  normStatus = "CANCELLED";
                  statusLabel = b.status === "NO_SHOW" ? "Khách vắng mặt" : "Đã hủy";
                } else if (b.status === "EXPIRED") {
                  normStatus = "EXPIRED";
                  statusLabel = "Hết hạn";
                }

                unifiedList.push({
                  id: b.id,
                  sourceType: "HOTEL",
                  businessId: biz.id,
                  businessName: biz.displayName || b.property_name,
                  bookingCode: `#TS-HTL-${b.id.slice(0, 8).toUpperCase()}`,
                  customerName: "Khách đặt phòng",
                  customerPhone: null,
                  customerEmail: null,
                  customerId: null,
                  startDateTime: b.check_in,
                  endDateTime: b.check_out,
                  createdAt: b.created_at || b.check_in,
                  serviceTitle: `${b.room_name} (${b.quantity} phòng)`,
                  adultsCount: b.guests,
                  childrenCount: 0,
                  totalPrice: b.total,
                  isFreeOrPayAtVenue: false,
                  currency: b.currency || "VND",
                  rawStatus: b.status,
                  normalizedStatus: normStatus,
                  statusLabel,
                  version: b.version,
                  hotelBooking: b,
                });
              });
            } catch {
              // continue
            }
          }
        } catch {
          // continue
        }
      })();

      // 3. Fetch In-Chat Offers
      const offersPromise = (async () => {
        try {
          const offers = await chatApi.myOffers().catch(() => []);
          (offers || []).forEach((offer) => {
            // Only include if belonging to this partner's businesses
            const matchedBiz = businesses.find((b) => b.id === offer.businessId);
            const bizName = matchedBiz?.displayName || offer.businessName;

            const isOfferExpired = offer.status === "PENDING" && (
              offer.expiresAt ? new Date(offer.expiresAt).getTime() < Date.now() : false
            );

            let normStatus: NormalizedBookingStatus = isOfferExpired ? "EXPIRED" : "PENDING";
            let statusLabel = isOfferExpired ? "Hết hạn" : "Chờ khách xác nhận";
            if (offer.status === "ACCEPTED") {
              normStatus = "CONFIRMED";
              statusLabel = "Khách đã chốt đơn";
            } else if (offer.status === "DECLINED") {
              normStatus = "REJECTED";
              statusLabel = "Khách từ chối";
            } else if (offer.status === "CANCELLED") {
              normStatus = "CANCELLED";
              statusLabel = "Đã hủy";
            } else if (offer.status === "EXPIRED") {
              normStatus = "EXPIRED";
              statusLabel = "Đã hết hạn";
            }

            unifiedList.push({
              id: offer.id,
              sourceType: "CHAT_OFFER",
              businessId: offer.businessId,
              businessName: bizName,
              bookingCode: offer.bookingCode || `#TS-CHAT-${offer.id.slice(0, 8).toUpperCase()}`,
              customerName: "Khách trò chuyện",
              customerId: offer.recipientId,
              threadId: offer.conversationId,
              startDateTime: offer.checkInDate,
              endDateTime: offer.checkOutDate,
              createdAt: offer.createdAt || offer.checkInDate,
              timeSlot: offer.reservationTime,
              serviceTitle: offer.itemTitle,
              adultsCount: offer.adultsCount,
              childrenCount: offer.childrenCount,
              specialNotes: offer.inclusions,
              totalPrice: offer.totalPrice,
              isFreeOrPayAtVenue: offer.totalPrice === 0,
              currency: offer.currency || "VND",
              rawStatus: offer.status,
              normalizedStatus: normStatus,
              statusLabel,
              version: 1,
              chatOffer: offer,
            });
          });
        } catch {
          // continue
        }
      })();

      // 4. Fetch Rental Bookings
      const rentalBizs = businesses.filter((b) => b.kind === "RENTAL_SERVICE");
      const rentalPromises = rentalBizs.map(async (biz) => {
        try {
          const rentalBookings = await getPartnerRentalBookings(biz.id);
          const rentalList = Array.isArray(rentalBookings)
            ? rentalBookings
            : ((rentalBookings as unknown as { content?: RentalBookingOrderDto[] })?.content || []);
          rentalList.forEach((r) => {
            const isPendingExpired =
              r.status === "PENDING" &&
              (r.pickupAt ? new Date(r.pickupAt).getTime() < Date.now() : false);

            let normStatus: NormalizedBookingStatus = isPendingExpired ? "EXPIRED" : "PENDING";
            let statusLabel = isPendingExpired ? "Hết hạn" : "Chờ xác nhận";

            if (r.status === "CONFIRMED") {
              normStatus = "CONFIRMED";
              statusLabel = "Đã xác nhận (Chờ bàn giao)";
            } else if (r.status === "IN_USE") {
              normStatus = "CONFIRMED";
              statusLabel = "Đang sử dụng xe/thiết bị";
            } else if (r.status === "RETURNED") {
              normStatus = "COMPLETED";
              statusLabel = "Đã trả xe/thiết bị";
            } else if (r.status === "CANCELLED") {
              normStatus = "CANCELLED";
              statusLabel = "Đã hủy";
            } else if (r.status === "REJECTED") {
              normStatus = "REJECTED";
              statusLabel = "Đã từ chối";
            }

            unifiedList.push({
              id: r.id,
              sourceType: "RENTAL",
              businessId: biz.id,
              businessName: biz.displayName,
              bookingCode: r.bookingCode,
              customerName: r.customerName || "Khách thuê dịch vụ",
              customerPhone: r.customerPhone,
              customerEmail: r.customerEmail,
              customerId: r.customerUserId,
              startDateTime: r.pickupAt,
              endDateTime: r.returnAt,
              createdAt: r.createdAt || r.pickupAt,
              serviceTitle: `${r.rentalItemName} (x${r.quantity})`,
              adultsCount: r.quantity,
              childrenCount: 0,
              specialNotes: r.deliveryAddress
                ? `Giao tận nơi: ${r.deliveryAddress}${r.specialRequests ? ` · ${r.specialRequests}` : ""}`
                : r.specialRequests,
              totalPrice: r.totalAmount,
              isFreeOrPayAtVenue: false,
              currency: "VND",
              rawStatus: r.status,
              normalizedStatus: normStatus,
              statusLabel,
              version: 1,
              rentalBooking: r,
            });
          });
        } catch {
          // continue
        }
      });

      await Promise.all([
        Promise.all(restaurantPromises),
        hotelPromises,
        offersPromise,
        Promise.all(rentalPromises),
      ]);

      // Sort by newest first: prioritize creation time, then start date
      unifiedList.sort((a, b) => {
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (cB !== cA) return cB - cA;
        const tA = new Date(a.startDateTime).getTime();
        const tB = new Date(b.startDateTime).getTime();
        return tB - tA;
      });

      setBookings(unifiedList);
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể tải danh sách đặt bàn & phòng."));
    } finally {
      setLoading(false);
    }
  }, [businesses]);

  React.useEffect(() => {
    loadAllBookings();
  }, [loadAllBookings]);

  // Action: Confirm Restaurant Reservation
  const handleConfirmRestaurant = async (item: UnifiedPartnerBooking) => {
    const raw = item.restaurantReservation;
    if (!raw) return;
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      const updated = await decideRestaurantReservation(item.businessId, item.id, {
        expectedVersion: raw.version,
        decision: "CONFIRM",
      });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: updated.state,
                normalizedStatus: "CONFIRMED",
                statusLabel: "Đã xác nhận giữ bàn",
                version: updated.version,
              }
            : b,
        ),
      );

      setActionSuccess(`Đã xác nhận giữ bàn thành công cho khách #${item.bookingCode}!`);

      // Send chat confirmation if customerId exists
      if (raw.customerId) {
        const timeStr = new Date(raw.startAt).toLocaleString("vi-VN");
        const confirmMsg = `✅ [Xác nhận giữ bàn] Chào bạn, ${item.businessName} đã xác nhận yêu cầu đặt bàn của bạn vào lúc ${timeStr} (${raw.adults + raw.children} khách). Mã đặt bàn: ${item.bookingCode}. Quán rất hân hạnh được đón tiếp bạn!`;
        void chatApi.sendDirectMessage(raw.customerId, confirmMsg).catch(() => undefined);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể xác nhận đặt bàn."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Open Reject Modal
  const handleOpenReject = (item: UnifiedPartnerBooking) => {
    setTargetBooking(item);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  // Action: Confirm Reject
  const handleRejectSubmit = async () => {
    if (!targetBooking) return;
    try {
      setBusyId(targetBooking.id);
      setError(null);
      setActionSuccess(null);

      if (targetBooking.sourceType === "RESTAURANT" && targetBooking.restaurantReservation) {
        const raw = targetBooking.restaurantReservation;
        const updated = await decideRestaurantReservation(targetBooking.businessId, targetBooking.id, {
          expectedVersion: raw.version,
          decision: "REJECT",
          reason: rejectReason.trim() || undefined,
        });

        setBookings((prev) =>
          prev.map((b) =>
            b.id === targetBooking.id
              ? {
                  ...b,
                  rawStatus: updated.state,
                  normalizedStatus: "REJECTED",
                  statusLabel: "Đã từ chối",
                  version: updated.version,
                }
              : b,
          ),
        );

        setActionSuccess(`Đã từ chối yêu cầu đặt bàn ${targetBooking.bookingCode}.`);

        if (raw.customerId) {
          const reasonPart = rejectReason.trim() ? ` Lý do: ${rejectReason.trim()}` : "";
          const rejectMsg = `❌ [Thông báo đặt bàn] Rất tiếc, ${targetBooking.businessName} hiện không thể tiếp nhận yêu cầu đặt bàn ${targetBooking.bookingCode} của bạn.${reasonPart} Rất mong có dịp được đón tiếp bạn vào thời gian khác.`;
          void chatApi.sendDirectMessage(raw.customerId, rejectMsg).catch(() => undefined);
        }
      } else if (targetBooking.sourceType === "HOTEL" && targetBooking.hotelBooking) {
        const raw = targetBooking.hotelBooking;
        await hotelApi(`/bookings/${raw.id}/cancel`, "POST", {
          expectedVersion: raw.version,
          reason: rejectReason.trim() || "Từ chối bởi khách sạn",
        });

        setBookings((prev) =>
          prev.map((b) =>
            b.id === targetBooking.id
              ? {
                  ...b,
                  rawStatus: "CANCELLED",
                  normalizedStatus: "CANCELLED",
                  statusLabel: "Đã hủy bởi cơ sở",
                }
              : b,
          ),
        );
        setActionSuccess(`Đã hủy/từ chối đơn đặt phòng ${targetBooking.bookingCode}.`);
      } else if (targetBooking.sourceType === "RENTAL") {
        await rejectRentalBooking(
          targetBooking.businessId,
          targetBooking.id,
          rejectReason.trim() || undefined
        );

        setBookings((prev) =>
          prev.map((b) =>
            b.id === targetBooking.id
              ? {
                  ...b,
                  rawStatus: "REJECTED",
                  normalizedStatus: "REJECTED",
                  statusLabel: "Đã từ chối",
                }
              : b,
          ),
        );
        setActionSuccess(`Đã từ chối đơn thuê ${targetBooking.bookingCode}.`);
      }

      setRejectModalOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể từ chối yêu cầu."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Confirm Hotel Booking
  const handleConfirmHotel = async (item: UnifiedPartnerBooking) => {
    const raw = item.hotelBooking;
    if (!raw) return;
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      await hotelApi(`/bookings/${raw.id}/confirm`, "POST");
      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: "CONFIRMED",
                normalizedStatus: "CONFIRMED",
                statusLabel: "Đã xác nhận",
              }
            : b,
        ),
      );
      setActionSuccess(`Đã xác nhận đơn đặt phòng ${item.bookingCode} (${item.serviceTitle}) thành công!`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể xác nhận đặt phòng."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Hotel Check-In / Check-Out
  const handleHotelOperationalAction = async (
    item: UnifiedPartnerBooking,
    action: "check-in" | "check-out" | "no-show",
  ) => {
    const raw = item.hotelBooking;
    if (!raw) return;
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      await hotelApi(`/bookings/${raw.id}/${action}`, "POST", {
        expectedVersion: raw.version,
      });

      const nextStatus: NormalizedBookingStatus =
        action === "check-in" ? "COMPLETED" : action === "check-out" ? "COMPLETED" : "CANCELLED";
      const nextLabel =
        action === "check-in"
          ? "Đang lưu trú (Đã check-in)"
          : action === "check-out"
          ? "Đã hoàn tất (Đã check-out)"
          : "Khách vắng mặt (No-show)";

      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: action.toUpperCase(),
                normalizedStatus: nextStatus,
                statusLabel: nextLabel,
              }
            : b,
        ),
      );

      setActionSuccess(`Đã cập nhật trạng thái ${nextLabel} cho ${item.bookingCode}.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể cập nhật trạng thái đơn phòng."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Rental Confirm
  const handleConfirmRental = async (item: UnifiedPartnerBooking) => {
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      await confirmRentalBooking(item.businessId, item.id);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: "CONFIRMED",
                normalizedStatus: "CONFIRMED",
                statusLabel: "Đã xác nhận (Chờ bàn giao)",
              }
            : b,
        ),
      );
      setActionSuccess(`Đã xác nhận đơn thuê ${item.bookingCode} thành công!`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể xác nhận đơn thuê."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Rental Handover
  const handleHandoverRental = async (item: UnifiedPartnerBooking) => {
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      await handoverRentalBooking(item.businessId, item.id);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: "IN_USE",
                normalizedStatus: "CONFIRMED",
                statusLabel: "Đang sử dụng xe/thiết bị",
              }
            : b,
        ),
      );
      setActionSuccess(`Đã cập nhật bàn giao xe/thiết bị cho ${item.bookingCode}.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể cập nhật bàn giao."));
    } finally {
      setBusyId(null);
    }
  };

  // Action: Rental Return
  const handleReturnRental = async (item: UnifiedPartnerBooking) => {
    try {
      setBusyId(item.id);
      setError(null);
      setActionSuccess(null);

      await returnRentalBooking(item.businessId, item.id);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === item.id
            ? {
                ...b,
                rawStatus: "RETURNED",
                normalizedStatus: "COMPLETED",
                statusLabel: "Đã hoàn tất trả đồ",
              }
            : b,
        ),
      );
      setActionSuccess(`Đã hoàn tất nhận lại xe/thiết bị ${item.bookingCode}.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể cập nhật trả đồ."));
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Quick preset reasons for reject
  const presetRejectReasons = [
    "Hết bàn/hết phòng vào khung giờ này",
    "Cơ sở có tiệc sự kiện trọn gói",
    "Không thể liên lạc được với khách để chốt giờ",
    "Đóng cửa bảo trì đột xuất",
  ];

  // Filtering Logic
  const filteredBookings = React.useMemo(() => {
    return bookings.filter((b) => {
      // Business filter
      if (selectedBusinessId !== "ALL" && b.businessId !== selectedBusinessId) {
        return false;
      }
      // Service type filter
      if (selectedServiceType !== "ALL" && b.sourceType !== selectedServiceType) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "ALL" && b.normalizedStatus !== selectedStatus) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = b.bookingCode.toLowerCase().includes(q);
        const matchName = b.customerName.toLowerCase().includes(q);
        const matchPhone = b.customerPhone ? b.customerPhone.includes(q) : false;
        const matchBiz = b.businessName.toLowerCase().includes(q);
        const matchService = b.serviceTitle.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPhone && !matchBiz && !matchService) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, selectedBusinessId, selectedServiceType, selectedStatus, searchQuery]);

  // Metric counts
  const totalCount = bookings.length;
  const pendingCount = bookings.filter((b) => b.normalizedStatus === "PENDING").length;
  const confirmedCount = bookings.filter((b) => b.normalizedStatus === "CONFIRMED").length;
  const expiredCount = bookings.filter((b) => b.normalizedStatus === "EXPIRED").length;
  const completedCount = bookings.filter((b) => b.normalizedStatus === "COMPLETED").length;
  const cancelledCount = bookings.filter(
    (b) => b.normalizedStatus === "CANCELLED" || b.normalizedStatus === "REJECTED",
  ).length;

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBookings = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, safePage]);

  const formatSchedule = (item: UnifiedPartnerBooking) => {
    try {
      if (item.sourceType === "RESTAURANT") {
        const date = new Date(item.startDateTime);
        const timeStr = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const dateStr = date.toLocaleDateString("vi-VN", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        return `${timeStr} · ${dateStr}`;
      } else if (item.sourceType === "HOTEL") {
        return `Nhận: ${item.startDateTime} → Trả: ${item.endDateTime || "—"}`;
      } else if (item.sourceType === "RENTAL") {
        const pDate = new Date(item.startDateTime).toLocaleDateString("vi-VN");
        const rDate = item.endDateTime ? new Date(item.endDateTime).toLocaleDateString("vi-VN") : "";
        return `Nhận xe: ${pDate} → Trả: ${rDate || "—"}`;
      } else {
        const timePrefix = item.timeSlot ? `${item.timeSlot} · ` : "";
        return `${timePrefix}${item.startDateTime}${item.endDateTime ? ` → ${item.endDateTime}` : ""}`;
      }
    } catch {
      return item.startDateTime;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Tổng lượt đặt</span>
            <CalendarDays className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{totalCount}</p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {pendingCount > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                )}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Chờ xác nhận
            </span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1.5">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium">Đã chốt & Giữ chỗ</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1.5">
            {confirmedCount}
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-xs font-medium">Hoàn tất / Đã đón</span>
            <Users className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1.5">
            {completedCount}
          </p>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Business Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">Cơ sở:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant={selectedBusinessId === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedBusinessId("ALL");
                  setCurrentPage(1);
                }}
                className="h-8 text-xs font-medium"
              >
                Tất cả ({businesses.length})
              </Button>
              {businesses.map((biz) => {
                const isSelected = selectedBusinessId === biz.id;
                return (
                  <Button
                    key={biz.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedBusinessId(biz.id);
                      setCurrentPage(1);
                    }}
                    className="h-8 text-xs font-medium gap-1.5"
                  >
                    {biz.kind === "RESTAURANT" ? (
                      <Utensils className="h-3 w-3" />
                    ) : biz.kind === "HOTEL" ? (
                      <Hotel className="h-3 w-3" />
                    ) : biz.kind === "RENTAL_SERVICE" ? (
                      <Car className="h-3 w-3 text-teal-500" />
                    ) : (
                      <Compass className="h-3 w-3" />
                    )}
                    <span className="truncate max-w-[140px]">{biz.displayName}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              size="sm"
              onClick={() => setDirectBookingOpen(true)}
              className="h-8 text-xs gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo đơn đặt trực tiếp</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadAllBookings}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* Secondary Filter Row: Service Types & Status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-border/50">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: `Tất cả (${totalCount})` },
              { id: "PENDING", label: `Chờ xác nhận (${pendingCount})`, highlight: pendingCount > 0 },
              { id: "CONFIRMED", label: `Đã xác nhận (${confirmedCount})` },
              { id: "EXPIRED", label: `Hết hạn (${expiredCount})` },
              { id: "COMPLETED", label: `Hoàn tất (${completedCount})` },
              { id: "CANCELLED", label: `Đã hủy / Từ chối (${cancelledCount})` },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={selectedStatus === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectedStatus(tab.id);
                  setCurrentPage(1);
                }}
                className={`h-7 text-xs font-medium shrink-0 ${
                  tab.highlight && selectedStatus !== tab.id
                    ? "text-amber-700 bg-amber-500/10 hover:bg-amber-500/20"
                    : ""
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên khách, SĐT, mã đơn..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-8 text-xs bg-muted/30"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Content List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/40 border border-border" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40 space-y-2">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-1" />
          <h3 className="text-base font-semibold text-foreground">Không có lượt đặt nào trong mục này</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {searchQuery || selectedBusinessId !== "ALL" || selectedStatus !== "ALL"
              ? "Hãy thử điều chỉnh lại bộ lọc tìm kiếm hoặc chọn hiển thị tất cả cơ sở."
              : "Khi du khách đặt bàn hoặc đặt phòng trực tuyến, toàn bộ đơn đặt sẽ hiển thị tại đây để bạn xử lý ngay lập tức."}
          </p>
          {(searchQuery || selectedBusinessId !== "ALL" || selectedStatus !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedBusinessId("ALL");
                setSelectedServiceType("ALL");
                setSelectedStatus("ALL");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="mt-2 text-xs h-8"
            >
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3.5">
          {paginatedBookings.map((item) => {
            const isPending = item.normalizedStatus === "PENDING";
            const isConfirmed = item.normalizedStatus === "CONFIRMED";
            const isCompleted = item.normalizedStatus === "COMPLETED";
            const isCancelled = item.normalizedStatus === "CANCELLED" || item.normalizedStatus === "REJECTED";
            const isExpired = item.normalizedStatus === "EXPIRED";

            return (
              <Card
                key={`${item.sourceType}-${item.id}`}
                className="overflow-hidden border-border/80 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  {/* Top Bar: Service tag, Business name, Booking code & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-micro font-semibold gap-1 ${
                          item.sourceType === "RESTAURANT"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : item.sourceType === "HOTEL"
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                            : item.sourceType === "RENTAL"
                            ? "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400"
                            : "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400"
                        }`}
                      >
                        {item.sourceType === "RESTAURANT" ? (
                          <>
                            <Utensils className="h-3 w-3" /> Quán ăn / Nhà hàng
                          </>
                        ) : item.sourceType === "HOTEL" ? (
                          <>
                            <Hotel className="h-3 w-3" /> Khách sạn / Lưu trú
                          </>
                        ) : item.sourceType === "RENTAL" ? (
                          <>
                            <Car className="h-3 w-3" /> Dịch vụ cho thuê
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-3 w-3" /> Phiếu đặt qua Chat
                          </>
                        )}
                      </Badge>

                      <span className="text-xs font-semibold text-foreground">
                        {item.businessName}
                      </span>

                      <button
                        onClick={() => handleCopyCode(item.bookingCode)}
                        className="inline-flex items-center gap-1 font-mono text-micro text-muted-foreground hover:text-foreground bg-muted/40 px-2 py-0.5 rounded transition-colors"
                        title="Sao chép mã đơn"
                      >
                        <span>{item.bookingCode}</span>
                        <Copy className="h-3 w-3" />
                        {copiedCode === item.bookingCode && (
                          <span className="text-emerald-600 text-micro">Đã sao chép!</span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-micro font-semibold uppercase ${
                          isPending
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : isConfirmed
                            ? "border-emerald-600/30 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                            : isCompleted
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : isExpired
                            ? "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {item.statusLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Main Grid: Customer info, Time & Service details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Col 1: Customer Contact */}
                    <div className="space-y-1.5">
                      <span className="text-micro font-medium text-muted-foreground block">
                        Thông tin khách hàng
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {item.customerName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {item.customerPhone ? (
                          <a
                            href={`tel:${item.customerPhone}`}
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline bg-primary/10 px-2 py-0.5 rounded-full"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{item.customerPhone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Chưa có SĐT
                          </span>
                        )}
                        {item.customerEmail && (
                          <span className="text-xs text-muted-foreground block truncate">
                            {item.customerEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 2: Schedule & Party Size */}
                    <div className="space-y-1.5">
                      <span className="text-micro font-medium text-muted-foreground block">
                        Lịch trình & Số lượng
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{formatSchedule(item)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {item.adultsCount} người lớn
                          {item.childrenCount > 0 ? `, ${item.childrenCount} trẻ em` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-foreground font-medium">
                        {item.serviceTitle}
                      </div>
                    </div>

                    {/* Col 3: Price & Notes */}
                    <div className="space-y-1.5">
                      <span className="text-micro font-medium text-muted-foreground block">
                        Chi phí & Ghi chú
                      </span>
                      <div className="text-sm font-bold text-foreground">
                        {item.isFreeOrPayAtVenue ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Miễn phí đặt bàn (Thanh toán tại quán)
                          </span>
                        ) : (
                          <span>
                            {new Intl.NumberFormat("vi-VN").format(item.totalPrice)}{" "}
                            {item.currency}
                          </span>
                        )}
                      </div>
                      {item.specialNotes && (
                        <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground border border-border/40 line-clamp-2">
                          <span className="font-semibold text-foreground">Ghi chú:</span>{" "}
                          {item.specialNotes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      {/* Direct Chat Button */}
                      {(item.customerId || item.threadId) && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5"
                        >
                          <Link
                            href={
                              item.threadId
                                ? `/chat?t=${item.threadId}`
                                : `/chat?userId=${item.customerId}`
                            }
                          >
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            Nhắn tin với khách
                          </Link>
                        </Button>
                      )}

                      {/* Direct Call Button */}
                      {item.customerPhone && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <a href={`tel:${item.customerPhone}`}>
                            <Phone className="mr-1.5 h-3.5 w-3.5" />
                            Gọi điện
                          </a>
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {isExpired && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border/40">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Yêu cầu đã quá thời gian hẹn</span>
                        </div>
                      )}

                      {/* Restaurant Reservation Decisions */}
                      {item.sourceType === "RESTAURANT" && isPending && (
                        <>
                          <Button
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => handleConfirmRestaurant(item)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs"
                          >
                            {busyId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Xác nhận giữ bàn
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            onClick={() => handleOpenReject(item)}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </Button>
                        </>
                      )}

                      {/* Hotel Booking Actions */}
                      {item.sourceType === "HOTEL" && (
                        <>
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => handleConfirmHotel(item)}
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Xác nhận đặt phòng
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => handleOpenReject(item)}
                                className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                              >
                                <X className="h-3.5 w-3.5" />
                                Từ chối
                              </Button>
                            </>
                          )}

                          {isConfirmed && (
                            <>
                              <Button
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => handleHotelOperationalAction(item, "check-in")}
                                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-2xs"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Nhận phòng (Check-in)
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => handleHotelOperationalAction(item, "no-show")}
                                className="h-8 text-xs text-muted-foreground gap-1"
                              >
                                Khách vắng mặt (No-show)
                              </Button>
                            </>
                          )}

                          {item.rawStatus === "CHECKED_IN" && (
                            <Button
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => handleHotelOperationalAction(item, "check-out")}
                              className="h-8 text-xs font-semibold gap-1.5"
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              Trả phòng (Check-out)
                            </Button>
                          )}
                        </>
                      )}

                      {/* Rental Booking Actions */}
                      {item.sourceType === "RENTAL" && (
                        <>
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => handleConfirmRental(item)}
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Xác nhận đơn thuê
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => handleOpenReject(item)}
                                className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                              >
                                <X className="h-3.5 w-3.5" />
                                Từ chối
                              </Button>
                            </>
                          )}

                          {item.rawStatus === "CONFIRMED" && (
                            <Button
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => handleHandoverRental(item)}
                              className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 shadow-2xs"
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Car className="h-3.5 w-3.5" />
                              )}
                              Bàn giao xe / thiết bị
                            </Button>
                          )}

                          {item.rawStatus === "IN_USE" && (
                            <Button
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => handleReturnRental(item)}
                              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-2xs"
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Khách đã hoàn tất trả xe/đồ
                            </Button>
                          )}
                        </>
                      )}

                      {/* Chat Offer details link */}
                      {item.sourceType === "CHAT_OFFER" && item.threadId && (
                        <Button asChild size="sm" className="h-8 text-xs font-semibold">
                          <Link href={`/chat?t=${item.threadId}`}>
                            Xem chi tiết trong Chat
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-4 px-1">
          <span className="text-xs text-muted-foreground">
            Trang {safePage} / {totalPages} ({filteredBookings.length} lượt đặt)
          </span>
          <div className="flex items-center gap-1.5 self-center sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-8 text-xs font-medium"
            >
              &larr; Trước
            </Button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (totalPages > 6 && Math.abs(pNum - safePage) > 2 && pNum !== 1 && pNum !== totalPages) {
                if (Math.abs(pNum - safePage) === 3) {
                  return <span key={pNum} className="text-xs text-muted-foreground px-1">...</span>;
                }
                return null;
              }
              return (
                <Button
                  key={pNum}
                  variant={safePage === pNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pNum)}
                  className="h-8 w-8 text-xs font-medium p-0"
                >
                  {pNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-8 text-xs font-medium"
            >
              Sau &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Từ chối lượt đặt {targetBooking?.bookingCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Vui lòng cho biết lý do từ chối để hệ thống gửi thông báo lịch sự tới khách hàng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <span className="text-micro font-medium text-muted-foreground block mb-1.5">
                Gợi ý lý do nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {presetRejectReasons.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="text-micro px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              rows={3}
              placeholder="Nhập lý do chi tiết..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              className="h-8 text-xs"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSubmit}
              disabled={busyId === targetBooking?.id}
              className="h-8 text-xs font-medium"
            >
              {busyId === targetBooking?.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateDirectBookingModal
        open={directBookingOpen}
        onOpenChange={setDirectBookingOpen}
        businesses={businesses}
        initialBusinessId={selectedBusinessId !== "ALL" ? selectedBusinessId : undefined}
        onSuccess={loadAllBookings}
      />
    </div>
  );
}

