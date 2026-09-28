"use client";

import { AuthGuard, UserRole } from "@/features/auth";
import { SettingsView } from "@/features/settings";

export default function AdminSettingsPage() {
  return (
    <AuthGuard allowedRoles={[UserRole.ADMIN]}>
      <SettingsView />
    </AuthGuard>
  );
}

