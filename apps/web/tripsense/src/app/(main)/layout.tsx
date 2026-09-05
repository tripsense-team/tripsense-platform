"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";
import { AuthLoadingScreen } from "@/components/shared";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, status, isLoading } = useAuth();

  const isChecking = isLoading || status === "checking" || status === "initializing";

  React.useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      const returnUrl = pathname && pathname !== "/" ? encodeURIComponent(pathname) : "";
      const target = returnUrl ? `/?signin=true&returnUrl=${returnUrl}` : "/?signin=true";
      router.replace(target);
    }
  }, [isChecking, isAuthenticated, pathname, router]);

  // While checking auth status OR redirecting unauthenticated user:
  // Render AuthLoadingScreen. DO NOT render protected UserLayout or children!
  if (isChecking || !isAuthenticated) {
    return <AuthLoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  return <UserLayout>{children}</UserLayout>;
}
