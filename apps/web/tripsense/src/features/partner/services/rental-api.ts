import { apiClient } from "@/services/api-client";
import type {
  CreateRentalBookingRequest,
  CreateRentalItemRequest,
  RentalBookingOrderDto,
  RentalCategory,
  RentalItemDto,
  UpdateRentalItemRequest,
} from "../types";

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method || "GET";
  const response = await apiClient<ApiResponseWrapper<T>>(path, {
    ...options,
    method,
  });
  return response.data;
}

// ==========================================
// Partner Endpoints
// ==========================================

export async function getPartnerRentalItems(businessId: string): Promise<RentalItemDto[]> {
  return request<RentalItemDto[]>(`/api/partners/businesses/${businessId}/rental-items`);
}

export async function createPartnerRentalItem(
  businessId: string,
  req: CreateRentalItemRequest,
): Promise<RentalItemDto> {
  return request<RentalItemDto>(`/api/partners/businesses/${businessId}/rental-items`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function updatePartnerRentalItem(
  businessId: string,
  itemId: string,
  req: UpdateRentalItemRequest,
): Promise<RentalItemDto> {
  return request<RentalItemDto>(`/api/partners/businesses/${businessId}/rental-items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function deletePartnerRentalItem(
  businessId: string,
  itemId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/api/partners/businesses/${businessId}/rental-items/${itemId}`,
    {
      method: "DELETE",
    },
  );
}

export async function getPartnerRentalBookings(businessId: string): Promise<RentalBookingOrderDto[]> {
  const res = await request<RentalBookingOrderDto[] | { content: RentalBookingOrderDto[] }>(
    `/api/partners/businesses/${businessId}/rental-bookings`
  );
  if (Array.isArray(res)) return res;
  return res?.content || [];
}

export async function confirmRentalBooking(
  businessId: string,
  bookingId: string,
): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>(
    `/api/partners/businesses/${businessId}/rental-bookings/${bookingId}/confirm`,
    {
      method: "POST",
    },
  );
}

export async function handoverRentalBooking(
  businessId: string,
  bookingId: string,
): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>(
    `/api/partners/businesses/${businessId}/rental-bookings/${bookingId}/handover`,
    {
      method: "POST",
    },
  );
}

export async function returnRentalBooking(
  businessId: string,
  bookingId: string,
): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>(
    `/api/partners/businesses/${businessId}/rental-bookings/${bookingId}/return`,
    {
      method: "POST",
    },
  );
}

export async function rejectRentalBooking(
  businessId: string,
  bookingId: string,
  reason?: string,
): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>(
    `/api/partners/businesses/${businessId}/rental-bookings/${bookingId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

// ==========================================
// Customer / Public Endpoints
// ==========================================

export async function getPublicRentalItems(params?: {
  businessId?: string;
  category?: RentalCategory;
  query?: string;
}): Promise<RentalItemDto[]> {
  const queryParams = new URLSearchParams();
  if (params?.businessId) queryParams.set("businessId", params.businessId);
  if (params?.category) queryParams.set("category", params.category);
  if (params?.query) queryParams.set("query", params.query);

  const qs = queryParams.toString();
  return request<RentalItemDto[]>(`/api/rental-items${qs ? `?${qs}` : ""}`);
}

export async function getRentalItemDetail(itemId: string): Promise<RentalItemDto> {
  return request<RentalItemDto>(`/api/rental-items/${itemId}`);
}

export async function checkRentalAvailability(
  itemId: string,
  pickupAt: string,
  returnAt: string,
  quantity = 1,
): Promise<{ available: boolean; allocated: number; total: number; availableCount: number }> {
  const params = new URLSearchParams({
    pickupAt,
    returnAt,
    quantity: String(quantity),
  });
  return request<{ available: boolean; allocated: number; total: number; availableCount: number }>(
    `/api/rental-items/${itemId}/availability?${params.toString()}`,
  );
}

export async function createRentalBooking(
  req: CreateRentalBookingRequest,
): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>("/api/rental-bookings", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getMyRentalBookings(): Promise<RentalBookingOrderDto[]> {
  return request<RentalBookingOrderDto[]>("/api/rental-bookings/me");
}

export async function cancelMyRentalBooking(bookingId: string): Promise<RentalBookingOrderDto> {
  return request<RentalBookingOrderDto>(`/api/rental-bookings/${bookingId}/cancel`, {
    method: "POST",
  });
}

