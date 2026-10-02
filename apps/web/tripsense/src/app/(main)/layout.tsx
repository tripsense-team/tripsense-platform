"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { UserLayout } from "@/components/layout";
import { useAuth, useAuthStore, isUserAdmin } from "@/features/auth";
import { onboardingApi } from "@/features/onboarding/services/onboarding-api";
import { AuthLoadingScreen } from "@/components/shared";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, status, isLoading, user } = useAuth();
  const { onboardingCompleted, setOnboardingCompleted } = useAuthStore();

  const isChecking =
    isLoading || status === "checking" || status === "initializing";
  const isAdmin = isUserAdmin(user);
  const isInvitationRoute = pathname === "/trips/join";

  // 1. Redirect unauthenticated users
  React.useEffect(() => {
    if (!isInvitationRoute && !isChecking && !isAuthenticated) {
      const query = searchParams.toString();
      const currentUrl = query ? `${pathname}?${query}` : pathname;
      const returnUrl =
        currentUrl && currentUrl !== "/" ? encodeURIComponent(currentUrl) : "";
      const target = returnUrl
        ? `/?signin=true&returnUrl=${returnUrl}`
        : "/?signin=true";
      router.replace(target);
    }
  }, [isInvitationRoute, isChecking, isAuthenticated, pathname, router, searchParams]);

  // Safety watchdog: Prevent infinite hang on "checking" / "initializing" status
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

  // 2. Authoritative Onboarding Gate Check (Runs ONCE per session until completed)
  React.useEffect(() => {
    if (
      isChecking ||
      !isAuthenticated ||
      !user ||
      isAdmin ||
      onboardingCompleted
    ) {
      return;
    }

    if (pathname === "/onboarding") {
      return;
    }

    // Invitation acceptance must remain reachable immediately after a new user
    // verifies their account. The normal onboarding gate resumes after joining.
    if (isInvitationRoute) {
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
          const gateRecord = gate as Record<string, unknown> | undefined;
          const nestedData = gateRecord?.data as Record<string, unknown> | undefined;
          const isRequired =
            typeof nestedData?.required === "boolean"
              ? nestedData.required
              : typeof gateRecord?.required === "boolean"
              ? gateRecord.required
              : undefined;
          if (isRequired === false) {
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
    user,
    isAdmin,
    onboardingCompleted,
    isInvitationRoute,
    pathname,
    router,
    setOnboardingCompleted,
  ]);

  // If navigating / rendering /onboarding, bypass UserLayout directly
  if (pathname === "/onboarding") {
    return <>{children}</>;
  }

  // Invitation links must be reachable before login so a new invitee can
  // register or switch away from an account that does not own the invitation.
  if (isInvitationRoute) {
    return <>{children}</>;
  }

  // While checking auth status OR actively verifying onboarding gate for incomplete user:
  // Render AuthLoadingScreen. DO NOT render protected UserLayout or children!
  if (
    isChecking ||
    !isAuthenticated ||
    (!isInvitationRoute && !isAdmin && !onboardingCompleted)
  ) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  return <UserLayout>{children}</UserLayout>;
}
