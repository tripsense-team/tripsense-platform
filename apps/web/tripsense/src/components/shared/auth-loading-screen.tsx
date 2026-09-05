import * as React from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthLoadingScreenProps {
  message?: string;
  className?: string;
}

export function AuthLoadingScreen({
  message = "Đang tải...",
  className,
}: AuthLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-200 select-none",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated Brand Compass Icon */}
        <div className="relative flex items-center justify-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs ring-1 ring-primary/20 animate-pulse">
            <Compass className="h-8 w-8 animate-spin duration-1000 text-primary" aria-hidden="true" />
          </div>
          {/* Subtle Outer Ping Ring */}
          <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping pointer-events-none opacity-25" />
        </div>

        {/* Loading Text */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium tracking-tight text-foreground/80">
            {message}
          </p>
          <span className="sr-only">Hệ thống đang xác thực phiên đăng nhập</span>
        </div>
      </div>
    </div>
  );
}
