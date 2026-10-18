"use client";

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
  Mail,
  Phone,
  MapPin,
  User,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "../services/partner-api";
import type {
  AdminReviewDecisionRequest,
  ApplicationDetailDto,
  ManagementClaimDto,
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

function getBusinessKind(app: ApplicationDetailDto): "HOTEL" | "RESTAURANT" | "TOUR_GUIDE" | "UNKNOWN" {
  if (app.businessKind === "HOTEL" || app.businessKind === "RESTAURANT" || app.businessKind === "TOUR_GUIDE") {
    return app.businessKind;
  }
  const snapshot = app.profileSnapshot as Record<string, unknown> | undefined;
  const snapKind = snapshot?.kind as string | undefined;
  if (snapKind === "HOTEL" || snapKind === "RESTAURANT" || snapKind === "TOUR_GUIDE") {
    return snapKind;
  }
  if (app.requestedCapabilities?.some((c) => c.startsWith("HOTEL"))) return "HOTEL";
  if (app.requestedCapabilities?.some((c) => c.startsWith("RESTAURANT"))) return "RESTAURANT";
  if (app.requestedCapabilities?.some((c) => c.startsWith("GUIDE"))) return "TOUR_GUIDE";
  return "UNKNOWN";
}

function getKindIcon(kind: string) {
  switch (kind) {
    case "HOTEL":
      return Building2;
    case "RESTAURANT":
      return Utensils;
    case "TOUR_GUIDE":
      return Compass;
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

  React.useEffect(() => {
    setChecklist([]);
    setChecklistResults({});
    if (!selectedApp) return;
    let active = true;
    adminGetApplicationChecklist(selectedApp.id)
      .then((items) => {
        if (active) setChecklist(items);
      })
      .catch(() => {
        if (active) setActionError(t("partner.checklist.loadError"));
      });
    return () => {
      active = false;
    };
  }, [selectedApp?.id, t]);

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

      const capabilityDecisions = (selectedApp.requestedCapabilities || []).map((cap) => ({
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
      setActionError(getSafeErrorMessage(err, "Lỗi khi xử lý thẩm định"));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleClaimDecision = async (
    claimId: string,
    version: number,
    outcome: "APPROVED" | "REJECTED",
  ) => {
    if (!reviewReason.trim()) {
      setActionError("Vui lòng nhập lý do giải quyết tranh chấp.");
      return;
    }

    try {
      setSubmittingReview(true);
      setActionError(null);
      await adminReviewManagementClaim(claimId, {
        expectedVersion: version,
        outcome,
        reason: reviewReason.trim(),
      });
      setReviewReason("");
      await loadData();
    } catch (err: unknown) {
      setActionError(getSafeErrorMessage(err, "Lỗi khi xử lý kháng cáo"));
    } finally {
      setSubmittingReview(false);
    }
  };

  const selectedBizName = selectedApp ? getBusinessName(selectedApp) : "";
  const selectedBizKind = selectedApp ? getBusinessKind(selectedApp) : "UNKNOWN";
  const SelectedKindIcon = getKindIcon(selectedBizKind);

  const selectedSnapshot = (selectedApp?.profileSnapshot || {}) as Record<string, unknown>;
  const selectedContactEmail = (selectedSnapshot.contactEmail || selectedSnapshot.email) as string | undefined;
  const selectedPhone = selectedSnapshot.phone as string | undefined;
  const selectedAddress = selectedSnapshot.address as string | undefined;
  const selectedDestination = selectedSnapshot.destination as string | undefined;
  const selectedWebsite = selectedSnapshot.website as string | undefined;
  const selectedDescription = selectedSnapshot.description as string | undefined;

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
                          <span className="font-mono text-muted-foreground/80">#{app.id.slice(0, 8)}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                            {t(`admin.partners.kinds.${bizKind}`) || bizKind}
                          </Badge>
                          <span>•</span>
                          <span>
                            {new Date(app.submittedAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
                          </span>
                        </div>

                        {contactEmail && (
                          <div className="text-[11px] text-muted-foreground/90 flex items-center gap-1 truncate pt-0.5">
                            <Mail className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                            <span className="truncate">{contactEmail}</span>
                            {destination && (
                              <>
                                <span>•</span>
                                <span className="truncate">{destination}</span>
                              </>
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
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: #{selectedApp.id.slice(0, 8)} • Business ID: {selectedApp.businessId}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                    {selectedContactEmail && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">{t("admin.partners.email")}:</span>
                        <span className="truncate">{selectedContactEmail}</span>
                      </div>
                    )}
                    {selectedPhone && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">{t("admin.partners.phone")}:</span>
                        <span>{selectedPhone}</span>
                      </div>
                    )}
                    {selectedAddress && (
                      <div className="flex items-center gap-1.5 truncate md:col-span-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">{t("admin.partners.address")}:</span>
                        <span className="truncate">
                          {selectedAddress}
                          {selectedDestination ? ` (${selectedDestination})` : ""}
                        </span>
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
                    {selectedApp.ownerUserId && (
                      <div className="flex items-center gap-1.5 truncate md:col-span-2 font-mono text-[10px]">
                        <span className="font-medium text-foreground font-sans text-[11px]">
                          {t("admin.partners.ownerAccount")}:
                        </span>
                        <span>{selectedApp.ownerUserId}</span>
                      </div>
                    )}
                    {selectedDescription && (
                      <div className="md:col-span-2 pt-1 border-t border-border/40 text-[11px] leading-relaxed italic text-foreground/80">
                        "{selectedDescription}"
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-1.5">
                    {t("admin.partners.requestedCapabilities")}
                  </h3>
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
                    <span className="font-semibold block mb-1">
                      {t("admin.partners.checklistTitle")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("admin.partners.checklistCode", {
                        id: selectedApp.checklistId,
                        version: String(selectedApp.checklistVersion ?? "1"),
                      })}
                    </span>
                  </div>
                )}

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

                {selectedApp.checklistId && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    {checklist.map((item) => (
                      <label key={item.code} className="flex items-center justify-between gap-3">
                        <span>
                          {["PROFILE", "CONTACT", "OWNERSHIP"].includes(item.code)
                            ? t(`partner.checklist.items.${item.code}`)
                            : item.label}
                          {item.required ? " *" : ""}
                        </span>
                        <select
                          aria-label={item.label}
                          className="rounded-md border border-input bg-background p-2"
                          value={checklistResults[item.code] ?? "NEEDS_INFO"}
                          onChange={(e) =>
                            setChecklistResults((prev) => ({
                              ...prev,
                              [item.code]: e.target.value as "PASS" | "FAIL" | "NEEDS_INFO",
                            }))
                          }
                        >
                          <option value="NEEDS_INFO">{t("partner.checklist.needsInfo")}</option>
                          <option value="PASS">{t("partner.checklist.pass")}</option>
                          <option value="FAIL">{t("partner.checklist.fail")}</option>
                        </select>
                      </label>
                    ))}
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
                              onClick={() => handleClaimDecision(clm.id, clm.version || 0, "APPROVED")}
                              disabled={submittingReview}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> {t("admin.partners.claims.approveClaim")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => handleClaimDecision(clm.id, clm.version || 0, "REJECTED")}
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
    </div>
  );
}
