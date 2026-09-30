"use client";

import * as React from "react";
import {
  Building2,
  Utensils,
  Compass,
  Check,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Search,
  FileText,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Loader2,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAutocomplete, getPlaceDetails } from "@/features/places/services/places-api";
import type { AutocompleteSuggestion, Place } from "@/features/places/types";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  createBusinessDraft,
  submitBusinessApplication,
  createManagementClaim,
  searchBusinessCandidates,
} from "../services/partner-api";
import type {
  BusinessDetailDto,
  BusinessKind,
  PartnerCapability,
  PartnerCandidateDto,
} from "../types";

interface PartnerWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (business: BusinessDetailDto) => void;
}

export function PartnerWizardModal({
  open,
  onOpenChange,
  onSuccess,
}: PartnerWizardModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [kind, setKind] = React.useState<BusinessKind>("TOUR_GUIDE");
  const [displayName, setDisplayName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedCapabilities, setSelectedCapabilities] = React.useState<PartnerCapability[]>([
    "GUIDE_LISTING",
    "GUIDE_PROMOTION",
    "GUIDE_INQUIRY",
  ]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // --- Place / Location Search state ---
  const [placeQuery, setPlaceQuery] = React.useState("");
  const { t } = useTranslation();
  const placeInputId = React.useId();
  const [placeResults, setPlaceResults] = React.useState<AutocompleteSuggestion[]>([]);
  const [placeError, setPlaceError] = React.useState<string | null>(null);
  const [searchAttempt, setSearchAttempt] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isResolvingPlace, setIsResolvingPlace] = React.useState(false);
  const searchRequest = React.useRef<AbortController | null>(null);
  const detailsRequest = React.useRef<AbortController | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = React.useState(false);
  const [selectedPlace, setSelectedPlace] = React.useState<Place | null>(null);
  const [customAddress, setCustomAddress] = React.useState("");
  const [conflictCandidate, setConflictCandidate] = React.useState<PartnerCandidateDto | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = React.useState(false);

  // --- Proof of Ownership (Minh chứng quyền sở hữu cơ sở) ---
  const [taxCode, setTaxCode] = React.useState("");
  const [licenseNumber, setLicenseNumber] = React.useState("");
  const [legalRepresentative, setLegalRepresentative] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [proofDocumentUrl, setProofDocumentUrl] = React.useState("");

  // --- Claim / Appeal Dispute Mode (Kháng cáo quyền quản lý cơ sở) ---
  const [isClaimMode, setIsClaimMode] = React.useState(false);
  const [claimSearchQuery, setClaimSearchQuery] = React.useState("");
  const [candidateResults, setCandidateResults] = React.useState<PartnerCandidateDto[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = React.useState(false);
  const [selectedCandidate, setSelectedCandidate] = React.useState<PartnerCandidateDto | null>(null);
  const [claimReason, setClaimReason] = React.useState("");
  const [claimSuccess, setClaimSuccess] = React.useState(false);
  const [submittingClaim, setSubmittingClaim] = React.useState(false);

  // Update default capabilities when kind changes
  React.useEffect(() => {
    if (kind === "HOTEL") {
      setSelectedCapabilities(["HOTEL_LISTING", "HOTEL_INVENTORY", "HOTEL_BOOKING"]);
    } else if (kind === "RESTAURANT") {
      setSelectedCapabilities(["RESTAURANT_LISTING", "RESTAURANT_MENU"]);
    } else {
      setSelectedCapabilities(["GUIDE_LISTING", "GUIDE_PROMOTION", "GUIDE_INQUIRY"]);
    }
  }, [kind]);

  React.useEffect(() => {
    setIsResolvingPlace(false);
    return () => { detailsRequest.current?.abort(); };
  }, [open, kind, step, isClaimMode]);

  React.useEffect(() => {
    setSelectedPlace(null);
    setPlaceQuery("");
    setCustomAddress("");
  }, [kind]);

  // Debounced autocomplete; abort guards also protect against stale responses.
  React.useEffect(() => {
    setPlaceResults([]);
    setPlaceError(null);
    setIsSearchingPlaces(false);
    if (!open || step !== 2 || isClaimMode || kind === "TOUR_GUIDE" ||
        selectedPlace || placeQuery.trim().length < 2) return;

    const controller = new AbortController();
    searchRequest.current = controller;
    setIsSearchingPlaces(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getAutocomplete(placeQuery.trim(), undefined, undefined, 10, controller.signal);
        if (controller.signal.aborted) return;
        if (!res.success || !Array.isArray(res.data)) throw new Error();
        setPlaceResults(res.data.filter((item) => item.id && item.title));
      } catch (err) {
        if (!controller.signal.aborted) {
          setPlaceError(getSafeErrorMessage(err, t("partner.location.searchError")));
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingPlaces(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery, selectedPlace, open, step, kind, isClaimMode, searchAttempt, t]);

  // Use one guarded conflict check for both selected places and manual names.
  React.useEffect(() => {
    let active = true;
    const name = selectedPlace?.name || displayName.trim();
    setConflictCandidate(null);
    setIsCheckingConflict(false);
    if (!open || isClaimMode || isResolvingPlace || name.length < 3) return;

    const timer = setTimeout(async () => {
      setIsCheckingConflict(true);
      try {
        const candidates = await searchBusinessCandidates(kind, name);
        if (active) {
          setConflictCandidate(candidates?.find(
            (c) => c.displayName.toLowerCase() === name.toLowerCase(),
          ) || candidates?.[0] || null);
        }
      } catch {
        // Candidate lookup remains advisory; submission is validated server-side.
      } finally {
        if (active) setIsCheckingConflict(false);
      }
    }, 500);

    return () => { active = false; clearTimeout(timer); };
  }, [displayName, kind, selectedPlace, open, isClaimMode, isResolvingPlace]);

  // Debounced Business Candidate Search (for Claim / Appeal)
  React.useEffect(() => {
    if (!isClaimMode) return;
    if (!claimSearchQuery.trim() || claimSearchQuery.trim().length < 2) {
      setCandidateResults([]);
      setIsSearchingCandidates(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingCandidates(true);
        const res = await searchBusinessCandidates(kind, claimSearchQuery.trim());
        setCandidateResults(res || []);
      } catch {
        setCandidateResults([]);
      } finally {
        setIsSearchingCandidates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [claimSearchQuery, isClaimMode, kind]);

  const resetForm = () => {
    searchRequest.current?.abort();
    detailsRequest.current?.abort();
    setIsResolvingPlace(false);
    setPlaceError(null);
    setStep(1);
    setDisplayName("");
    setDescription("");
    setError(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setSelectedPlace(null);
    setConflictCandidate(null);
    setIsCheckingConflict(false);
    setCustomAddress("");
    setTaxCode("");
    setLicenseNumber("");
    setLegalRepresentative("");
    setContactPhone("");
    setProofDocumentUrl("");
    setIsClaimMode(false);
    setClaimSearchQuery("");
    setCandidateResults([]);
    setSelectedCandidate(null);
    setClaimReason("");
    setClaimSuccess(false);
    setSubmittingClaim(false);
  };

  const handleCapabilityToggle = (cap: PartnerCapability) => {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  };

  const changePlaceQuery = (query: string) => {
    searchRequest.current?.abort();
    detailsRequest.current?.abort();
    setIsResolvingPlace(false);
    setIsSearchingPlaces(false);
    setPlaceError(null);
    setPlaceResults([]);
    setSelectedIndex(-1);
    setPlaceQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (placeResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < placeResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : placeResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < placeResults.length) {
        void handleSelectPlace(placeResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setPlaceResults([]);
      setSelectedIndex(-1);
    }
  };

  const handleSelectPlace = async (suggestion: AutocompleteSuggestion) => {
    searchRequest.current?.abort();
    detailsRequest.current?.abort();
    setSelectedIndex(-1);
    const controller = new AbortController();
    detailsRequest.current = controller;
    setIsSearchingPlaces(false);
    setIsResolvingPlace(true);
    setPlaceError(null);
    try {
      const res = await getPlaceDetails(suggestion.id, undefined, undefined, undefined, controller.signal);
      if (controller.signal.aborted) return;
      const place = res.data;
      if (!res.success || !place?.id || !place.name || !place.location ||
          !Number.isFinite(place.location.lat) || !Number.isFinite(place.location.lng) ||
          Math.abs(place.location.lat) > 90 || Math.abs(place.location.lng) > 180 ||
          (place.id !== suggestion.id && place.providerPlaceId !== suggestion.id)) {
        throw new Error();
      }
      setSelectedPlace(place);
      setDisplayName(place.name);
      setCustomAddress(place.address || suggestion.subtitle || "");
      setPlaceQuery("");
      setPlaceResults([]);
    } catch (err) {
      if (!controller.signal.aborted) {
        setPlaceError(getSafeErrorMessage(err, t("partner.location.detailsError")));
      }
    } finally {
      if (!controller.signal.aborted) setIsResolvingPlace(false);
    }
  };

  const handleSubmit = async () => {
    if (isResolvingPlace) return;
    if (!displayName.trim()) {
      setError("Vui lòng nhập tên cơ sở hoặc tên hiển thị.");
      return;
    }

    if ((kind === "HOTEL" || kind === "RESTAURANT") && !selectedPlace && !customAddress.trim()) {
      setError("Vui lòng tìm kiếm chọn địa điểm hoặc nhập địa chỉ cơ sở.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const draftProfile: Record<string, unknown> = {
        bio: description.trim(),
        description: description.trim(),
        address: customAddress.trim() || selectedPlace?.address,
        placeId: selectedPlace?.id || selectedPlace?.providerPlaceId,
        placeName: selectedPlace?.name || displayName.trim(),
        lat: selectedPlace?.location?.lat,
        lng: selectedPlace?.location?.lng,
        taxCode: taxCode.trim(),
        licenseNumber: licenseNumber.trim(),
        legalRepresentative: legalRepresentative.trim(),
        contactPhone: contactPhone.trim(),
        proofDocumentUrl: proofDocumentUrl.trim(),
      };

      // 1. Create Business Draft
      const draft = await createBusinessDraft({
        kind,
        displayName: displayName.trim(),
        draftProfile,
      });

      // 2. Submit Application for Admin Approval
      await submitBusinessApplication(draft.id, {
        expectedVersion: draft.version,
        requestedCapabilities: selectedCapabilities,
        checklistId: `${kind.toLowerCase()}-standard-checklist`,
        checklistVersion: "1.0",
        profileSnapshot: {
          ...draftProfile,
          displayName: displayName.trim(),
        },
      });

      onSuccess?.(draft);
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async () => {
    if (!selectedCandidate) {
      setError("Vui lòng chọn cơ sở bạn muốn kháng cáo quyền quản lý.");
      return;
    }
    if (!claimReason.trim() || claimReason.trim().length < 10) {
      setError("Vui lòng nêu rõ lý do kháng cáo và thông tin giấy phép sở hữu (tối thiểu 10 ký tự).");
      return;
    }

    try {
      setSubmittingClaim(true);
      setError(null);

      const claimDetails = [
        claimReason.trim(),
        taxCode.trim() ? `Mã số thuế: ${taxCode.trim()}` : "",
        licenseNumber.trim() ? `Giấy phép KD: ${licenseNumber.trim()}` : "",
        legalRepresentative.trim() ? `Đại diện pháp luật: ${legalRepresentative.trim()}` : "",
        contactPhone.trim() ? `SĐT: ${contactPhone.trim()}` : "",
        proofDocumentUrl.trim() ? `Minh chứng: ${proofDocumentUrl.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      await createManagementClaim({
        businessId: selectedCandidate.id,
        reason: claimDetails,
      });

      setClaimSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể gửi đơn kháng cáo");
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              {isClaimMode
                ? "Kháng cáo quyền quản lý cơ sở (Management Claim)"
                : step === 1
                  ? "Bước 1: Chọn loại hình đối tác"
                  : step === 2
                    ? "Bước 2: Thông tin cơ sở & minh chứng địa điểm"
                    : "Bước 3: Nhu cầu năng lực vận hành"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isClaimMode
              ? "Gửi yêu cầu tranh chấp quyền quản lý cho Ban Quản trị thẩm định khi địa điểm bị đăng ký trùng lặp."
              : step === 1
                ? "Bạn muốn cung cấp dịch vụ gì trên nền tảng TripSense?"
                : step === 2
                  ? "Tìm kiếm địa điểm, khai báo thông tin pháp lý và minh chứng chủ sở hữu."
                  : "Chọn các chức năng nghiệp vụ bạn muốn xin cấp phép."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CLAIM / APPEAL MODE (Kháng cáo quyền quản lý)                   */}
        {/* ------------------------------------------------------------- */}
        {isClaimMode ? (
          <div className="space-y-4 py-2">
            {claimSuccess ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h3 className="font-semibold text-foreground text-sm">
                  Đã gửi đơn kháng cáo thành công!
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Đơn yêu cầu quyền quản lý cơ sở của bạn đã được chuyển tới Ban Quản trị TripSense.
                  Admin sẽ đối soát minh chứng pháp lý và tài liệu sở hữu giữa các bên theo quy trình
                  bảo mật không tiết lộ chéo.
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  Hoàn tất
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Quy trình giải quyết tranh chấp quyền quản lý</p>
                    <p className="text-[11px] leading-relaxed">
                      Nếu địa điểm hoặc khách sạn của bạn đã bị người khác đăng ký trước, bạn có quyền
                      cung cấp mã số thuế, giấy phép kinh doanh để Admin xem xét chuyển giao quyền sở hữu.
                    </p>
                  </div>
                </div>

                {/* Target Business Lookup */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    1. Tìm cơ sở kinh doanh đã được tạo trên hệ thống
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nhập tên khách sạn / nhà hàng cần kháng cáo..."
                      value={claimSearchQuery}
                      onChange={(e) => setClaimSearchQuery(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>

                  {isSearchingCandidates && (
                    <p className="text-[11px] text-muted-foreground mt-1">Đang tìm cơ sở...</p>
                  )}

                  {candidateResults.length > 0 && !selectedCandidate && (
                    <div className="rounded-lg border border-border bg-card shadow-sm max-h-48 overflow-y-auto divide-y divide-border/60">
                      {candidateResults.map((cand) => (
                        <div
                          key={cand.id}
                          onClick={() => {
                            setSelectedCandidate(cand);
                            setCandidateResults([]);
                            setClaimSearchQuery(cand.displayName);
                          }}
                          className="p-2.5 hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{cand.displayName}</span>
                            <Badge variant="outline" className="text-micro">
                              {cand.kind}
                            </Badge>
                          </div>
                          {cand.address && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{cand.address}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCandidate && (
                    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs mt-2">
                      <div>
                        <span className="font-semibold text-foreground block">
                          {selectedCandidate.displayName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ID: {selectedCandidate.id}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCandidate(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Evidence & Argument Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Mã số thuế doanh nghiệp
                    </label>
                    <Input
                      placeholder="VD: 0101234567"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Số giấy phép ĐKKD
                    </label>
                    <Input
                      placeholder="VD: GP-2024-HN-099"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Đại diện pháp luật
                    </label>
                    <Input
                      placeholder="Họ và tên chủ sở hữu"
                      value={legalRepresentative}
                      onChange={(e) => setLegalRepresentative(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Số điện thoại đối soát
                    </label>
                    <Input
                      placeholder="Số điện thoại liên hệ"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Liên kết tài liệu chứng minh sở hữu (Google Drive, Cloud...)
                  </label>
                  <Input
                    placeholder="https://drive.google.com/..."
                    value={proofDocumentUrl}
                    onChange={(e) => setProofDocumentUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Lý do kháng cáo & căn cứ chứng minh
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Nêu rõ căn cứ sở hữu cơ sở, quá trình phát hiện trùng lặp địa điểm và đề nghị chuyển giao quyền quản lý..."
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsClaimMode(false)}
                    disabled={submittingClaim}
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Quay lại tạo mới
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleClaimSubmit}
                    disabled={submittingClaim || !selectedCandidate}
                  >
                    {submittingClaim ? "Đang gửi đơn..." : "Gửi đơn kháng cáo"}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* STANDARD ONBOARDING WIZARD                                    */
          /* ------------------------------------------------------------- */
          <>
            {/* Step 1: Select Kind */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3 py-3">
                <button
                  type="button"
                  onClick={() => setKind("TOUR_GUIDE")}
                  className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                    kind === "TOUR_GUIDE"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Compass className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Hướng dẫn viên du lịch</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quảng bá bài viết chuyên môn trên Community và nhận yêu cầu tư vấn độc lập từ du khách.
                    </p>
                  </div>
                  {kind === "TOUR_GUIDE" && <Check className="h-5 w-5 text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => setKind("HOTEL")}
                  className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                    kind === "HOTEL"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Khách sạn / Cơ sở lưu trú</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Đăng thông tin phòng, quản lý tồn kho theo đêm và nhận đặt phòng trực tiếp.
                    </p>
                  </div>
                  {kind === "HOTEL" && <Check className="h-5 w-5 text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={() => setKind("RESTAURANT")}
                  className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                    kind === "RESTAURANT"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Utensils className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">Quán ăn / Nhà hàng / Café</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hiển thị menu món ăn, thông tin chỉ đường và liên hệ trực tiếp cho thực khách.
                    </p>
                  </div>
                  {kind === "RESTAURANT" && <Check className="h-5 w-5 text-primary" />}
                </button>

              </div>
            )}

            {/* Step 2: Information & Location Verification */}
            {step === 2 && (
              <div className="space-y-4 py-3">
                {/* Location Search for HOTEL / RESTAURANT */}
                {(kind === "HOTEL" || kind === "RESTAURANT") && (
                  <div className="space-y-2.5 p-3.5 rounded-xl border border-border/80 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <label htmlFor={placeInputId} className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {t("partner.location.label")}
                      </label>
                      {selectedPlace && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" /> {t("partner.location.matched")}
                        </span>
                      )}
                    </div>

                    {!selectedPlace ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={placeInputId}
                          maxLength={200}
                          autoComplete="off"
                          placeholder={t(kind === "HOTEL" ? "partner.location.hotelPlaceholder" : "partner.location.restaurantPlaceholder")}
                          value={placeQuery}
                          onChange={(e) => changePlaceQuery(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="pl-9 pr-14 text-xs"
                        />
                        {(isSearchingPlaces || isResolvingPlace) && (
                          <Loader2 className="absolute right-8 top-2.5 h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                        )}
                        {placeQuery && (
                          <button
                            type="button"
                            aria-label={t("common.clear")}
                            onClick={() => changePlaceQuery("")}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Selected Place Badge */
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <span className="font-semibold text-foreground block truncate">
                            {selectedPlace.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {selectedPlace.address ||
                              (selectedPlace.location
                                ? t("partner.location.coordinates", { lat: selectedPlace.location.lat.toFixed(5), lng: selectedPlace.location.lng.toFixed(5) })
                                : "")}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={t("common.clear")}
                          onClick={() => {
                            setSelectedPlace(null);
                            setConflictCandidate(null);
                            changePlaceQuery("");
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {isResolvingPlace && (
                      <p role="status" className="text-[11px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        {t("partner.location.resolving")}
                      </p>
                    )}
                    {placeError && (
                      <div role="alert" className="text-xs text-destructive">
                        {placeError}
                        {!placeResults.length && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSearchAttempt((n) => n + 1)}>
                            {t("common.retry")}
                          </Button>
                        )}
                      </div>
                    )}
                    {!selectedPlace && placeQuery.trim().length >= 2 && !isSearchingPlaces && !isResolvingPlace && !placeError && !placeResults.length && (
                      <p role="status" className="text-xs text-muted-foreground">{t("partner.location.empty")}</p>
                    )}

                    {isCheckingConflict && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                        {t("partner.location.checkingConflict")}
                      </p>
                    )}

                    {/* Place Dropdown suggestions (aligned with search-bar on dev) */}
                    {placeResults.length > 0 && !selectedPlace && (
                      <div className="rounded-xl border border-border bg-card p-1.5 shadow-lg max-h-52 overflow-y-auto backdrop-blur-md animate-in fade-in-0 zoom-in-95">
                        <div className="text-micro font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5">
                          {t("places.suggestionsTitle", { defaultValue: "Gợi ý địa điểm" })}
                        </div>
                        <ul className="space-y-0.5">
                          {placeResults.map((p, index) => (
                            <li
                              key={p.id || index}
                              onClick={() => void handleSelectPlace(p)}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors",
                                selectedIndex === index
                                  ? "bg-accent text-accent-foreground font-medium"
                                  : "hover:bg-muted text-foreground"
                              )}
                            >
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="truncate font-medium">{p.title}</span>
                                {p.subtitle && (
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {p.subtitle}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conflict / Appeal Notice: ONLY when another partner already claimed this place */}
                    {conflictCandidate && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2 animate-in fade-in-50">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <p className="font-semibold text-foreground">
                              Cơ sở này đã có đối tác tiếp nhận quyền quản lý trên TripSense!
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Cơ sở <strong className="text-foreground">{conflictCandidate.displayName}</strong> hiện đã có đối tác đăng ký quản trị. Nếu bạn là chủ sở hữu hợp pháp hoặc người đại diện được ủy quyền, bạn có thể nộp đơn kháng cáo quyền quản lý kèm giấy phép kinh doanh để được xét duyệt chuyển giao.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCandidate(conflictCandidate);
                              setClaimSearchQuery(conflictCandidate.displayName);
                              setIsClaimMode(true);
                            }}
                            className="h-8 text-xs border-amber-500/40 bg-card hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium shadow-xs"
                          >
                            <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                            Nộp đơn kháng cáo quyền quản lý
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Display Name */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    {kind === "TOUR_GUIDE"
                      ? "Tên hướng dẫn viên / Danh xưng chuyên môn"
                      : "Tên cơ sở kinh doanh chính thức"}
                  </label>
                  <Input
                    placeholder={
                      kind === "TOUR_GUIDE"
                        ? "VD: Lê Tuấn Anh - Hướng dẫn viên Di sản Hội An"
                        : "VD: Khách sạn Riverside Heritage"
                    }
                    value={displayName}
                    disabled={isResolvingPlace}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                {/* Custom Address (if hotel/restaurant) */}
                {(kind === "HOTEL" || kind === "RESTAURANT") && (
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Địa chỉ chi tiết cơ sở
                    </label>
                    <Input
                      placeholder="VD: Số 123 Đường Trần Phú, Phường Minh An, TP. Hội An"
                      value={customAddress}
                      disabled={isResolvingPlace}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                )}

                {/* Legal & Ownership Proof (HOTEL / RESTAURANT) */}
                {(kind === "HOTEL" || kind === "RESTAURANT") && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Minh chứng pháp lý & quyền sở hữu
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Mã số thuế doanh nghiệp / Hộ kinh doanh
                        </label>
                        <Input
                          placeholder="VD: 0401234567"
                          value={taxCode}
                          onChange={(e) => setTaxCode(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Số Giấy phép kinh doanh / ĐKKD
                        </label>
                        <Input
                          placeholder="VD: GP-2023-HA-012"
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Người đại diện pháp luật
                        </label>
                        <Input
                          placeholder="Họ và tên chủ sở hữu"
                          value={legalRepresentative}
                          onChange={(e) => setLegalRepresentative(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Số điện thoại liên hệ xác minh
                        </label>
                        <Input
                          placeholder="VD: 0912345678"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Liên kết tài liệu minh chứng (Giấy phép kinh doanh, Giấy chứng nhận quyền sở hữu)
                      </label>
                      <Input
                        placeholder="https://drive.google.com/file/d/..."
                        value={proofDocumentUrl}
                        onChange={(e) => setProofDocumentUrl(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Description / Bio */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Tóm tắt giới thiệu / Kinh nghiệm
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Mô tả ngắn gọn về chuyên môn, tiện ích cơ sở và dịch vụ trải nghiệm..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Capabilities */}
            {step === 3 && (
              <div className="space-y-3 py-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Các năng lực này sẽ được Admin đối soát với hồ sơ minh chứng của bạn khi xét duyệt:
                </p>

                {kind === "TOUR_GUIDE" && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("GUIDE_LISTING")}
                        onChange={() => handleCapabilityToggle("GUIDE_LISTING")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Hồ sơ công khai (GUIDE_LISTING)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Xuất hiện trên danh mục hướng dẫn viên của TripSense
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("GUIDE_PROMOTION")}
                        onChange={() => handleCapabilityToggle("GUIDE_PROMOTION")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Đăng bài quảng bá (GUIDE_PROMOTION)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Soạn và phân phối các gói giới thiệu chuyên môn qua Community
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("GUIDE_INQUIRY")}
                        onChange={() => handleCapabilityToggle("GUIDE_INQUIRY")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Nhận yêu cầu tư vấn (GUIDE_INQUIRY)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Tiếp nhận nhu cầu, gửi phương án tư vấn và trao đổi trực tiếp
                        </span>
                      </div>
                    </label>
                  </>
                )}

                {kind === "HOTEL" && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("HOTEL_LISTING")}
                        onChange={() => handleCapabilityToggle("HOTEL_LISTING")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Hiển thị khách sạn (HOTEL_LISTING)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Trang thông tin cơ sở lưu trú và tiện ích gắn với địa điểm đã xác minh
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("HOTEL_INVENTORY")}
                        onChange={() => handleCapabilityToggle("HOTEL_INVENTORY")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Quản lý tồn kho phòng (HOTEL_INVENTORY)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Cập nhật số lượng phòng theo ngày và trạng thái buồng phòng
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("HOTEL_BOOKING")}
                        onChange={() => handleCapabilityToggle("HOTEL_BOOKING")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Nhận đặt phòng trực tiếp (HOTEL_BOOKING)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Cho phép khách giữ phòng và thanh toán đặt phòng qua cổng đối tác
                        </span>
                      </div>
                    </label>
                  </>
                )}

                {kind === "RESTAURANT" && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("RESTAURANT_LISTING")}
                        onChange={() => handleCapabilityToggle("RESTAURANT_LISTING")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Hiển thị địa điểm ẩm thực (RESTAURANT_LISTING)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Giới thiệu quán ăn, giờ mở cửa và địa chỉ đã xác minh
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes("RESTAURANT_MENU")}
                        onChange={() => handleCapabilityToggle("RESTAURANT_MENU")}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold block">Thực đơn & bảng giá (RESTAURANT_MENU)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Đăng tải các món ăn và mức giá tham khảo
                        </span>
                      </div>
                    </label>
                  </>
                )}
              </div>
            )}

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isResolvingPlace}
                  onClick={() => {
                    if (step === 2) {
                      if (!displayName.trim()) {
                        setError("Vui lòng nhập tên hiển thị");
                        return;
                      }
                      if ((kind === "HOTEL" || kind === "RESTAURANT") && !selectedPlace && !customAddress.trim()) {
                        setError("Vui lòng tìm kiếm chọn địa điểm hoặc nhập địa chỉ cơ sở");
                        return;
                      }
                    }
                    setError(null);
                    setStep((s) => (s + 1) as 2 | 3);
                  }}
                >
                  Tiếp tục <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={loading || isResolvingPlace || selectedCapabilities.length === 0}
                >
                  {loading ? "Đang gửi hồ sơ..." : "Nộp hồ sơ xét duyệt"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
