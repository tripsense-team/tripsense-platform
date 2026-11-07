"use client";

import Link from "next/link";

import * as React from "react";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Columns,
  Building2,
  Utensils,
  Compass,
  Car,
  Mail,
  Phone,
  MapPin,
  User,
  Globe,
  FileText,
  ExternalLink,
  Check,
  Layers,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminGetApplications,
  adminGetApplicationChecklist,
  adminGetManagementClaims,
  adminReviewApplication,
  adminReviewManagementClaim,
  getRestaurantMenu,
} from "../services/partner-api";
import type {
  AdminReviewDecisionRequest,
  ApplicationDetailDto,
  ManagementClaimDto,
  PartnerCapability,
  RestaurantMenuItemDto,
} from "../types";

function getBusinessName(app: ApplicationDetailDto): string {
  const snapshot = app.profileSnapshot as Record<string, unknown> | undefined;
  return (
    app.businessName ||
    (snapshot?.displayName as string) ||
    (snapshot?.name as string) ||
    `#${app.id.slice(0, 8)}`
  );
}

function getBusinessKind(app: ApplicationDetailDto): "HOTEL" | "RESTAURANT" | "TOUR_GUIDE" | "RENTAL_SERVICE" | "UNKNOWN" {
  if (app.businessKind === "HOTEL" || app.businessKind === "RESTAURANT" || app.businessKind === "TOUR_GUIDE" || app.businessKind === "RENTAL_SERVICE") {
    return app.businessKind;
  }
  const snapshot = app.profileSnapshot as Record<string, unknown> | undefined;
  const snapKind = snapshot?.kind as string | undefined;
  if (snapKind === "HOTEL" || snapKind === "RESTAURANT" || snapKind === "TOUR_GUIDE" || snapKind === "RENTAL_SERVICE") {
    return snapKind;
  }
  if (app.requestedCapabilities?.some((c) => c.startsWith("HOTEL"))) return "HOTEL";
  if (app.requestedCapabilities?.some((c) => c.startsWith("RESTAURANT"))) return "RESTAURANT";
  if (app.requestedCapabilities?.some((c) => c.startsWith("RENTAL"))) return "RENTAL_SERVICE";
  if (app.requestedCapabilities?.some((c) => c.startsWith("GUIDE"))) return "TOUR_GUIDE";
  return "UNKNOWN";
}

const CAPABILITY_INFO: Record<string, { label: string; desc: string }> = {
  HOTEL_LISTING: {
    label: "Hồ sơ Khách sạn",
    desc: "Hiển thị khách sạn trên bản đồ & hệ thống tìm kiếm",
  },
  HOTEL_INVENTORY: {
    label: "Quản lý Phòng",
    desc: "Cập nhật danh mục phòng, giá & số lượng phòng trống",
  },
  HOTEL_BOOKING: {
    label: "Đặt phòng Trực tuyến",
    desc: "Xử lý nhận đặt phòng và thanh toán trực tuyến",
  },
  RESTAURANT_LISTING: {
    label: "Hồ sơ Nhà hàng",
    desc: "Hiển thị quán ăn trên bản đồ ẩm thực & tìm kiếm",
  },
  RESTAURANT_MENU: {
    label: "Thực đơn & Bảng giá",
    desc: "Đăng tải menu, bảng giá tham khảo hoặc ảnh chụp thực đơn",
  },
  RENTAL_LISTING: {
    label: "Hồ sơ Dịch vụ Cho thuê",
    desc: "Hiển thị cơ sở cho thuê trên bản đồ và danh mục dịch vụ",
  },
  RENTAL_INVENTORY: {
    label: "Quản lý Phương tiện / Đồ thuê",
    desc: "Cập nhật danh mục xe máy, ô tô, thiết bị và số lượng khả dụng",
  },
  RENTAL_BOOKING: {
    label: "Đặt thuê & Cọc trực tuyến",
    desc: "Xử lý nhận yêu cầu đặt thuê, xác nhận đơn và thanh toán cọc PayOS",
  },
  GUIDE_LISTING: {
    label: "Hồ sơ Hướng dẫn viên",
    desc: "Hiển thị công khai trong danh mục hướng dẫn viên",
  },
  GUIDE_PROMOTION: {
    label: "Quảng bá Tour & Trải nghiệm",
    desc: "Đăng bài chia sẻ lịch trình & chuyên môn du lịch",
  },
  GUIDE_INQUIRY: {
    label: "Tư vấn & Nhận đặt tour",
    desc: "Nhận tin nhắn tư vấn và thiết kế tour từ du khách",
  },
};

function getDefaultChecklist(kind?: string) {
  return [
    { code: "PROFILE", label: "Đối soát thông tin cơ bản & người đại diện", required: true },
    { code: "CONTACT", label: "Xác minh thông tin liên hệ & địa chỉ", required: true },
    { code: "OWNERSHIP", label: "Đối soát giấy phép & chứng nhận quyền sở hữu", required: true },
  ];
}

function getKindIcon(kind: string) {
  switch (kind) {
    case "HOTEL":
      return Building2;
    case "RESTAURANT":
      return Utensils;
    case "TOUR_GUIDE":
      return Compass;
    case "RENTAL_SERVICE":
      return Car;
    default:
      return ShieldCheck;
  }
}

export function AdminPartnersView() {
  const { t, locale } = useTranslation();
  const [applications, setApplications] = React.useState<ApplicationDetailDto[]>([]);
  const [claims, setClaims] = React.useState<ManagementClaimDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<ApplicationDetailDto | null>(null);
  const [reviewReason, setReviewReason] = React.useState("");
  const [submittingReview, setSubmittingReview] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [checklist, setChecklist] = React.useState<{ code: string; label: string; required: boolean }[]>([]);
  const [checklistResults, setChecklistResults] = React.useState<Record<string, "PASS" | "FAIL" | "NEEDS_INFO">>({});
  const [resolvingClaim, setResolvingClaim] = React.useState<{
    claim: ManagementClaimDto;
    outcome: "APPROVED" | "REJECTED";
  } | null>(null);
  const [claimReason, setClaimReason] = React.useState("");
  const [claimError, setClaimError] = React.useState<string | null>(null);
  const [menuItems, setMenuItems] = React.useState<RestaurantMenuItemDto[]>([]);
  const [loadingMenu, setLoadingMenu] = React.useState(false);
  const [lightboxImage, setLightboxImage] = React.useState<{ url: string; title: string } | null>(null);

  const selectedBizName = selectedApp ? getBusinessName(selectedApp) : "";
  const selectedBizKind = selectedApp ? getBusinessKind(selectedApp) : "UNKNOWN";
  const SelectedKindIcon = getKindIcon(selectedBizKind);

  const selectedSnapshot = (selectedApp?.profileSnapshot || {}) as Record<string, unknown>;
  const selectedContactEmail = (selectedSnapshot.contactEmail || selectedSnapshot.email) as string | undefined;
  const selectedPhone = (selectedSnapshot.contactPhone || selectedSnapshot.phone) as string | undefined;
  const selectedAddress = selectedSnapshot.address as string | undefined;
  const selectedDestination = (selectedSnapshot.destination || selectedSnapshot.city) as string | undefined;
  const selectedWebsite = selectedSnapshot.website as string | undefined;
  const selectedDescription = (selectedSnapshot.bio || selectedSnapshot.description) as string | undefined;
  const selectedRepresentative = selectedSnapshot.legalRepresentative as string | undefined;
  const selectedTaxCode = selectedSnapshot.taxCode as string | undefined;
  const selectedLicenseNumber = selectedSnapshot.licenseNumber as string | undefined;
  const selectedProofDocumentUrl = (selectedSnapshot.proofDocumentUrl || selectedSnapshot.proofUrl) as string | undefined;
  const selectedLat = typeof selectedSnapshot.lat === "number" ? selectedSnapshot.lat : undefined;
  const selectedLng = typeof selectedSnapshot.lng === "number" ? selectedSnapshot.lng : undefined;

  React.useEffect(() => {
    setChecklist([]);
    setChecklistResults({});
    if (!selectedApp) return;
    let active = true;
    adminGetApplicationChecklist(selectedApp.id)
      .then((items) => {
        if (active) {
          if (items && items.length > 0) {
            setChecklist(items);
          } else {
            setChecklist(getDefaultChecklist(selectedBizKind));
          }
          setActionError(null);
        }
      })
      .catch(() => {
        if (active) {
          // Gracefully fallback to standard verification checklist so approval is never blocked
          setChecklist(getDefaultChecklist(selectedBizKind));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedApp?.id, selectedBizKind, t]);

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
      setSelectedApp((current) => apps?.find((app) => app.id === current?.id) ?? apps?.[0] ?? null);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.networkError") || "Error loading review queue"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!selectedApp?.businessId || selectedBizKind !== "RESTAURANT") {
      setMenuItems([]);
      setLoadingMenu(false);
      return;
    }
    let active = true;
    setLoadingMenu(true);
    getRestaurantMenu(selectedApp.businessId)
      .then((items) => {
        if (active) {
          setMenuItems(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (active) setMenuItems([]);
      })
      .finally(() => {
        if (active) setLoadingMenu(false);
      });
    return () => {
      active = false;
    };
  }, [selectedApp?.businessId, selectedBizKind]);

  const handlePassAll = () => {
    const allPass: Record<string, "PASS" | "FAIL" | "NEEDS_INFO"> = {};
    for (const item of checklist) {
      allPass[item.code] = "PASS";
    }
    setChecklistResults(allPass);
    setActionError(null);
  };

  const handleDecision = async (decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT") => {
    if (!selectedApp) return;
    if (
      decision === "APPROVE" &&
      (checklist.length === 0 || checklist.some((item) => item.required && checklistResults[item.code] !== "PASS"))
    ) {
      setActionError(t("partner.checklist.requirePass"));
      return;
    }

    if (decision !== "APPROVE" && !reviewReason.trim()) {
      setActionError(
        decision === "REQUEST_CHANGES"
          ? t("admin.partners.reasonRequiredChanges")
          : t("admin.partners.reasonRequiredReject"),
      );
      return;
    }

    try {
      setSubmittingReview(true);
      setActionError(null);

      const expectedPrefix =
        selectedBizKind === "HOTEL"
          ? "HOTEL_"
          : selectedBizKind === "RESTAURANT"
          ? "RESTAURANT_"
          : selectedBizKind === "RENTAL_SERVICE"
          ? "RENTAL_"
          : selectedBizKind === "TOUR_GUIDE"
          ? "GUIDE_"
          : "";

      const rawCaps = selectedApp.requestedCapabilities || [];
      const filteredCaps = expectedPrefix
        ? rawCaps.filter((cap) => cap.startsWith(expectedPrefix))
        : rawCaps;

      const standardCapsForKind: PartnerCapability[] =
        selectedBizKind === "HOTEL"
          ? ["HOTEL_LISTING", "HOTEL_INVENTORY", "HOTEL_BOOKING"]
          : selectedBizKind === "RESTAURANT"
          ? ["RESTAURANT_LISTING", "RESTAURANT_MENU"]
          : selectedBizKind === "RENTAL_SERVICE"
          ? ["RENTAL_LISTING", "RENTAL_INVENTORY", "RENTAL_BOOKING"]
          : ["GUIDE_LISTING", "GUIDE_PROMOTION", "GUIDE_INQUIRY"];

      // When approving, ensure all operational capabilities for the business kind are granted
      const finalCaps =
        decision === "APPROVE"
          ? Array.from(new Set([...standardCapsForKind, ...filteredCaps]))
          : filteredCaps;

      const capabilityDecisions = finalCaps.map((cap) => ({
        capability: cap,
        grant: decision === "APPROVE",
        reason: reviewReason.trim() || undefined,
      }));

      const req: AdminReviewDecisionRequest = {
        expectedBusinessVersion: selectedApp.businessVersion ?? 0,
        expectedApplicationVersion: selectedApp.version,
        decision,
        checklistResults: checklist.map((item) => ({
          code: item.code,
          result: checklistResults[item.code] ?? "NEEDS_INFO",
        })),
        reason: reviewReason.trim() || undefined,
        capabilityDecisions,
      };

      await adminReviewApplication(selectedApp.id, req);
      setReviewReason("");
      setSelectedApp(null);
      await loadData();
    } catch (err: unknown) {
      setActionError(
        getSafeErrorMessage(err, t("admin.partners.reviewError") || "Error reviewing application"),
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const openClaimModal = (claim: ManagementClaimDto, outcome: "APPROVED" | "REJECTED") => {
    setResolvingClaim({ claim, outcome });
    setClaimReason("");
    setClaimError(null);
  };

  const submitClaimDecision = async () => {
    if (!resolvingClaim) return;
    if (!claimReason.trim()) {
      setClaimError(
        t("admin.partners.claims.reasonRequired") || "Please provide a reason for resolving this dispute.",
      );
      return;
    }

    try {
      setSubmittingReview(true);
      setClaimError(null);
      await adminReviewManagementClaim(resolvingClaim.claim.id, {
        expectedVersion: resolvingClaim.claim.version || 0,
        outcome: resolvingClaim.outcome,
        reason: claimReason.trim(),
      });
      setResolvingClaim(null);
      setClaimReason("");
      await loadData();
    } catch (err: unknown) {
      setClaimError(
        getSafeErrorMessage(err, t("admin.partners.claims.errorResolving") || "Error processing claim resolution"),
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("admin.partners.title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.partners.subtitle")}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{" "}
          {t("common.refresh")}
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
              {t("admin.partners.queueTitle", { count: applications.length })}
            </h2>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {applications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                {t("admin.partners.emptyQueue")}
              </div>
            ) : (
              applications.map((app) => {
                const bizName = getBusinessName(app);
                const bizKind = getBusinessKind(app);
                const KindIcon = getKindIcon(bizKind);
                const contactEmail = (app.profileSnapshot?.contactEmail || app.profileSnapshot?.email) as string | undefined;
                const contactPhone = (app.profileSnapshot?.contactPhone || app.profileSnapshot?.phone) as string | undefined;
                const destination = (app.profileSnapshot?.destination || app.profileSnapshot?.city) as string | undefined;
                const isSelected = selectedApp?.id === app.id;

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                        : "border-border hover:border-primary/40 bg-card hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-primary/10 text-primary shrink-0">
                            <KindIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-semibold text-foreground text-sm truncate block" title={bizName}>
                            {bizName}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-micro py-0 px-1 font-normal">
                            {t(`admin.partners.kinds.${bizKind}`) || bizKind}
                          </Badge>
                          <span>•</span>
                          <span>
                            {new Date(app.submittedAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
                          </span>
                        </div>

                        {(contactEmail || contactPhone || destination) && (
                          <div className="text-[11px] text-muted-foreground/90 flex items-center gap-1.5 truncate pt-0.5">
                            {contactEmail && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                <span className="truncate">{contactEmail}</span>
                              </span>
                            )}
                            {contactPhone && (
                              <span className="inline-flex items-center gap-1 truncate">
                                {contactEmail && <span>•</span>}
                                <Phone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                <span className="truncate">{contactPhone}</span>
                              </span>
                            )}
                            {destination && (
                              <span className="inline-flex items-center gap-1 truncate">
                                {(contactEmail || contactPhone) && <span>•</span>}
                                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                <span className="truncate">{destination}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Badge
                        variant={app.state === "SUBMITTED" ? "secondary" : "outline"}
                        className="text-[11px] shrink-0"
                      >
                        {app.state}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-border/40">
                      {app.requestedCapabilities?.map((c) => (
                        <span key={c} className="text-micro bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Application Workspace */}
        <div className="lg:col-span-7 space-y-4">
          {selectedApp ? (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-border/50">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <SelectedKindIcon className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-lg font-bold truncate">
                        {selectedBizName}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.partners.submittedTime", {
                        date: new Date(selectedApp.submittedAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US"),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {t(`admin.partners.kinds.${selectedBizKind}`) || selectedBizKind}
                    </Badge>
                    <Badge variant={selectedApp.state === "SUBMITTED" ? "secondary" : "outline"} className="text-xs">
                      {selectedApp.state}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {/* Section: Business & Applicant Details */}
                <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2.5">
                  <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {t("admin.partners.businessInfoTitle")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="font-medium text-foreground">{t("admin.partners.email")}:</span>
                      <span className="truncate">{selectedContactEmail || t("admin.partners.unspecified")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="font-medium text-foreground">{t("admin.partners.phone")}:</span>
                      <span>{selectedPhone || t("admin.partners.unspecified")}</span>
                    </div>
                    {selectedAddress && (
                      <div className="flex items-start gap-1.5 md:col-span-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 mt-0.5" />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div>
                            <span className="font-medium text-foreground">{t("admin.partners.address")}: </span>
                            <span>
                              {selectedAddress}
                              {selectedDestination ? ` (${selectedDestination})` : ""}
                            </span>
                          </div>
                          {selectedLat && selectedLng && (
                            <div className="pt-0.5">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedLat},${selectedLng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                              >
                                Xem vị trí bản đồ ({selectedLat.toFixed(4)}, {selectedLng.toFixed(4)})
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedWebsite && (
                      <div className="flex items-center gap-1.5 truncate md:col-span-2">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">{t("admin.partners.website")}:</span>
                        <a
                          href={selectedWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline truncate"
                        >
                          {selectedWebsite}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 truncate md:col-span-2 text-[11px]">
                      <span className="font-medium text-foreground">{t("admin.partners.ownerStatus")}:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle className="h-3.5 w-3.5" /> {t("admin.partners.verifiedAccount")}
                      </span>
                    </div>
                    {selectedDescription && (
                      <div className="md:col-span-2 pt-2 border-t border-border/40 text-[11px] leading-relaxed italic text-foreground/90 bg-muted/20 p-2.5 rounded-md">
                        &ldquo;{selectedDescription}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Legal Proof & Documentation */}
                <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2.5">
                  <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    {t("admin.partners.legalSectionTitle")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-medium text-foreground">
                        {selectedBizKind === "TOUR_GUIDE"
                          ? t("admin.partners.guideName")
                          : t("admin.partners.legalRepresentative")}
                      </span>
                      <span className="truncate">{selectedRepresentative || t("admin.partners.unspecified")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-medium text-foreground">
                        {t("admin.partners.taxCode")}
                      </span>
                      <span>{selectedTaxCode || t("admin.partners.unspecified")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate md:col-span-2">
                      <span className="font-medium text-foreground">
                        {selectedBizKind === "TOUR_GUIDE"
                          ? t("admin.partners.guideLicense")
                          : t("admin.partners.licenseNumber")}
                      </span>
                      <span>{selectedLicenseNumber || t("admin.partners.unspecified")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate md:col-span-2 pt-1 border-t border-border/40">
                      <span className="font-medium text-foreground">{t("admin.partners.proofDocument")}</span>
                      {selectedProofDocumentUrl ? (
                        <a
                          href={selectedProofDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium ml-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("admin.partners.viewDocument")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic ml-1">{t("admin.partners.noDocument")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      {t("admin.partners.requestedCapabilities")}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      (Cấp đầy đủ quyền đón khách khi phê duyệt)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedApp.requestedCapabilities?.map((c) => {
                      const info = CAPABILITY_INFO[c];
                      return (
                        <div key={c} className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-micro font-semibold py-0 px-1.5 bg-background text-primary border-primary/30">
                              {c}
                            </Badge>
                            {info && (
                              <span className="font-semibold text-xs text-foreground truncate">
                                {info.label}
                              </span>
                            )}
                          </div>
                          {info && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {info.desc}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>



                {/* Section: Service Catalog & Public Preview */}
                <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/40">
                    <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <SelectedKindIcon className="h-3.5 w-3.5 text-primary" />
                      {selectedBizKind === "RESTAURANT"
                        ? "Thực đơn & Bảng giá cơ sở đã tạo"
                        : selectedBizKind === "HOTEL"
                          ? "Hạng phòng & Dịch vụ lưu trú"
                          : selectedBizKind === "RENTAL_SERVICE"
                            ? "Danh mục phương tiện & Thiết bị cho thuê"
                            : "Nghiệp vụ & Bài quảng bá tour"}
                    </h3>
                    <Button asChild size="sm" variant="outline" className="h-7 text-micro gap-1 self-start sm:self-auto shadow-2xs">
                      <Link
                        href={
                          selectedBizKind === "RESTAURANT"
                            ? `/restaurants/${selectedApp.businessId}`
                            : selectedBizKind === "HOTEL"
                              ? `/hotels/${selectedApp.businessId}`
                              : selectedBizKind === "RENTAL_SERVICE"
                                ? `/rentals/${selectedApp.businessId}`
                                : `/guides/${selectedApp.businessId}`
                        }
                        target="_blank"
                      >
                        <Eye className="h-3 w-3" /> Xem trang du khách thực tế <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </Link>
                    </Button>
                  </div>

                  {selectedBizKind === "RESTAURANT" && (
                    <div className="space-y-3">
                      {loadingMenu ? (
                        <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span>Đang tải thông tin thực đơn của quán...</span>
                        </div>
                      ) : menuItems.length === 0 ? (
                        <div className="rounded-lg bg-muted/20 p-3 text-center text-[11px] text-muted-foreground border border-dashed border-border/80">
                          Quán chưa tải lên ảnh thực đơn hoặc món ăn nào. (Admin có thể duyệt trước để quán hoàn thiện sau, hoặc chọn &quot;Cần bổ sung&quot; nếu yêu cầu có menu).
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Danh mục dịch vụ & món ăn ({menuItems.length} mục):</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                            {menuItems.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="flex items-center gap-2.5 p-2 rounded-lg border border-border/60 bg-muted/15 text-xs hover:bg-muted/30 transition-colors"
                              >
                                {item.imageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxImage({ url: item.imageUrl!, title: item.name || "Ảnh thực đơn" })}
                                    className="relative h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0 group cursor-pointer border border-border"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                      <Eye className="h-3.5 w-3.5" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="h-12 w-12 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                    <Utensils className="h-5 w-5 opacity-40" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="font-semibold text-foreground truncate" title={item.name}>
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-primary font-bold">
                                    {item.price > 0 ? `${item.price.toLocaleString("vi-VN")} ${item.currency || "VND"}` : "Liên hệ / Theo thời giá"}
                                  </div>
                                  {item.category && (
                                    <Badge variant="outline" className="text-micro py-0 px-1 font-normal text-muted-foreground">
                                      {item.category}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {selectedBizKind === "HOTEL" && (
                    <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                      <p>Cơ sở lưu trú & khách sạn. Nhấn vào nút <strong>&quot;Xem trang du khách thực tế&quot;</strong> ở trên để đối soát chi tiết danh sách hạng phòng, giá niêm yết và chính sách nhận/trả phòng.</p>
                    </div>
                  )}

                  {selectedBizKind === "RENTAL_SERVICE" && (
                    <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                      <p>Thuê xe & Dịch vụ trải nghiệm du lịch. Nhấn vào nút <strong>&quot;Xem trang du khách thực tế&quot;</strong> ở trên để đối soát danh mục phương tiện/thiết bị, giá niêm yết và biểu phí cho thuê.</p>
                    </div>
                  )}

                  {selectedBizKind === "TOUR_GUIDE" && (
                    <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                      <p>Hướng dẫn viên du lịch chuyên nghiệp. Nhấn vào nút <strong>&quot;Xem trang du khách thực tế&quot;</strong> ở trên để xem đầy đủ hồ sơ giới thiệu tour, ngôn ngữ và biểu phí dẫn đoàn.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    {t("admin.partners.reviewNotesLabel")}
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                    placeholder={t("admin.partners.reviewNotesPlaceholder")}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                  />
                </div>

                {/* Interactive Review Checklist Card */}
                {selectedApp.checklistId && (
                  <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <div>
                        <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          Tiêu chí thẩm định hồ sơ
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Đánh dấu Đạt cho các tiêu chí hợp lệ trước khi phê duyệt
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePassAll}
                        className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-medium px-2.5"
                      >
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        Đạt tất cả
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {checklist.map((item) => {
                        const result = checklistResults[item.code] ?? "NEEDS_INFO";
                        const labelText = ["PROFILE", "CONTACT", "OWNERSHIP"].includes(item.code)
                          ? t(`partner.checklist.items.${item.code}`)
                          : item.label;

                        return (
                          <div
                            key={item.code}
                            className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                              result === "PASS"
                                ? "bg-emerald-500/5 border-emerald-500/30"
                                : result === "FAIL"
                                ? "bg-destructive/5 border-destructive/30"
                                : "bg-muted/20 border-border/70"
                            }`}
                          >
                            <div
                              onClick={() => {
                                setChecklistResults((prev) => ({
                                  ...prev,
                                  [item.code]: prev[item.code] === "PASS" ? "NEEDS_INFO" : "PASS",
                                }));
                              }}
                              className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
                            >
                              <div
                                className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                  result === "PASS"
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "border-muted-foreground/40 bg-background"
                                }`}
                              >
                                {result === "PASS" && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-medium text-foreground truncate">
                                {labelText}
                                {item.required && <span className="text-destructive ml-0.5">*</span>}
                              </span>
                            </div>

                            {/* 3 Interactive Quick Pill Tabs */}
                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setChecklistResults((prev) => ({
                                    ...prev,
                                    [item.code]: "PASS",
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                  result === "PASS"
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {t("partner.checklist.pass") || "Đạt"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setChecklistResults((prev) => ({
                                    ...prev,
                                    [item.code]: "NEEDS_INFO",
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                  result === "NEEDS_INFO"
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                    : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {t("partner.checklist.needsInfo") || "Cần bổ sung"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setChecklistResults((prev) => ({
                                    ...prev,
                                    [item.code]: "FAIL",
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                  result === "FAIL"
                                    ? "bg-destructive text-destructive-foreground shadow-2xs"
                                    : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {t("partner.checklist.fail") || "Không đạt"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    onClick={() => handleDecision("APPROVE")}
                    disabled={submittingReview}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" /> {t("admin.partners.approve")}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => handleDecision("REQUEST_CHANGES")}
                    disabled={submittingReview}
                  >
                    <AlertTriangle className="mr-1.5 h-4 w-4" /> {t("admin.partners.requestChanges")}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDecision("REJECT")}
                    disabled={submittingReview}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.partners.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
              {t("admin.partners.selectPrompt")}
            </div>
          )}

          {/* Management Claims Section */}
          {claims.length > 0 && (
            <Card className="border-border/80 shadow-xs mt-6">
              <CardHeader className="p-4 pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Columns className="h-4 w-4 text-primary" /> {t("admin.partners.claims.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-3">
                <p className="text-muted-foreground text-[11px]">
                  {t("admin.partners.claims.desc")}
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
                              {t("admin.partners.claims.dispute")} #{clm.id.slice(0, 8)}
                            </span>
                            <span className="text-muted-foreground text-[11px] block mt-0.5">
                              {t("admin.partners.businessId", { id: clm.targetBusinessId || clm.businessId || "" })}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {t("admin.partners.claims.claimant")}: {clm.applicantUserId || clm.claimantUserId || "Partner"} •{" "}
                              {new Date(clm.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
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
                            <span className="font-semibold block mb-0.5">
                              {t("admin.partners.claims.reason")}:
                            </span>
                            {clm.reason}
                          </div>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => openClaimModal(clm, "APPROVED")}
                              disabled={submittingReview}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> {t("admin.partners.claims.approveClaim")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => openClaimModal(clm, "REJECTED")}
                              disabled={submittingReview}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> {t("admin.partners.claims.rejectClaim")}
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

      {/* Claim Resolution Confirmation Dialog */}
      <Dialog
        open={!!resolvingClaim}
        onOpenChange={(open) => {
          if (!open) {
            setResolvingClaim(null);
            setClaimError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {resolvingClaim?.outcome === "APPROVED"
                ? t("admin.partners.claims.approveClaimTitle")
                : t("admin.partners.claims.rejectClaimTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {resolvingClaim?.outcome === "APPROVED"
                ? t("admin.partners.claims.confirmApproveDesc")
                : t("admin.partners.claims.confirmRejectDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/60">
              <span className="font-semibold block">
                {t("admin.partners.claims.dispute")} #{resolvingClaim?.claim.id.slice(0, 8)}
              </span>
              <span className="text-muted-foreground block text-micro mt-0.5">
                {t("admin.partners.businessId", {
                  id: resolvingClaim?.claim.targetBusinessId || resolvingClaim?.claim.businessId || "",
                })}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5 text-foreground">
                {t("admin.partners.claims.reasonLabel")} <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder={t("admin.partners.claims.reasonPlaceholder")}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            {claimError && (
              <div className="p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
                {claimError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResolvingClaim(null)}
              disabled={submittingReview}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              variant={resolvingClaim?.outcome === "APPROVED" ? "default" : "destructive"}
              className={resolvingClaim?.outcome === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              onClick={submitClaimDecision}
              disabled={submittingReview}
            >
              {submittingReview ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {resolvingClaim?.outcome === "APPROVED"
                ? t("admin.partners.claims.approveClaim")
                : t("admin.partners.claims.rejectClaim")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
