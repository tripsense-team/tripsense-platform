"use client";

import * as React from "react";
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
import { AuthModal } from "@/features/auth";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");

  const handleOpenAuthModal = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

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
        onOpenChange={setAuthModalOpen}
        initialMode={authMode}
      />
    </div>
  );
}
