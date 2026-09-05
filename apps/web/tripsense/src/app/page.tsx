"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingHeader, LandingFooter } from "@/components/layout/landing";
import {
  LandingHero,
  LandingHowItWorks,
  LandingInspiration,
  LandingDestinationsSection,
  LandingAiChatDemo,
  LandingFeaturesGrid,
  LandingTestimonials,
} from "@/features/explore";
import { AuthModal, useAuth } from "@/features/auth";
import { AuthLoadingScreen } from "@/components/shared";

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, status, isLoading } = useAuth();

  const signinParam = searchParams.get("signin");
  const signupParam = searchParams.get("signup");

  const [authModalDismissed, setAuthModalDismissed] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<"signin" | "signup" | null>(null);

  const isParamPrompt = (signupParam === "true" || signinParam === "true") && !authModalDismissed;
  const authModalOpen = isParamPrompt || activeMode !== null;
  const authMode = activeMode ?? (signupParam === "true" ? "signup" : "signin");

  // Authenticated User Route Rule:
  // If user is authenticated, immediately redirect to Home (/explore)
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/explore");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleOpenAuthModal = (mode: "signin" | "signup") => {
    setAuthModalDismissed(false);
    setActiveMode(mode);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setAuthModalDismissed(true);
      setActiveMode(null);
    }
  };

  // While checking auth status OR if already authenticated (redirect in flight):
  // Render AuthLoadingScreen. DO NOT render Landing Page!
  if (isLoading || status === "checking" || isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <LandingHeader onOpenAuthModal={handleOpenAuthModal} />
      <main className="flex-1">
        <LandingHero onOpenAuthModal={handleOpenAuthModal} />
        <LandingHowItWorks />
        <LandingInspiration />
        <LandingDestinationsSection />
        <LandingAiChatDemo />
        <LandingFeaturesGrid />
        <LandingTestimonials />
      </main>
      <LandingFooter />

      <AuthModal
        open={authModalOpen}
        onOpenChange={handleOpenChange}
        initialMode={authMode}
      />
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<AuthLoadingScreen />}>
      <LandingContent />
    </React.Suspense>
  );
}
