"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserBookingsView } from "@/features/hotels";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Compass, Briefcase } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function HotelBookingsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {t("trip.hotels.headerTitle", { defaultValue: "Khách sạn & Lưu trú" })}
              </h1>
              <p className="text-micro text-muted-foreground hidden sm:block">
                {t("trip.hotels.myBookingsSubtitle", { defaultValue: "Quản lý các đặt phòng của bạn" })}
              </p>
            </div>
          </div>

          <nav aria-label="Traveler tabs" className="flex items-center rounded-full bg-muted/80 p-1 border border-border/80">
            <Link
              href="/hotels"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.staysDiscovery", { defaultValue: "Khám phá phòng" })}</span>
            </Link>

            <span className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold bg-background text-foreground shadow-xs">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.myBookings", { defaultValue: "Đơn đặt của tôi" })}</span>
            </span>
          </nav>

          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Link href="/hotels">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("trip.hotels.backToStays", { defaultValue: "Tìm phòng" })}</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full p-4 sm:p-6 lg:p-8">
        <UserBookingsView onExploreStays={() => router.push("/hotels")} />
      </main>
    </div>
  );
}
