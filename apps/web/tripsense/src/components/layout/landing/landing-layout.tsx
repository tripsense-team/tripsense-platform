import * as React from "react";
import { LandingHeader } from "./landing-header";
import { LandingFooter } from "./landing-footer";

export interface LandingLayoutProps {
  children: React.ReactNode;
  onOpenAuthModal?: (mode: "signin" | "signup") => void;
}

export function LandingLayout({ children, onOpenAuthModal }: LandingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <LandingHeader onOpenAuthModal={onOpenAuthModal} />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
