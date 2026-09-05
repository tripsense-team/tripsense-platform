"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/features/auth";
import { AuthLoadingScreen } from "@/components/shared";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, status, isLoading } = useAuth();

  const isChecking = isLoading || status === "checking" || status === "initializing";

  // Authenticated User Route Rule:
  // If user is already authenticated, redirect to Home (/explore)
  React.useEffect(() => {
    if (!isChecking && isAuthenticated) {
      router.replace("/explore");
    }
  }, [isChecking, isAuthenticated, router]);

  // While checking auth status OR if authenticated (redirecting):
  // Render AuthLoadingScreen. DO NOT render auth forms!
  if (isChecking || isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <div className="mb-8 flex items-center gap-2 font-bold text-xl">
        <Compass className="h-7 w-7 text-primary" />
        <Link href="/" className="hover:opacity-90 transition-opacity">
          {siteConfig.name}
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
