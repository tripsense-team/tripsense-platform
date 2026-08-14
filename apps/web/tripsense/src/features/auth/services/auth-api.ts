import { apiClient } from "@/services/api-client";
import { useAuthStore } from "../store/use-auth-store";
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
    const response = await apiClient<ApiResponse<LoginResponse>>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    });

    if (response.success && response.data?.accessToken && response.data?.user) {
      useAuthStore.getState().setAuth(response.data.user, response.data.accessToken);
    }

    return response;
  },

  async refreshToken(): Promise<ApiResponse<RefreshResponse>> {
    const response = await apiClient<ApiResponse<RefreshResponse>>("/api/auth/refresh", {
      method: "POST",
      skipAuth: true,
    });

    if (response.success && response.data?.accessToken) {
      useAuthStore.getState().setAccessToken(response.data.accessToken);
    }

    return response;
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
      // 2. Clear frontend state after dispatching request
      useAuthStore.getState().clearAuth();
    }
  },

  async logoutAll(): Promise<ApiResponse<void>> {
    try {
      // 1. Dispatch logout-all request with Authorization header & HttpOnly Cookie to revoke all sessions
      const response = await apiClient<ApiResponse<void>>("/api/auth/logout-all", {
        method: "POST",
      });
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
