"use client";

import * as React from "react";
import { authApi } from "../services/auth-api";
import { useAuthStore, loadCachedUser } from "../store/use-auth-store";
import { profileService } from "@/features/profile";
import { normalizeRole } from "../utils/role-helpers";
import {
  hasLoggedInCookie,
  setLoggedInCookie,
  clearLoggedInCookie,
} from "../utils/cookie-indicator";
import { revokeFcmTokenOnLogout } from "@/features/chat/hooks/use-fcm-notifications";
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
  loginWithGoogle: (idToken: string) => Promise<ApiResponse<LoginResponse>>;
  register: (payload: RegisterRequest) => Promise<ApiResponse<User>>;
  verifyEmail: (payload: VerifyEmailRequest) => Promise<ApiResponse<void>>;
  resendCode: (payload: ResendCodeRequest) => Promise<ApiResponse<void>>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function parseJwtClaims(
  token: string,
): { sub?: string; email?: string; role?: string; roles?: string[]; exp?: number } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, status, setAuth, clearAuth } = useAuthStore();
  const hasBootstrappedRef = React.useRef(false);

  // Bootstrap Auth ONLY when status === "checking" || status === "initializing" (e.g. F5 page reload)
  React.useEffect(() => {
    // Do NOT bootstrap if already authenticated or unauthenticated
    if (status !== "checking" && status !== "initializing") {
      return;
    }

    // Guard: Prevent double-execution from React StrictMode during dev
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    // Check candidate session: either non-HttpOnly logged_in cookie OR cached user in localStorage
    const hasCandidateSession = hasLoggedInCookie() || !!loadCachedUser();
    if (!hasCandidateSession) {
      clearAuth();
      return;
    }

    async function bootstrapAuthSession() {
      try {
        const response = await authApi.refreshToken();
        if (response.success && response.data?.accessToken) {
          setLoggedInCookie();
          const claims = parseJwtClaims(response.data.accessToken);
          const cached = loadCachedUser();
          const roleStr = claims?.role || cached?.role || UserRole.USER;
          const parsedRole = normalizeRole(roleStr);

          const recoveredUser: User = {
            id: claims?.sub || cached?.id || "user-id",
            email: claims?.email || cached?.email || "user@tripsense.app",
            role: parsedRole,
            roles: claims?.roles ?? [parsedRole],
            status: UserStatus.ACTIVE,
            avatar: cached?.avatar,
            name: cached?.name,
          };

          setAuth(recoveredUser, response.data.accessToken);

          // Background fetch to restore avatar/name from user-service
          // We ignore isMounted here because setAuth triggers a re-render that resets it,
          // and we still want to populate the global store with the profile data.
          profileService
            .getUserProfile(recoveredUser.id)
            .then((profile) => {
              if (profile) {
                useAuthStore.getState().updateUserProfile({
                  avatar: profile.avatarUrl || undefined,
                  name: profile.displayName || undefined,
                });
                if (profile.onboardingRequired === false) {
                  useAuthStore.getState().setOnboardingCompleted(true);
                }
              }
            })
            .catch(() => {
              // Ignore background fetch error
            });
        } else {
          clearLoggedInCookie();
          clearAuth();
        }
      } catch {
        clearLoggedInCookie();
        clearAuth();
      }
    }

    bootstrapAuthSession();
  }, [status, setAuth, clearAuth]);

  const login = async (
    payload: LoginRequest,
  ): Promise<ApiResponse<LoginResponse>> => {
    const response = await authApi.login(payload);
    if (response.success && response.data) {
      setLoggedInCookie();
      setAuth(response.data.user, response.data.accessToken);
    }
    return response;
  };

  const loginWithGoogle = async (
    idToken: string,
  ): Promise<ApiResponse<LoginResponse>> => {
    const response = await authApi.loginGoogle(idToken);
    if (response.success && response.data) {
      setLoggedInCookie();
      setAuth(response.data.user, response.data.accessToken);
    }
    return response;
  };

  const register = async (
    payload: RegisterRequest,
  ): Promise<ApiResponse<User>> => {
    return authApi.register(payload);
  };

  const verifyEmail = async (
    payload: VerifyEmailRequest,
  ): Promise<ApiResponse<void>> => {
    return authApi.verifyEmail(payload);
  };

  const resendCode = async (
    payload: ResendCodeRequest,
  ): Promise<ApiResponse<void>> => {
    return authApi.resendCode(payload);
  };

  const logout = async (): Promise<void> => {
    clearLoggedInCookie();
    try {
      await revokeFcmTokenOnLogout();
    } catch {
      // Non-blocking cleanup
    }
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  };

  const logoutAll = async (): Promise<void> => {
    clearLoggedInCookie();
    try {
      await revokeFcmTokenOnLogout();
    } catch {
      // Non-blocking cleanup
    }
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
    isLoading: status === "checking" || status === "initializing",
    login,
    loginWithGoogle,
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
