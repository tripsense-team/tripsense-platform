import { create } from "zustand";
import { User, UserRole, UserStatus, type AuthStatus } from "../types";
import { setLoggedInCookie, clearLoggedInCookie } from "../utils/cookie-indicator";

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

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  authVersion: number;

  // Reactive properties for component selectors
  isAuthenticated: boolean;
  isLoading: boolean;

  // Essential Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "initializing",
  authVersion: 0,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken) => {
    setLoggedInCookie();
    set({
      user,
      accessToken,
      status: "authenticated",
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setAccessToken: (accessToken) =>
    set((state) => {
      if (!accessToken) {
        clearLoggedInCookie();
        return {
          accessToken: null,
          user: null,
          status: "unauthenticated",
          isAuthenticated: false,
          isLoading: false,
        };
      }

      setLoggedInCookie();
      const claims = parseJwtClaims(accessToken);
      const user = state.user || (claims ? {
        id: claims.sub || "user-id",
        email: claims.email || "user@tripsense.app",
        role: claims.role === "ROLE_ADMIN" ? UserRole.ADMIN : UserRole.USER,
        status: UserStatus.ACTIVE,
      } : null);

      return {
        accessToken,
        user,
        status: "authenticated",
        isAuthenticated: true,
        isLoading: false,
      };
    }),

  clearAuth: () => {
    clearLoggedInCookie();
    set((state) => ({
      accessToken: null,
      user: null,
      status: "unauthenticated",
      authVersion: state.authVersion + 1,
      isAuthenticated: false,
      isLoading: false,
    }));
  },
}));
