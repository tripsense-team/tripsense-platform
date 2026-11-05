"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import {
  Plus,
  Store,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartnerBusinessCard } from "./partner-business-card";
import { PartnerEnrollmentBanner } from "./partner-enrollment-banner";
import { PartnerWizardModal } from "./partner-wizard-modal";
import { PartnerBookingsHub } from "./partner-bookings-hub";
import { getPartnerContext } from "../services/partner-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type { BusinessDetailDto } from "../types";

export interface PartnerDashboardViewProps {
  defaultTab?: "businesses" | "bookings";
}

export function PartnerDashboardView({ defaultTab = "businesses" }: PartnerDashboardViewProps = {}) {
  const user = useAuthStore((state) => state.user);
  const isPartner = isUserPartner(user);
  const searchParams = useSearchParams();

  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  // Top Tabs: "businesses" | "bookings"
  const [activeTab, setActiveTab] = React.useState<"businesses" | "bookings">(
    searchParams.get("tab") === "bookings" ? "bookings" : defaultTab,
  );
  const [selectedBusinessIdForBookings, setSelectedBusinessIdForBookings] = React.useState<string | undefined>(
    searchParams.get("businessId") || undefined,
  );

  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "bookings" || tabParam === "businesses") {
      setActiveTab(tabParam);
    }
    const bizParam = searchParams.get("businessId");
    if (bizParam) {
      setSelectedBusinessIdForBookings(bizParam);
    }
  }, [searchParams]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPartnerContext();
      setBusinesses(res.businesses || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu đối tác");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isPartner) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isPartner, loadData]);

  const handleBusinessUpdated = (updated: BusinessDetailDto) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
    );
  };

  const handleBusinessCreated = () => {
    loadData();
  };

  const handleSelectBookingsForBusiness = (businessId: string) => {
    setSelectedBusinessIdForBookings(businessId);
    setActiveTab("bookings");
  };

  const activeCount = businesses.filter(
    (b) => b.approvalValidity === "VALID" && b.operationState === "ACTIVE",
  ).length;
  const unsubscribedCount = businesses.filter(
    (b) => b.approvalValidity === "NONE" && b.operationState !== "SUSPENDED",
  ).length;
  const suspendedCount = businesses.filter(
    (b) => b.operationState === "SUSPENDED",
  ).length;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Quản lý Cơ sở & Dịch vụ Đối tác
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi đơn đặt bàn, đặt phòng, thực đơn và trạng thái đón tiếp khách trên TripSense.
          </p>
        </div>

        {isPartner && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="h-9 font-medium shadow-sm"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Thêm cơ sở / dịch vụ
            </Button>
          </div>
        )}
      </div>

      {/* Top Segmented Navigation Tabs */}
      {isPartner && (
        <div className="flex items-center gap-2 border-b border-border/80 pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("businesses")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              activeTab === "businesses"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="h-4 w-4" />
            <span>Cơ sở & Dịch vụ</span>
            <Badge variant="secondary" className="ml-1 text-micro">
              {businesses.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedBusinessIdForBookings(undefined);
              setActiveTab("bookings");
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              activeTab === "bookings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Quản lý Đơn đặt & Booking</span>
          </button>
        </div>
      )}

      {/* If Not Enrolled Yet, Display Partner Enrollment Hero */}
      {!isPartner && <PartnerEnrollmentBanner onEnrolled={loadData} />}

      {/* VIEW 1: BOOKINGS HUB */}
      {isPartner && activeTab === "bookings" && (
        <PartnerBookingsHub
          businesses={businesses}
          initialBusinessId={selectedBusinessIdForBookings}
          onRefreshBusinesses={loadData}
        />
      )}

      {/* VIEW 2: BUSINESSES & SERVICES */}
      {isPartner && activeTab === "businesses" && (
        <div className="space-y-8">
          {/* Metrics Row */}
          {businesses.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Tổng cơ sở</span>
                  <Store className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{businesses.length}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Đã xác thực</span>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{activeCount}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Chưa kích hoạt gói</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{unsubscribedCount}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Tạm đình chỉ</span>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{suspendedCount}</p>
              </div>
            </div>
          )}

          {/* Business List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Danh sách cơ sở & dịch vụ của bạn
              </h2>
              <span className="text-xs text-muted-foreground">
                {businesses.length} cơ sở đã đăng ký
              </span>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-56 animate-pulse rounded-xl border border-border/60 bg-muted/40"
                  />
                ))}
              </div>
            ) : businesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <Store className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Chưa có cơ sở hoặc hồ sơ nào
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Bắt đầu bằng cách tạo hồ sơ khách sạn, quán ăn hoặc hồ sơ hướng dẫn viên du lịch đầu tiên của bạn.
                </p>
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Tạo cơ sở mới
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {businesses.map((business) => (
                  <PartnerBusinessCard
                    key={business.id}
                    business={business}
                    onUpdated={handleBusinessUpdated}
                    onProfileUpdateSubmitted={loadData}
                    onSelectBookings={handleSelectBookingsForBusiness}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      <PartnerWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={handleBusinessCreated}
      />
    </div>
  );
}
