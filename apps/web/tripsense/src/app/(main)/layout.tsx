"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserLayout } from "@/components/layout";
import { useAuth, useAuthStore } from "@/features/auth";
import { onboardingApi } from "@/features/onboarding/services/onboarding-api";
import { AuthLoadingScreen } from "@/components/shared";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, status, isLoading, user } = useAuth();
  const { onboardingCompleted, setOnboardingCompleted } = useAuthStore();

  const isChecking =
    isLoading || status === "checking" || status === "initializing";

  // 1. Redirect unauthenticated users
  React.useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      const returnUrl =
        pathname && pathname !== "/" ? encodeURIComponent(pathname) : "";
      const target = returnUrl
        ? `/?signin=true&returnUrl=${returnUrl}`
        : "/?signin=true";
      router.replace(target);
    }
  }, [isChecking, isAuthenticated, pathname, router]);

  // 2. Authoritative Onboarding Gate Check (Runs ONCE per session until completed)
  React.useEffect(() => {
    if (
      isChecking ||
      !isAuthenticated ||
      !user ||
      user.role === "ROLE_ADMIN" ||
      onboardingCompleted
    ) {
      return;
    }

    if (pathname === "/onboarding") {
      return;
    }

    let active = true;

    onboardingApi
      .get()
      .then((profile) => {
        if (!active) return;
        if (profile.status === "COMPLETED") {
          setOnboardingCompleted(true);
        } else {
          router.replace("/onboarding");
        }
      })
      .catch(async (err: unknown) => {
        if (!active) return;

        const errorStatus =
          err && typeof err === "object" && "status" in err
            ? (err as { status: number }).status
            : undefined;

        // 404 means user has not started onboarding yet -> redirect to onboarding
        if (errorStatus === 404) {
          router.replace("/onboarding");
          return;
        }

        // On network or 5xx server errors, check the gate from user-service as a fallback
        try {
          const gate = await onboardingApi.getGate();
          if (!active) return;
          if (gate && !gate.required) {
            // User not requiring onboarding -> allow access without lockout
            setOnboardingCompleted(true);
            return;
          }
        } catch {
          // If gate is also unreachable, fail-closed per security spec
        }

        if (active) {
          router.replace("/onboarding");
        }
      });

    return () => {
      active = false;
    };
  }, [
    isChecking,
    isAuthenticated,
    user?.id,
    user?.role,
    onboardingCompleted,
    pathname,
    router,
    setOnboardingCompleted,
  ]);

  // If navigating / rendering /onboarding, bypass UserLayout directly
  if (pathname === "/onboarding") {
    return <>{children}</>;
  }

  // While checking auth status OR actively verifying onboarding gate for incomplete user:
  // Render AuthLoadingScreen. DO NOT render protected UserLayout or children!
  if (
    isChecking ||
    !isAuthenticated ||
    (user?.role !== "ROLE_ADMIN" && !onboardingCompleted)
  ) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  return <UserLayout>{children}</UserLayout>;
}

