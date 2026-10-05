import { apiClient } from "@/services/api-client";

export async function hotelApi<T>(path: string, method = "GET", body?: unknown, key?: string): Promise<T> {
  const response = await apiClient<{ success: boolean; data: T }>(`/api/hotels${path}`, {
    method, cache: "no-store", headers: key ? { "Idempotency-Key": key } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.data;
}
