"use client";

import * as React from "react";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Building2,
  Utensils,
  Compass,
  RefreshCw,
  Eye,
  Columns,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminGetApplications,
  adminGetManagementClaims,
  adminReviewApplication,
  adminReviewManagementClaim,
} from "../services/partner-api";
import type {
  AdminReviewDecisionRequest,
  ApplicationDetailDto,
  ManagementClaimDto,
  PartnerCapability,
} from "../types";

export function AdminPartnersView() {
  const [applications, setApplications] = React.useState<ApplicationDetailDto[]>([]);
  const [claims, setClaims] = React.useState<ManagementClaimDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<ApplicationDetailDto | null>(null);
  const [reviewReason, setReviewReason] = React.useState("");
  const [submittingReview, setSubmittingReview] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [apps, clms] = await Promise.all([
        adminGetApplications(),
        adminGetManagementClaims().catch(() => []),
      ]);
      setApplications(apps || []);
      setClaims(clms || []);
      if (apps && apps.length > 0 && !selectedApp) {
        setSelectedApp(apps[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách thẩm định");
    } finally {
      setLoading(false);
    }
  }, [selectedApp]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecision = async (decision: "APPROVED" | "CHANGES_REQUIRED" | "REJECTED") => {
    if (!selectedApp) return;
    try {
      setSubmittingReview(true);
      setActionError(null);

      const capabilityDecisions = (selectedApp.requestedCapabilities || []).map((cap) => ({
        capability: cap,
        grant: decision === "APPROVED",
        reason: reviewReason.trim() || undefined,
      }));

      const req: AdminReviewDecisionRequest = {
        expectedBusinessVersion: selectedApp.businessVersion ?? 0,
        expectedApplicationVersion: selectedApp.version,
        decision,
        reason: reviewReason.trim() || undefined,
        capabilityDecisions,
      };

      await adminReviewApplication(selectedApp.id, req);
      setReviewReason("");
      loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi xử lý thẩm định");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleClaimDecision = async (
    claimId: string,
    version: number,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setSubmittingReview(true);
      setActionError(null);
      await adminReviewManagementClaim(claimId, {
        expectedVersion: version,
        decision,
        reason: reviewReason.trim() || undefined,
      });
      loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi xử lý kháng cáo");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Thẩm định Đối tác & Cơ sở Kinh doanh
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Hàng đợi xét duyệt hồ sơ đối tác, đối soát minh chứng và thẩm định tranh chấp quản lý cơ sở.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Làm mới
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main Grid: Queue on Left, Review Workspace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Application Queue */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Hàng đợi hồ sơ ({applications.length})
            </h2>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {applications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                Hiện không có hồ sơ nào đang chờ duyệt.
              </div>
            ) : (
              applications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedApp?.id === app.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-foreground text-sm block">
                        Hồ sơ #{app.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Phiên bản {app.revisionNumber} • Gửi ngày {new Date(app.submittedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <Badge variant={app.state === "SUBMITTED" ? "secondary" : "outline"} className="text-[11px]">
                      {app.state}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {app.requestedCapabilities?.map((c) => (
                      <span key={c} className="text-micro bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Application Workspace */}
        <div className="lg:col-span-7 space-y-4">
          {selectedApp ? (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Chi tiết hồ sơ #{selectedApp.id.slice(0, 8)}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Business ID: {selectedApp.businessId}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Trạng thái: {selectedApp.state}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                <div>
                  <h3 className="font-semibold text-foreground mb-1.5">Năng lực đề xuất phê duyệt:</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApp.requestedCapabilities?.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedApp.checklistId && (
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
                    <span className="font-semibold block mb-1">Checklist thẩm định:</span>
                    <span className="text-muted-foreground">
                      Mã checklist: {selectedApp.checklistId} (v{selectedApp.checklistVersion})
                    </span>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Ghi chú thẩm định / Lý do quyết định:
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                    placeholder="Ghi chú đối soát giấy tờ hoặc lý do cần bổ sung..."
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                  />
                </div>

                {actionError && (
                  <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleDecision("APPROVED")}
                    disabled={submittingReview}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Phê duyệt hồ sơ
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => handleDecision("CHANGES_REQUIRED")}
                    disabled={submittingReview}
                  >
                    <AlertTriangle className="mr-1.5 h-4 w-4" /> Yêu cầu bổ sung
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDecision("REJECTED")}
                    disabled={submittingReview}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Từ chối
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
              Chọn một hồ sơ bên trái để xem và thẩm định.
            </div>
          )}

          {/* Management Claims Section (§7 Split-View Requirement) */}
          {claims.length > 0 && (
            <Card className="border-border/80 shadow-xs mt-6">
              <CardHeader className="p-4 pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Columns className="h-4 w-4 text-primary" /> Tranh chấp quyền quản lý cơ sở (MANAGEMENT_CLAIM)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-3">
                <p className="text-muted-foreground text-[11px]">
                  Giao diện phân lập thẩm định minh chứng hai bên: Admin đối soát tài liệu của Người yêu cầu (Claimant) và Chủ sở hữu hiện tại (Owner) mà không cấp quyền đọc tài liệu của nhau cho hai bên.
                </p>

                <div className="space-y-3">
                  {claims.map((clm) => {
                    const claimState = clm.state || clm.status || "SUBMITTED";
                    const isPending = claimState === "SUBMITTED" || claimState === "UNDER_REVIEW";
                    return (
                      <div
                        key={clm.id}
                        className="p-3.5 border rounded-lg bg-card space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-foreground block">
                              Kháng cáo #{clm.id.slice(0, 8)}
                            </span>
                            <span className="text-muted-foreground text-[11px] block mt-0.5">
                              Cơ sở mục tiêu: {clm.targetBusinessId || clm.businessId}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              Người nộp: {clm.applicantUserId || clm.claimantUserId || "Đối tác"} • Ngày gửi: {new Date(clm.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <Badge
                            variant={
                              claimState === "APPROVED"
                                ? "default"
                                : claimState === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {claimState}
                          </Badge>
                        </div>

                        {clm.reason && (
                          <div className="p-2.5 rounded bg-muted/40 border border-border/50 text-[11px] text-foreground leading-relaxed">
                            <span className="font-semibold block mb-0.5">Lý do & Căn cứ pháp lý:</span>
                            {clm.reason}
                          </div>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleClaimDecision(clm.id, clm.version || 0, "APPROVED")}
                              disabled={submittingReview}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> Chấp thuận chuyển giao
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => handleClaimDecision(clm.id, clm.version || 0, "REJECTED")}
                              disabled={submittingReview}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Bác đơn
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
