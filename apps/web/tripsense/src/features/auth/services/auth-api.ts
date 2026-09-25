import { apiClient } from "@/services/api-client";
import { useAuthStore } from "../store/use-auth-store";
import { profileService } from "@/features/profile";
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResendCodeRequest,
  VerifyEmailRequest,
  User,
  RefreshResponse,
} from "../types";

// In-flight Single-Flight promise to deduplicate parallel refreshToken calls
let inFlightRefreshPromise: Promise<ApiResponse<RefreshResponse>> | null = null;

export const authApi = {
  async register(payload: RegisterRequest): Promise<ApiResponse<User>> {
    return apiClient<ApiResponse<User>>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  async verifyEmail(payload: VerifyEmailRequest): Promise<ApiResponse<void>> {
    return apiClient<ApiResponse<void>>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  async resendCode(payload: ResendCodeRequest): Promise<ApiResponse<void>> {
    return apiClient<ApiResponse<void>>("/api/auth/resend-code", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  async login(payload: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient<ApiResponse<LoginResponse>>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      },
    );

    if (response.success && response.data?.accessToken && response.data?.user) {
      useAuthStore
        .getState()
        .setAuth(response.data.user, response.data.accessToken);

      // Fetch profile to populate avatar and name in global store
      profileService
        .getUserProfile(response.data.user.id)
        .then((profile) => {
          if (profile) {
            useAuthStore.getState().updateUserProfile({
              avatar: profile.avatarUrl || undefined,
              name: profile.displayName || undefined,
            });
          }
        })
        .catch(() => {
          // Ignore background fetch error
        });
    }

    return response;
  },

  async loginGoogle(idToken: string): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient<ApiResponse<LoginResponse>>(
      "/api/auth/google",
      {
        method: "POST",
        body: JSON.stringify({ idToken }),
        skipAuth: true,
      },
    );

    if (response.success && response.data?.accessToken && response.data?.user) {
      useAuthStore
        .getState()
        .setAuth(response.data.user, response.data.accessToken);

      // Fetch profile to populate avatar and name in global store
      profileService
        .getUserProfile(response.data.user.id)
        .then((profile) => {
          if (profile) {
            useAuthStore.getState().updateUserProfile({
              avatar: profile.avatarUrl || undefined,
              name: profile.displayName || undefined,
            });
          }
        })
        .catch(() => {
          // Ignore background fetch error
        });
    }

    return response;
  },

  async refreshToken(): Promise<ApiResponse<RefreshResponse>> {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    inFlightRefreshPromise = (async () => {
      try {
        const response = await apiClient<ApiResponse<RefreshResponse>>(
          "/api/auth/refresh",
          {
            method: "POST",
            skipAuth: true,
          },
        );

        if (response.success && response.data?.accessToken) {
          useAuthStore.getState().setAccessToken(response.data.accessToken);
        }

        return response;
      } finally {
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  },

  async logout(): Promise<ApiResponse<void>> {
    try {
      // 1. Dispatch logout request to revoke current session & clear HttpOnly Cookie
      const response = await apiClient<ApiResponse<void>>("/api/auth/logout", {
        method: "POST",
        skipAuth: true,
      });
      return response;
    } catch {
      // Ignore network errors on logout since frontend state is already cleared in finally
      return {
        success: true,
        message: "Logged out",
        data: undefined as unknown as void,
        timestamp: new Date().toISOString(),
      };
    } finally {
      // Unregister FCM device token if present
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("tripsense_fcm_token");
        if (storedToken) {
          try {
            await apiClient("/api/social/chat/devices/fcm-token", {
              method: "DELETE",
              body: JSON.stringify({ fcmToken: storedToken }),
            });
            localStorage.removeItem("tripsense_fcm_token");
          } catch {
            // Ignore non-blocking error
          }
        }
      }
      // 2. Clear frontend state after dispatching request
      useAuthStore.getState().clearAuth();
    }
  },

  async logoutAll(): Promise<ApiResponse<void>> {
    try {
      // 1. Dispatch logout-all request with Authorization header & HttpOnly Cookie to revoke all sessions
      const response = await apiClient<ApiResponse<void>>(
        "/api/auth/logout-all",
        {
          method: "POST",
        },
      );
      return response;
    } catch {
      // Ignore network errors on logout-all since frontend state is already cleared in finally
      return {
        success: true,
        message: "Logged out of all devices",
        data: undefined as unknown as void,
        timestamp: new Date().toISOString(),
      };
    } finally {
      // 2. Clear frontend state after dispatching request
      useAuthStore.getState().clearAuth();
    }
  },
};
