import * as React from "react";
import { UserLayout } from "@/components/layout";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserLayout>{children}</UserLayout>;
}
