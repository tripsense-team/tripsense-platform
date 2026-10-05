import * as React from "react";
import { AdminLayout } from "@/components/layout";
import { AuthGuard, UserRole } from "@/features/auth";

export default function AdminPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={[UserRole.ADMIN]}>
      <AdminLayout>{children}</AdminLayout>
    </AuthGuard>
  );
}
