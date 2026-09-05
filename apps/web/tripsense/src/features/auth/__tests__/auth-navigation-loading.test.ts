import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAuthStore } from "../store/use-auth-store";
import { UserRole, UserStatus } from "../types";
import {
  hasLoggedInCookie,
  setLoggedInCookie,
  clearLoggedInCookie,
} from "../utils/cookie-indicator";

describe("Auth Store & Navigation Lifecycle", () => {
  beforeEach(() => {
    // Reset Zustand store state to checking
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: "checking",
      authVersion: 0,
      isAuthenticated: false,
      isLoading: true,
    });
    // Clear cookies in jsdom
    document.cookie = "logged_in=; path=/; max-age=0";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. initializes in 'checking' status with isLoading: true and isAuthenticated: false", () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe("checking");
    expect(state.isLoading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it("2. transitions to 'authenticated' with setAuth and marks isLoading: false", () => {
    const mockUser = {
      id: "user-123",
      email: "traveler@tripsense.app",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    };

    useAuthStore.getState().setAuth(mockUser, "mock.jwt.token");

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user?.email).toBe("traveler@tripsense.app");
    expect(state.accessToken).toBe("mock.jwt.token");
    expect(hasLoggedInCookie()).toBe(true);
  });

  it("3. transitions to 'unauthenticated' with clearAuth and clears indicator cookie", () => {
    // Start authenticated
    const mockUser = {
      id: "user-123",
      email: "traveler@tripsense.app",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    };
    useAuthStore.getState().setAuth(mockUser, "mock.jwt.token");
    expect(hasLoggedInCookie()).toBe(true);

    // Logout / clearAuth
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(hasLoggedInCookie()).toBe(false);
  });

  it("4. clears auth when setAccessToken is called with null", () => {
    setLoggedInCookie();
    useAuthStore.getState().setAccessToken(null);

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(hasLoggedInCookie()).toBe(false);
  });

  it("5. cookie indicator utility accurately detects, sets and clears logged_in flag", () => {
    expect(hasLoggedInCookie()).toBe(false);

    setLoggedInCookie();
    expect(hasLoggedInCookie()).toBe(true);

    clearLoggedInCookie();
    expect(hasLoggedInCookie()).toBe(false);
  });
});
