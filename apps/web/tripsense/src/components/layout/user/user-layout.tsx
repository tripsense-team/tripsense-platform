"use client";

import * as React from "react";
import { UserHeader } from "./user-header";
import { UserSidebar } from "./user-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { AuthModal } from "@/features/auth";

export interface UserLayoutProps {
  children: React.ReactNode;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  onSignInClick?: () => void;
}

export function UserLayout({ children, user, onSignInClick }: UserLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [authModalOpen, setAuthModalOpen] = React.useState(false);

  const handleOpenSignIn = () => {
    if (onSignInClick) {
      onSignInClick();
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <UserHeader user={user} onSignInClick={handleOpenSignIn} />

      {/* Body Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <UserSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom Mobile Navigation */}
      <MobileNavigation />

      {/* Auth Modal Trigger */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        initialMode="signin"
      />
    </div>
  );
}
