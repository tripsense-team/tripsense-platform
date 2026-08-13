"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MapPin, Heart, FolderBookmark, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Trips", href: "/trips", icon: MapPin },
  { name: "Planner", href: "/ai-planner", icon: Sparkles },
  { name: "Saved", href: "/saved", icon: Heart },
  { name: "Collections", href: "/collections", icon: FolderBookmark },
];

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
