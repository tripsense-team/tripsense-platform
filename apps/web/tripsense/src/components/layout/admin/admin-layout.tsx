"use client";

import * as React from "react";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

export interface AdminLayoutProps {
  children: React.ReactNode;
  adminUser?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function AdminLayout({ children, adminUser }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="h-screen h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Admin Top Header */}
      <AdminHeader adminUser={adminUser} />

      {/* Admin Main Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Admin Left Sidebar */}
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Admin Content Area */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );

}
