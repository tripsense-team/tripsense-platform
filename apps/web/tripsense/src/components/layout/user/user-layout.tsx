"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { UserHeader } from "./user-header";
import { UserSidebar } from "./user-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { AuthModal } from "@/features/auth";
import { useFcmNotifications, ChatNotificationToast } from "@/features/chat";
import { cn } from "@/lib/utils";
import { prefetchAiChats } from "@/hooks/use-ai-chats";
import { prefetchUserTrips } from "@/features/trip-management/hooks/use-user-trips";
import { SidebarFlyout } from "@/components/chat/sidebar-flyout";
import { useAiDrawerStore, closeAiDrawer } from "@/stores/use-ai-drawer-store";
import {
  isMapWorkspacePath,
  shouldDisableSidebarWidthTransition,
} from "./user-layout.utils";

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
  const isDrawerOpen = useAiDrawerStore((state) => state.isOpen);
  const effectiveCollapsed = isDrawerOpen ? true : sidebarCollapsed;

  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const isChatWorkspace = pathname === "/chat" || pathname.startsWith("/chat/");
  const isMapWorkspace = isMapWorkspacePath(pathname);
  const disableSidebarTransition =
    shouldDisableSidebarWidthTransition(pathname);
  const isAiPlanner = pathname === "/ai-planner" || pathname.startsWith("/ai-planner/");
  const isFullBleedWorkspace =
    isChatWorkspace ||
    isAiPlanner ||
    isMapWorkspace;

  // Prefetch AI chats and trips on AI Planner entry
  React.useEffect(() => {
    if (isAiPlanner) {
      void prefetchAiChats();
      void prefetchUserTrips();
    }
  }, [isAiPlanner]);

  // Notify components (like Mapvina) when effective sidebar width changes
  React.useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tripsense:sidebar-toggle", {
          detail: {
            collapsed: effectiveCollapsed,
            durationMs: disableSidebarTransition ? 0 : 300,
          },
        }),
      );
    }
  }, [disableSidebarTransition, effectiveCollapsed]);

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
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Left Sidebar */}
        <UserSidebar
          collapsed={effectiveCollapsed}
          onToggleCollapse={() => {
            if (isDrawerOpen) {
              closeAiDrawer();
            }
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
          }}
          disableTransition={disableSidebarTransition}
        />

        {/* Main Content Area */}
        <main
          className={cn(
            "flex-1 min-h-0 min-w-0",
            isFullBleedWorkspace
              ? "flex flex-col overflow-hidden pb-16 md:pb-0"
              : "overflow-y-auto pb-16 md:pb-6",
          )}
        >
          {children}
        </main>

        {/* Mindtrip-Style Flyout Sidebar Drawer (Rendered after main to guarantee overlay over all page content) */}
        <React.Suspense fallback={null}>
          <SidebarFlyout />
        </React.Suspense>
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
