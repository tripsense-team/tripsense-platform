"use client";

import * as React from "react";
import { AuthProvider } from "@/features/auth";

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
