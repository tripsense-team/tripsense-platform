"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { useAuthStore } from "../store/use-auth-store";
import { UserRole } from "../types";
import { AuthLoadingScreen } from "@/components/shared";

import { normalizeRole, isUserAdmin } from "../utils/role-helpers";

export interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export function AuthGuard({
  children,
  allowedRoles,
  requireAuth = false,
}: AuthGuardProps) {
  const { user, status, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const isChecking =
    isLoading || status === "checking" || status === "initializing";

  const isAuthorized = React.useMemo(() => {
    if (isChecking) return false;
    if (requireAuth && !isAuthenticated) return false;
    if (allowedRoles && allowedRoles.length > 0) {
      if (!isAuthenticated || !user) return false;
      const userRole = normalizeRole(user.role);
      const hasDirectRole = allowedRoles.includes(userRole);
      const hasRolesArray =
        Array.isArray(user.roles) &&
        user.roles.some((r) => allowedRoles.includes(normalizeRole(r)));
      return hasDirectRole || hasRolesArray;
    }
    return true;
  }, [isChecking, requireAuth, isAuthenticated, allowedRoles, user]);

  React.useEffect(() => {
    if (!isChecking) return;
    const timer = setTimeout(() => {
      const currentStatus = useAuthStore.getState().status;
      if (currentStatus === "checking" || currentStatus === "initializing") {
        useAuthStore.getState().clearAuth();
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [isChecking]);

  React.useEffect(() => {
    if (isChecking) return;

    if (requireAuth && !isAuthenticated) {
      router.replace("/?signin=true");
      return;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!isAuthenticated) {
        router.replace("/?signin=true");
        return;
      }

      if (user && !isAuthorized) {
        if (isUserAdmin(user)) {
          router.replace("/admin");
        } else {
          router.replace("/explore");
        }
      }
    }
  }, [isChecking, isAuthenticated, isAuthorized, user, allowedRoles, requireAuth, router]);

  // Zero Flicker: while checking OR if unauthorized/unauthenticated, render loading screen
  if (isChecking || !isAuthorized) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  return <>{children}</>;
}
