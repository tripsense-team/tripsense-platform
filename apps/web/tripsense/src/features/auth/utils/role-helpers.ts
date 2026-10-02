import { UserRole, type User } from "../types";

/**
 * Normalizes incoming backend role strings (e.g. "ADMIN", "ROLE_ADMIN", "USER", "ROLE_USER")
 * to the standardized frontend UserRole enum values.
 */
export function normalizeRole(role?: string | null): UserRole {
  if (!role) return UserRole.USER;
  const upper = role.trim().toUpperCase();
  if (upper === "ADMIN" || upper === "ROLE_ADMIN") {
    return UserRole.ADMIN;
  }
  if (upper === "MODERATOR" || upper === "ROLE_MODERATOR") {
    return UserRole.MODERATOR;
  }
  if (upper === "PARTNER" || upper === "ROLE_PARTNER") {
    return UserRole.PARTNER;
  }
  return UserRole.USER;
}

/**
 * Checks whether a user possesses the ADMIN role across either the primary role field or roles array.
 */
export function isUserAdmin(
  user?: (Partial<User> & { roles?: string[]; role?: string | UserRole }) | null,
): boolean {
  if (!user) return false;
  if (user.role) {
    const normalized = normalizeRole(user.role);
    if (normalized === UserRole.ADMIN) return true;
  }
  if (Array.isArray(user.roles)) {
    return user.roles.some((r) => {
      const upper = r?.toUpperCase();
      return upper === "ADMIN" || upper === "ROLE_ADMIN";
    });
  }
  return false;
}

/**
 * Checks whether a user possesses the PARTNER role or has partner enrollment.
 */
export function isUserPartner(
  user?: (Partial<User> & { roles?: string[]; role?: string | UserRole; partnerEnrolled?: boolean }) | null,
): boolean {
  if (!user) return false;
  if (user.partnerEnrolled) return true;
  if (user.role) {
    const normalized = normalizeRole(user.role);
    if (normalized === UserRole.PARTNER) return true;
  }
  if (Array.isArray(user.roles)) {
    return user.roles.some((r) => {
      const upper = r?.toUpperCase();
      return upper === "PARTNER" || upper === "ROLE_PARTNER";
    });
  }
  return false;
}
