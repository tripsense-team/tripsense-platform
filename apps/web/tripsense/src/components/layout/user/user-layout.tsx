"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { UserHeader } from "./user-header";
import { UserSidebar } from "./user-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { AuthModal } from "@/features/auth";
import { useFcmNotifications, ChatNotificationToast } from "@/features/chat";
import { cn } from "@/lib/utils";

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
  useFcmNotifications();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const isChatWorkspace = pathname === "/chat" || pathname.startsWith("/chat/");

  const handleOpenSignIn = () => {
    if (onSignInClick) {
      onSignInClick();
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="h-screen h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <UserHeader user={user} onSignInClick={handleOpenSignIn} />

      {/* Body Container */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar */}
        <UserSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area */}
        <main
          className={cn(
            "flex-1 min-h-0",
            isChatWorkspace
              ? "flex flex-col overflow-hidden pb-16 md:pb-0"
              : "overflow-y-auto pb-16 md:pb-6",
          )}
        >
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

      {/* Floating In-App Chat Notification Toast */}
      <ChatNotificationToast />
    </div>
  );
}
