import { create } from "zustand";
import { User, UserRole, UserStatus, type AuthStatus } from "../types";
import {
  setLoggedInCookie,
  clearLoggedInCookie,
} from "../utils/cookie-indicator";

const CACHED_USER_KEY = "tripsense_cached_user";

function loadCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCachedUser(user: User | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

function parseJwtClaims(
  token: string,
): { sub?: string; email?: string; role?: string; exp?: number } | null {
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

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  authVersion: number;

  // Reactive properties for component selectors
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingCompleted: boolean;

  // Essential Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  clearAuth: () => void;
  updateUserAvatar: (avatarUrl: string | undefined) => void;
  updateUserProfile: (data: { avatar?: string; name?: string }) => void;
  setOnboardingCompleted: (completed: boolean) => void;
}

const initialCachedUser = loadCachedUser();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: initialCachedUser,
  status: "checking",
  authVersion: 0,
  isAuthenticated: !!initialCachedUser,
  isLoading: true,
  onboardingCompleted: initialCachedUser?.role === UserRole.ADMIN,

  setAuth: (user, accessToken) => {
    setLoggedInCookie();
    const cached = loadCachedUser();
    const mergedUser: User = {
      ...user,
      avatar: user.avatar || (cached?.id === user.id ? cached.avatar : undefined),
      name: user.name || (cached?.id === user.id ? cached.name : undefined),
    };
    saveCachedUser(mergedUser);
    set({
      user: mergedUser,
      accessToken,
      status: "authenticated",
      isAuthenticated: true,
      isLoading: false,
      onboardingCompleted: mergedUser.role === UserRole.ADMIN,
    });
  },

  setAccessToken: (accessToken) =>
    set((state) => {
      if (!accessToken) {
        clearLoggedInCookie();
        saveCachedUser(null);
        return {
          accessToken: null,
          user: null,
          status: "unauthenticated",
          isAuthenticated: false,
          isLoading: false,
          onboardingCompleted: false,
        };
      }

      setLoggedInCookie();
      const claims = parseJwtClaims(accessToken);
      const cached = loadCachedUser();
      const user =
        state.user ||
        cached ||
        (claims
          ? {
              id: claims.sub || "user-id",
              email: claims.email || "user@tripsense.app",
              role:
                claims.role === "ROLE_ADMIN" ? UserRole.ADMIN : UserRole.USER,
              status: UserStatus.ACTIVE,
            }
          : null);

      if (user) {
        saveCachedUser(user);
      }

      return {
        accessToken,
        user,
        status: "authenticated",
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted:
          user?.role === UserRole.ADMIN || state.onboardingCompleted,
      };
    }),

  clearAuth: () => {
    clearLoggedInCookie();
    saveCachedUser(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("tripsense_fcm_token");
        document.title = document.title.replace(/^\(\d+\)\s*/, "");
      } catch {
        // Safe fallback
      }
    }
    set((state) => ({
      accessToken: null,
      user: null,
      status: "unauthenticated",
      authVersion: state.authVersion + 1,
      isAuthenticated: false,
      isLoading: false,
      onboardingCompleted: false,
    }));
  },

  updateUserAvatar: (avatarUrl) => {
    set((state) => {
      const updated = state.user ? { ...state.user, avatar: avatarUrl } : null;
      saveCachedUser(updated);
      return { user: updated };
    });
  },

  updateUserProfile: (data) => {
    set((state) => {
      if (!state.user) return state;
      const updatedUser: User = {
        ...state.user,
        ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
      };
      saveCachedUser(updatedUser);
      return { user: updatedUser };
    });
  },

  setOnboardingCompleted: (completed) => {
    set({ onboardingCompleted: completed });
  },
}));
