"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";
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
  const [onboardingCheckedFor, setOnboardingCheckedFor] = React.useState<
    string | null
  >(null);

  const isChecking =
    isLoading || status === "checking" || status === "initializing";

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

  React.useEffect(() => {
    if (isChecking || !isAuthenticated || !user || user.role === "ROLE_ADMIN")
      return;
    if (pathname === "/onboarding") {
      setOnboardingCheckedFor(user.id);
      return;
    }

    let active = true;
    setOnboardingCheckedFor(null);
    onboardingApi
      .get()
      .then((profile) => {
        if (!active) return;
        if (profile.status !== "COMPLETED") router.replace("/onboarding");
        else setOnboardingCheckedFor(user.id);
      })
      .catch(() => {
        // Missing or unavailable Context lifecycle is NOT_STARTED, never permission to enter.
        if (active) router.replace("/onboarding");
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, isChecking, pathname, router, user]);

  // While checking auth status OR redirecting unauthenticated user:
  // Render AuthLoadingScreen. DO NOT render protected UserLayout or children!
  if (
    isChecking ||
    !isAuthenticated ||
    (user?.role !== "ROLE_ADMIN" &&
      pathname !== "/onboarding" &&
      onboardingCheckedFor !== user?.id)
  ) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  if (pathname === "/onboarding") {
    return <>{children}</>;
  }

  return <UserLayout>{children}</UserLayout>;
}

