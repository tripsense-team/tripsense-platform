"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface TripTabsProps {
  active: "trips" | "calendar" | "receipts";
}

export function TripTabs({ active }: TripTabsProps) {
  const { t } = useTranslation();

  const tabs = [
    { href: "/trips", label: t("trip.yourTrips", { defaultValue: "Trips" }), value: "trips" },
    { href: "/calendar", label: t("trip.calendar", { defaultValue: "Calendar" }), value: "calendar" },
    { href: "/reservations", label: t("reservations.title", { defaultValue: "Reservations" }), value: "receipts" },
  ] as const;

  return (
    <nav className="mt-10 flex items-center gap-8">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            "border-b-2 pb-3 text-base font-bold leading-none tracking-normal transition-colors",
            active === tab.value
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
