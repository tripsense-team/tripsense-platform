"use client";

import { AuthGuard } from "@/features/auth";
import { UserSettingsView } from "@/features/settings";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <UserSettingsView />
    </AuthGuard>
  );
}
