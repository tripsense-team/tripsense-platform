import { useAuthStore } from "@/features/auth/store/use-auth-store";

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "";

// Auth endpoints that MUST NOT trigger 401 auto-refresh interceptor
const AUTH_ENDPOINTS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/logout-all",
  "/api/auth/refresh",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-code",
];

function isAuthEndpoint(endpoint: string): boolean {
  return AUTH_ENDPOINTS.some((path) => endpoint.includes(path));
}

// Single-Flight Refresh Promise to prevent multiple parallel /refresh requests
let refreshPromise: Promise<string> | null = null;

async function performSilentRefresh(): Promise<string> {
  const currentStore = useAuthStore.getState();
  const startingVersion = currentStore.authVersion;

  try {
    const refreshResponse = await fetch(`${API_GATEWAY_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!refreshResponse.ok) {
      throw new Error(`Refresh token expired with status ${refreshResponse.status}`);
    }

    const refreshData = await refreshResponse.json();
    const newToken = refreshData?.data?.accessToken;

    if (!newToken) {
      throw new Error("No access token returned from refresh endpoint");
    }

    // Race Condition Check: If user logged out while refresh was in-flight, DISCARD token!
    const latestStore = useAuthStore.getState();
    if (latestStore.authVersion !== startingVersion || latestStore.status === "unauthenticated") {
      throw new Error("User logged out while refresh was in-flight");
    }

    // Update in-memory RAM token in Zustand store
    useAuthStore.getState().setAccessToken(newToken);
    return newToken;
  } catch (error) {
    // If refresh fails, mark status as unauthenticated to halt further refreshes
    useAuthStore.getState().clearAuth();
    throw error;
  } finally {
    refreshPromise = null;
  }
}

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
  _retry?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { skipAuth = false, _retry = false, headers: customHeaders, ...customOptions } = options;

  const requestUrl = endpoint.startsWith("http")
    ? endpoint
    : `${API_GATEWAY_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  // Get in-memory RAM Access Token from Zustand store
  const { accessToken: currentToken } = useAuthStore.getState();

  if (!skipAuth && currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  const fetchOptions: RequestInit = {
    ...customOptions,
    headers,
    credentials: "include", // Pass HttpOnly refreshToken cookie
  };

  try {
    const response = await fetch(requestUrl, fetchOptions);

    // 401 Handling & Interceptor Guard
    if (response.status === 401) {
      // 1. If this is an auth endpoint, or skipAuth, or already retried once -> DO NOT REFRESH
      if (skipAuth || _retry || isAuthEndpoint(endpoint)) {
        if (_retry) {
          useAuthStore.getState().clearAuth();
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // 2. Always evaluate LATEST fresh status from Zustand store (never use stale local variables!)
      const latestStatus = useAuthStore.getState().status;
      if (latestStatus === "unauthenticated") {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "User is unauthenticated. Request cancelled.");
      }

      // 3. Initiate or await Single-Flight Refresh
      if (!refreshPromise) {
        refreshPromise = performSilentRefresh();
      }

      try {
        const newToken = await refreshPromise;

        // 4. Retry original request ONCE with _retry = true flag
        return await apiClient<T>(endpoint, {
          ...options,
          _retry: true,
          headers: {
            ...customHeaders,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } catch (refreshErr) {
        useAuthStore.getState().clearAuth();
        throw refreshErr;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}
