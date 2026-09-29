import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAuthStore, loadCachedUser } from "../store/use-auth-store";
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

  it("6. tracks onboardingCompleted and automatically sets true for ADMIN role", () => {
    expect(useAuthStore.getState().onboardingCompleted).toBe(false);

    useAuthStore.getState().setOnboardingCompleted(true);
    expect(useAuthStore.getState().onboardingCompleted).toBe(true);

    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().onboardingCompleted).toBe(false);

    // ADMIN user should automatically be marked onboarding completed
    const adminUser = {
      id: "admin-1",
      email: "admin@tripsense.app",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
    useAuthStore.getState().setAuth(adminUser, "admin.jwt.token");
    expect(useAuthStore.getState().onboardingCompleted).toBe(true);
  });

  it("7. resets onboardingCompleted to false when setAccessToken receives null", () => {
    useAuthStore.getState().setOnboardingCompleted(true);
    expect(useAuthStore.getState().onboardingCompleted).toBe(true);

    useAuthStore.getState().setAccessToken(null);
    expect(useAuthStore.getState().onboardingCompleted).toBe(false);
  });

  it("8. includes MODERATOR role in UserRole enum with correct string value", () => {
    expect(UserRole.MODERATOR).toBe("ROLE_MODERATOR");
    expect(UserRole.ADMIN).toBe("ROLE_ADMIN");
    expect(UserRole.USER).toBe("ROLE_USER");
  });

  it("9. preserves cached user in localStorage during setAuth and can be loaded via loadCachedUser", () => {
    const mockUser = {
      id: "user-reload-test",
      email: "reload@tripsense.app",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      name: "Traveler Reload",
    };

    useAuthStore.getState().setAuth(mockUser, "mock.jwt.token");
    const cached = loadCachedUser();
    expect(cached).not.toBeNull();
    expect(cached?.id).toBe("user-reload-test");
    expect(cached?.email).toBe("reload@tripsense.app");

    // Calling clearAuth should wipe cached user
    useAuthStore.getState().clearAuth();
    expect(loadCachedUser()).toBeNull();
  });

  it("10. normalizes backend role strings ('ADMIN' -> UserRole.ADMIN, 'USER' -> UserRole.USER)", async () => {
    const { normalizeRole, isUserAdmin } = await import("../utils/role-helpers");
    expect(normalizeRole("ADMIN")).toBe(UserRole.ADMIN);
    expect(normalizeRole("ROLE_ADMIN")).toBe(UserRole.ADMIN);
    expect(normalizeRole("USER")).toBe(UserRole.USER);
    expect(normalizeRole("ROLE_USER")).toBe(UserRole.USER);
    expect(normalizeRole("MODERATOR")).toBe(UserRole.MODERATOR);
    expect(normalizeRole("PARTNER")).toBe(UserRole.PARTNER);
    expect(normalizeRole(null)).toBe(UserRole.USER);

    expect(isUserAdmin({ role: "ADMIN" as any })).toBe(true);
    expect(isUserAdmin({ role: UserRole.ADMIN })).toBe(true);
    expect(isUserAdmin({ roles: ["ROLE_ADMIN"] })).toBe(true);
    expect(isUserAdmin({ role: "USER" as any })).toBe(false);
  });

  it("11. setAuth normalizes incoming backend 'ADMIN' role and marks onboardingCompleted true", () => {
    const backendAdmin = {
      id: "admin-ea20c072",
      email: "admin@tripsense.app",
      role: "ADMIN" as any,
      roles: ["ROLE_ADMIN", "ROLE_PARTNER"],
      status: UserStatus.ACTIVE,
    };

    useAuthStore.getState().setAuth(backendAdmin, "admin.jwt.token");
    const state = useAuthStore.getState();
    expect(state.user?.role).toBe(UserRole.ADMIN);
    expect(state.onboardingCompleted).toBe(true);
    expect(state.isAuthenticated).toBe(true);
  });
});
