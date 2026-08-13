"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { UserRole } from "../types";
import { Compass } from "lucide-react";

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

  React.useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !isAuthenticated) {
      router.push("/");
      return;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!isAuthenticated) {
        router.push("/");
        return;
      }

      if (user && !allowedRoles.includes(user.role)) {
        if (user.role === UserRole.USER) {
          router.push("/explore");
        } else {
          router.push("/");
        }
      }
    }
  }, [isLoading, isAuthenticated, status, user, allowedRoles, requireAuth, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary animate-pulse">
            <Compass className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Verifying TripSense session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
