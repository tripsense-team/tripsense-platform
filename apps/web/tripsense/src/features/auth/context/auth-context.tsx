"use client";

import * as React from "react";
import { authApi } from "../services/auth-api";
import { useAuthStore } from "../store/use-auth-store";
import { hasLoggedInCookie, setLoggedInCookie, clearLoggedInCookie } from "../utils/cookie-indicator";
import {
  User,
  UserRole,
  UserStatus,
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  ResendCodeRequest,
  ApiResponse,
  LoginResponse,
} from "../types";

export interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<ApiResponse<LoginResponse>>;
  register: (payload: RegisterRequest) => Promise<ApiResponse<User>>;
  verifyEmail: (payload: VerifyEmailRequest) => Promise<ApiResponse<void>>;
  resendCode: (payload: ResendCodeRequest) => Promise<ApiResponse<void>>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function parseJwtClaims(token: string): { sub?: string; email?: string; role?: string; exp?: number } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, status, setAuth, clearAuth } = useAuthStore();

  // Bootstrap Auth ONLY when status === "initializing" (e.g. F5 page reload)
  React.useEffect(() => {
    let isMounted = true;

    // Do NOT bootstrap if already authenticated or unauthenticated
    if (status !== "initializing") {
      return;
    }

    // Guard: If browser has NO logged_in cookie indicator (guest / logged out user),
    // immediately transition status = "unauthenticated" WITHOUT SENDING ANY REFRESH REQUEST!
    if (!hasLoggedInCookie()) {
      clearAuth();
      return;
    }

    async function bootstrapAuthSession() {
      try {
        const response = await authApi.refreshToken();
        if (isMounted && response.success && response.data?.accessToken) {
          setLoggedInCookie();
          const claims = parseJwtClaims(response.data.accessToken);
          if (claims) {
            const roleStr = claims.role || UserRole.USER;
            const parsedRole = roleStr === "ROLE_ADMIN" ? UserRole.ADMIN : UserRole.USER;

            const recoveredUser: User = {
              id: claims.sub || "user-id",
              email: claims.email || "user@tripsense.app",
              role: parsedRole,
              status: UserStatus.ACTIVE,
            };

            setAuth(recoveredUser, response.data.accessToken);
          }
        } else if (isMounted) {
          clearLoggedInCookie();
          clearAuth();
        }
      } catch {
        if (isMounted) {
          clearLoggedInCookie();
          clearAuth();
        }
      }
    }

    bootstrapAuthSession();

    return () => {
      isMounted = false;
    };
  }, [status, setAuth, clearAuth]);

  const login = async (payload: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await authApi.login(payload);
    if (response.success && response.data) {
      setLoggedInCookie();
      setAuth(response.data.user, response.data.accessToken);
    }
    return response;
  };

  const register = async (payload: RegisterRequest): Promise<ApiResponse<User>> => {
    return authApi.register(payload);
  };

  const verifyEmail = async (payload: VerifyEmailRequest): Promise<ApiResponse<void>> => {
    return authApi.verifyEmail(payload);
  };

  const resendCode = async (payload: ResendCodeRequest): Promise<ApiResponse<void>> => {
    return authApi.resendCode(payload);
  };

  const logout = async (): Promise<void> => {
    clearLoggedInCookie();
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  };

  const logoutAll = async (): Promise<void> => {
    clearLoggedInCookie();
    try {
      await authApi.logoutAll();
    } finally {
      clearAuth();
    }
  };

  const value: AuthContextType = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "initializing",
    login,
    register,
    verifyEmail,
    resendCode,
    logout,
    logoutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
