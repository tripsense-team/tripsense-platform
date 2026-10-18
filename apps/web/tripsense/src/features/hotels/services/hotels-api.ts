import { apiClient } from "@/services/api-client";

export async function hotelApi<T>(path: string, method = "GET", body?: unknown, key?: string): Promise<T> {
  const response = await apiClient<any>(`/api/hotels${path}`, {
    method, cache: "no-store", headers: key ? { "Idempotency-Key": key } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response && typeof response === "object" && "data" in response && response.data !== undefined) {
    return response.data as T;
  }
  return response as T;
}
