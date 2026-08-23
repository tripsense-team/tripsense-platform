import Link from "next/link";
import { cn } from "@/lib/utils";

interface TripTabsProps {
  active: "trips" | "calendar" | "receipts";
}

export function TripTabs({ active }: TripTabsProps) {
  const tabs = [
    { href: "/trips", label: "Trips", value: "trips" },
    { href: "/calendar", label: "Calendar", value: "calendar" },
    { href: "/receipts", label: "Receipts", value: "receipts" },
  ] as const;

  return (
    <nav className="mt-10 flex items-center gap-8">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            "border-b-2 pb-3 text-base font-bold leading-none tracking-normal transition-colors",
            active === tab.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
