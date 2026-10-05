"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useAuth, isUserAdmin } from "@/features/auth";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  href?: string;
}

export function Logo({ className, iconOnly = false, href }: LogoProps) {
  const { isAuthenticated, user } = useAuth();

  const targetHref =
    href ??
    (isAuthenticated
      ? isUserAdmin(user)
        ? "/admin"
        : "/explore"
      : "/");

  return (
    <Link
      href={targetHref}
      className={cn(
        "inline-flex items-center gap-2 text-section-title text-foreground hover:opacity-95 transition-opacity",
        className,
      )}
    >
      <Compass className="h-6 w-6 text-primary shrink-0" />
      {!iconOnly && <span>{siteConfig.name}</span>}
    </Link>
  );
}
