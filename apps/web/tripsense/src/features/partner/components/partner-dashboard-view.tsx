"use client";

import * as React from "react";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import { Plus, Store, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartnerBusinessCard } from "./partner-business-card";
import { PartnerEnrollmentBanner } from "./partner-enrollment-banner";
import { PartnerWizardModal } from "./partner-wizard-modal";
import { getPartnerContext } from "../services/partner-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type { BusinessDetailDto } from "../types";

export function PartnerDashboardView() {
  const user = useAuthStore((state) => state.user);
  const isPartner = isUserPartner(user);

  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

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

  const activeCount = businesses.filter(
    (b) => b.approvalValidity === "VALID" && b.operationState === "ACTIVE",
  ).length;
  const pendingCount = businesses.filter(
    (b) => b.approvalValidity === "NONE",
  ).length;
  const reverificationCount = businesses.filter((b) => b.requiresReverification).length;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Trung tâm Đối tác TripSense
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý hồ sơ cơ sở kinh doanh, danh mục bài quảng bá và trao đổi tư vấn với du khách.
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

      {/* If Not Enrolled Yet, Display Partner Enrollment Hero */}
      {!isPartner && (
        <PartnerEnrollmentBanner onEnrolled={loadData} />
      )}

      {/* Metrics Row */}
      {isPartner && businesses.length > 0 && (
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
              <span className="text-xs font-medium text-muted-foreground">Đang hoạt động</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{activeCount}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Chờ xét duyệt</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{pendingCount}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Khóa duyệt lại</span>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{reverificationCount}</p>
          </div>
        </div>
      )}

      {/* Business List */}
      {isPartner && (
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
                />
              ))}
            </div>
          )}
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
