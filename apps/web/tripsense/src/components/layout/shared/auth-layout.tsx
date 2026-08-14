import * as React from "react";
import { cn } from "@/lib/utils";

export interface AuthLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AuthLayout({ children, className, ...props }: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center bg-muted/40 p-4 sm:p-6 lg:p-8",
        className
      )}
      {...props}
    >
      <div className="w-full max-w-md space-y-6 bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-xs">
        {children}
      </div>
    </div>
  );
}
