"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarCheck,
  Building2,
  Utensils,
  Compass,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserBookingsView } from "@/features/hotels";
import { CustomerReservationsView } from "@/features/partner";
import { useTranslation } from "@/i18n";

interface UnifiedReservationsHubProps {
  defaultTab?: "hotels" | "restaurants";
}

export function UnifiedReservationsHub({
  defaultTab = "hotels",
}: UnifiedReservationsHubProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "restaurants" || tabParam === "hotels"
      ? tabParam
      : defaultTab;

  const [activeTab, setActiveTab] = React.useState<string>(initialTab);

  React.useEffect(() => {
    if (tabParam === "restaurants" || tabParam === "hotels") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    router.replace(`/reservations?tab=${val}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Page Header */}
      <div className="border-b border-border/70 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-xs shrink-0">
                <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  {t("nav.myReservations", { defaultValue: "Đơn đặt của tôi" })}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {t("reservations.hubSubtitle", {
                    defaultValue: "Quản lý tập trung các đặt phòng khách sạn và yêu cầu đặt bàn ăn uống của bạn.",
                  })}
                </p>
              </div>
            </div>

            {/* Quick Explore Link */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => router.push(activeTab === "hotels" ? "/hotels" : "/explore")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>
                  {activeTab === "hotels"
                    ? t("trip.hotels.staysDiscovery", { defaultValue: "Tìm thêm phòng" })
                    : t("places.exploreThisArea", { defaultValue: "Khám phá quán ăn" })}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="pt-2">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-11 p-1 bg-muted/70 border border-border/60 rounded-xl">
                <TabsTrigger
                  value="hotels"
                  className="gap-2 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{t("reservations.tabHotels", { defaultValue: "Khách sạn & Lưu trú" })}</span>
                </TabsTrigger>

                <TabsTrigger
                  value="restaurants"
                  className="gap-2 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  <Utensils className="h-4 w-4" />
                  <span>{t("reservations.tabRestaurants", { defaultValue: "Nhà hàng & Quán ăn" })}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 py-6">
        {activeTab === "hotels" ? (
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <UserBookingsView hideHeader onExploreStays={() => router.push("/hotels")} />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <CustomerReservationsView hideHeader />
          </div>
        )}
      </div>
    </div>
  );
}
