import { apiClient } from "@/services/api-client";

export type SubscriptionOrderStatus = "PAID" | "PENDING" | "CANCELLED" | "FAILED";
export type PartnerBusinessKind = "HOTEL" | "RESTAURANT" | "TOUR_GUIDE";

export interface AdminSubscriptionOrderItem {
  id: string;
  orderCode: number;
  businessId: string;
  businessName: string;
  businessKind: PartnerBusinessKind | string;
  planId: string;
  planName: string;
  durationDays: number;
  amount: number;
  paymentStatus: SubscriptionOrderStatus | string;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminSubscriptionOrderPage {
  items: AdminSubscriptionOrderItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SubscriptionOrderQueryParams {
  status?: string;
  businessKind?: string;
  page?: number;
  size?: number;
}

export async function fetchAdminSubscriptionOrders(
  params: SubscriptionOrderQueryParams = {},
): Promise<AdminSubscriptionOrderPage> {
  const search = new URLSearchParams();
  if (params.status && params.status !== "ALL") {
    search.set("status", params.status);
  }
  if (params.businessKind && params.businessKind !== "ALL") {
    search.set("businessKind", params.businessKind);
  }
  search.set("page", String(params.page ?? 0));
  search.set("size", String(params.size ?? 50));

  const response = await apiClient<{ data?: AdminSubscriptionOrderPage } | AdminSubscriptionOrderPage>(
    `/api/admin/finance/subscription-orders?${search.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (response && typeof response === "object" && "data" in response && response.data !== undefined) {
    return response.data;
  }
  return response as AdminSubscriptionOrderPage;
}

