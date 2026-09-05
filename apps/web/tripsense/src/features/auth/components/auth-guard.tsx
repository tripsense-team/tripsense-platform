"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { UserRole } from "../types";
import { AuthLoadingScreen } from "@/components/shared";

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

  const isChecking = isLoading || status === "checking" || status === "initializing";

  const isAuthorized = React.useMemo(() => {
    if (isChecking) return false;
    if (requireAuth && !isAuthenticated) return false;
    if (allowedRoles && allowedRoles.length > 0) {
      if (!isAuthenticated) return false;
      if (!user || !allowedRoles.includes(user.role)) return false;
    }
    return true;
  }, [isChecking, requireAuth, isAuthenticated, allowedRoles, user]);

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

      if (user && !allowedRoles.includes(user.role)) {
        if (user.role === UserRole.USER) {
          router.replace("/explore");
        } else {
          router.replace("/");
        }
      }
    }
  }, [isChecking, isAuthenticated, user, allowedRoles, requireAuth, router]);

  // Zero Flicker: while checking OR if unauthorized/unauthenticated, render loading screen
  if (isChecking || !isAuthorized) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  return <>{children}</>;
}
