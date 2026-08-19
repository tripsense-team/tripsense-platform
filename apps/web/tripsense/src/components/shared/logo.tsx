import Link from "next/link";
import { Compass } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-bold text-lg text-foreground hover:opacity-95 transition-opacity",
        className
      )}
    >
      <Compass className="h-6 w-6 text-primary shrink-0" />
      {!iconOnly && <span>{siteConfig.name}</span>}
    </Link>
  );
}
