"use client";

import * as React from "react";
import Image from "next/image";
import {
  Landmark,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Copy,
  Check,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Zap,
  Building,
  User,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hotelApi } from "../services/hotels-api";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  AdminFinanceOverview,
  PartnerWithdrawalRequest,
  CustomerRefundRequest,
  FinancialLedgerEntry,
  buildVietQrUrl,
} from "../types";

export function AdminFinanceView() {
  const [overview, setOverview] = React.useState<AdminFinanceOverview | null>(null);
  const [withdrawals, setWithdrawals] = React.useState<PartnerWithdrawalRequest[]>([]);
  const [refunds, setRefunds] = React.useState<CustomerRefundRequest[]>([]);
  const [ledger, setLedger] = React.useState<FinancialLedgerEntry[]>([]);
  const [activeTab, setActiveTab] = React.useState<"withdrawals" | "refunds" | "ledger">("withdrawals");
  const [withdrawalFilter, setWithdrawalFilter] = React.useState<string>("ALL");
  const [refundFilter, setRefundFilter] = React.useState<string>("ALL");

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // VietQR Payout Modal for Partner Withdrawal
  const [selectedWithdrawal, setSelectedWithdrawal] = React.useState<PartnerWithdrawalRequest | null>(null);
  const [bankRefCode, setBankRefCode] = React.useState("");
  const [adminNotes, setAdminNotes] = React.useState("");
  const [completingWithdrawal, setCompletingWithdrawal] = React.useState(false);

  // Reject Withdrawal Modal
  const [rejectingWithdrawal, setRejectingWithdrawal] = React.useState<PartnerWithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [submittingReject, setSubmittingReject] = React.useState(false);

  // VietQR Refund Modal for Customer Refund
  const [selectedRefund, setSelectedRefund] = React.useState<CustomerRefundRequest | null>(null);
  const [refundBankRefCode, setRefundBankRefCode] = React.useState("");
  const [refundAdminNotes, setRefundAdminNotes] = React.useState("");
  const [completingRefund, setCompletingRefund] = React.useState(false);

  // Reject Customer Refund Modal
  const [rejectingRefund, setRejectingRefund] = React.useState<CustomerRefundRequest | null>(null);
  const [refundRejectionReason, setRefundRejectionReason] = React.useState("");
  const [submittingRefundReject, setSubmittingRefundReject] = React.useState(false);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadData = React.useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, withdrawalsRes, refundsRes, ledgerRes] = await Promise.all([
        hotelApi<AdminFinanceOverview>("/admin/finance/overview"),
        hotelApi<PartnerWithdrawalRequest[]>("/admin/finance/withdrawals"),
        hotelApi<CustomerRefundRequest[]>("/admin/finance/refunds"),
        hotelApi<FinancialLedgerEntry[]>("/admin/finance/ledger"),
      ]);

      setOverview(overviewRes);
      setWithdrawals(withdrawalsRes || []);
      setRefunds(refundsRes || []);
      setLedger(ledgerRes || []);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Không thể tải dữ liệu tài chính quản trị"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Payout Completion
  const handleCompleteWithdrawal = async (isDemo = false) => {
    if (!selectedWithdrawal) return;
    setCompletingWithdrawal(true);
    setError(null);
    try {
      await hotelApi(`/admin/finance/withdrawals/${selectedWithdrawal.id}/complete`, "POST", {
        adminNotes: adminNotes.trim() || (isDemo ? "Duyệt nhanh chế độ thử nghiệm" : undefined),
        bankReferenceCode: isDemo ? `DEMO-REF-${Date.now().toString().slice(-6)}` : bankRefCode.trim(),
      });
      setSuccessMsg(`Đã duyệt chi ${money(selectedWithdrawal.amount, selectedWithdrawal.currency)} thành công cho đối tác!`);
      setSelectedWithdrawal(null);
      setBankRefCode("");
      setAdminNotes("");
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Duyệt yêu cầu rút tiền thất bại"));
    } finally {
      setCompletingWithdrawal(false);
    }
  };

  // Payout Rejection
  const handleRejectWithdrawal = async () => {
    if (!rejectingWithdrawal) return;
    if (!rejectionReason.trim()) {
      setError("Vui lòng nhập lý do từ chối");
      return;
    }
    setSubmittingReject(true);
    setError(null);
    try {
      await hotelApi(`/admin/finance/withdrawals/${rejectingWithdrawal.id}/reject`, "POST", {
        reason: rejectionReason.trim(),
      });
      setSuccessMsg("Đã từ chối yêu cầu rút tiền. Số dư đã được hoàn lại ví đối tác.");
      setRejectingWithdrawal(null);
      setRejectionReason("");
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Từ chối yêu cầu thất bại"));
    } finally {
      setSubmittingReject(false);
    }
  };

  // Refund Completion
  const handleCompleteRefund = async (isDemo = false) => {
    if (!selectedRefund) return;
    setCompletingRefund(true);
    setError(null);
    try {
      await hotelApi(`/admin/finance/refunds/${selectedRefund.id}/complete`, "POST", {
        adminNotes: refundAdminNotes.trim() || (isDemo ? "Hoàn tiền nhanh qua cổng VietQR" : undefined),
        bankReferenceCode: isDemo ? `DEMO-REF-${Date.now().toString().slice(-6)}` : refundBankRefCode.trim(),
      });
      setSuccessMsg(`Đã hoàn tiền ${money(selectedRefund.amount, selectedRefund.currency)} cho khách hàng thành công!`);
      setSelectedRefund(null);
      setRefundBankRefCode("");
      setRefundAdminNotes("");
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Hoàn tiền cho khách hàng thất bại"));
    } finally {
      setCompletingRefund(false);
    }
  };

  // Refund Rejection
  const handleRejectRefund = async () => {
    if (!rejectingRefund) return;
    if (!refundRejectionReason.trim()) {
      setError("Vui lòng nhập lý do từ chối hoàn tiền");
      return;
    }
    setSubmittingRefundReject(true);
    setError(null);
    try {
      await hotelApi(`/admin/finance/refunds/${rejectingRefund.id}/reject`, "POST", {
        reason: refundRejectionReason.trim(),
      });
      setSuccessMsg("Đã từ chối yêu cầu hoàn tiền.");
      setRejectingRefund(null);
      setRefundRejectionReason("");
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Từ chối hoàn tiền thất bại"));
    } finally {
      setSubmittingRefundReject(false);
    }
  };

  const money = (val: number, cur = "VND") =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: cur }).format(val);

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === "ALL") return true;
    if (withdrawalFilter === "PENDING") {
      return w.status === "PENDING" || w.status === "PENDING_REVIEW" || w.status === "PROCESSING";
    }
    if (withdrawalFilter === "APPROVED") {
      return w.status === "APPROVED" || w.status === "COMPLETED";
    }
    if (withdrawalFilter === "REJECTED") {
      return w.status === "REJECTED";
    }
    return w.status === withdrawalFilter;
  });

  const filteredRefunds = refunds.filter((r) => {
    if (refundFilter === "ALL") return true;
    if (refundFilter === "PENDING") {
      return r.status === "PENDING" || r.status === "PENDING_REVIEW" || r.status === "PROCESSING";
    }
    if (refundFilter === "COMPLETED") {
      return r.status === "COMPLETED" || r.status === "REFUNDED";
    }
    if (refundFilter === "REJECTED") {
      return r.status === "REJECTED";
    }
    return r.status === refundFilter;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/40" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="h-28 rounded-2xl bg-muted/30" />
          <div className="h-28 rounded-2xl bg-muted/30" />
          <div className="h-28 rounded-2xl bg-muted/30" />
          <div className="h-28 rounded-2xl bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">{error}</div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 text-xs">
            Đóng
          </Button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="flex-1">{successMsg}</div>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} className="h-7 text-xs">
            Đóng
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Landmark className="h-6 w-6 text-primary" />
            <span>Trung tâm Quản trị Tài chính & Đối soát Toàn hệ thống</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Mô hình NAPAS 247 Dynamic VietQR Bán Tự Động: Tự động tính toán hoa hồng 10%, hiển thị mã QR kèm STK & số tiền chính xác để admin quét chuyển khoản từ ứng dụng ngân hàng cá nhân bất kỳ.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9 gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Làm mới số liệu</span>
          </Button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total GMV */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng GMV Khách Đã Trả</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              {money(overview.totalGmv)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Toàn bộ dòng tiền khách đã thanh toán
            </p>
          </div>

          {/* Card 2: Escrow Holding */}
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tạm giữ Escrow (Bảo chứng)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {money(overview.escrowHolding)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tiền phòng chưa check-out, an toàn trước rủi ro
            </p>
          </div>

          {/* Card 3: Platform Revenue (10%) */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Doanh thu Nền tảng (10% Phí)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {money(overview.platformRevenue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Doanh thu thực nhận sau khi hoàn tất đơn
            </p>
          </div>

          {/* Card 4: Partner Payable */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Nợ phải trả Đối tác</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Building className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-primary">
              {money(overview.partnerPayable)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Số dư trong ví các chủ khách sạn
            </p>
          </div>
        </div>
      )}

      {/* Action Banner if there are pending actions */}
      {overview && (overview.pendingWithdrawalCount > 0 || overview.pendingRefundCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overview.pendingWithdrawalCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Có {overview.pendingWithdrawalCount} yêu cầu rút tiền từ khách sạn
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Tổng số tiền cần chi trả: <span className="font-semibold text-foreground">{money(overview.pendingWithdrawalAmount)}</span>
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => { setActiveTab("withdrawals"); setWithdrawalFilter("PENDING"); }} className="h-8 text-xs shrink-0">
                Xử lý ngay
              </Button>
            </div>
          )}

          {overview.pendingRefundCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Có {overview.pendingRefundCount} yêu cầu hoàn tiền từ du khách
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Tổng số tiền cần hoàn: <span className="font-semibold text-foreground">{money(overview.pendingRefundAmount)}</span>
                  </p>
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => { setActiveTab("refunds"); setRefundFilter("PENDING"); }} className="h-8 text-xs shrink-0">
                Hoàn tiền ngay
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("withdrawals")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "withdrawals"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building className="h-4 w-4" />
            <span>Yêu cầu Rút tiền Đối tác ({withdrawals.length})</span>
            {overview && overview.pendingWithdrawalCount > 0 && (
              <Badge className="h-5 px-1.5 text-micro bg-amber-500 text-white hover:bg-amber-500">
                {overview.pendingWithdrawalCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("refunds")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "refunds"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Hàng đợi Hoàn tiền Khách hàng ({refunds.length})</span>
            {overview && overview.pendingRefundCount > 0 && (
              <Badge className="h-5 px-1.5 text-micro bg-destructive text-white hover:bg-destructive">
                {overview.pendingRefundCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "ledger"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Sổ cái Đối soát Toàn hệ thống ({ledger.length})</span>
          </button>
        </div>

        {/* Tab 1: Partner Withdrawals */}
        {activeTab === "withdrawals" && (
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Lọc theo trạng thái:</span>
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={withdrawalFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setWithdrawalFilter(filter)}
                >
                  {filter === "ALL" && "Tất cả"}
                  {filter === "PENDING" && "Chờ duyệt"}
                  {filter === "APPROVED" && "Đã chuyển khoản"}
                  {filter === "REJECTED" && "Đã từ chối"}
                </Button>
              ))}
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <Building className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Không có yêu cầu rút tiền nào theo bộ lọc.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Thời gian</th>
                      <th className="p-3.5 font-medium">Cơ sở / Đối tác</th>
                      <th className="p-3.5 font-medium">Số tiền rút</th>
                      <th className="p-3.5 font-medium">Tài khoản nhận (NAPAS 247)</th>
                      <th className="p-3.5 font-medium">Trạng thái</th>
                      <th className="p-3.5 font-medium text-right">Hành động duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/20">
                        <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                          {new Date(w.created_at).toLocaleString("vi-VN")}
                          <div className="font-mono text-micro text-muted-foreground/70">#{w.id.slice(0, 8)}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono text-[11px] text-foreground">ID: {w.business_id.slice(0, 8)}</div>
                          {w.partner_notes && (
                            <div className="text-[11px] text-muted-foreground italic mt-0.5">&quot;{w.partner_notes}&quot;</div>
                          )}
                        </td>
                        <td className="p-3.5 font-bold text-foreground text-sm">
                          {money(w.amount, w.currency)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{w.bank_name || w.bank_code}</div>
                          <div className="font-mono text-xs text-primary flex items-center gap-1.5">
                            <span>{w.account_number}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(w.account_number, `w-acc-${w.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Sao chép STK"
                            >
                              {copiedId === `w-acc-${w.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{w.account_holder_name}</div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {(w.status === "PENDING" || w.status === "PENDING_REVIEW" || w.status === "PROCESSING") && (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-micro">
                              <Clock className="mr-1 h-3 w-3" /> Chờ admin duyệt
                            </Badge>
                          )}
                          {(w.status === "APPROVED" || w.status === "COMPLETED") && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Đã chi trả
                            </Badge>
                          )}
                          {w.status === "REJECTED" && (
                            <Badge variant="destructive" className="text-micro">
                              <XCircle className="mr-1 h-3 w-3" /> Đã từ chối
                            </Badge>
                          )}
                          {w.bank_reference_code && (
                            <div className="font-mono text-micro text-muted-foreground mt-1">Ref: {w.bank_reference_code}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {(w.status === "PENDING" || w.status === "PENDING_REVIEW" || w.status === "PROCESSING") ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => setSelectedWithdrawal(w)}
                                className="h-8 gap-1.5 text-xs font-semibold"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>Quét VietQR Chuyển Tiền</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejectingWithdrawal(w)}
                                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Đã xử lý</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Customer Refunds */}
        {activeTab === "refunds" && (
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Lọc theo trạng thái:</span>
              {(["ALL", "PENDING", "COMPLETED", "REJECTED"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={refundFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRefundFilter(filter)}
                >
                  {filter === "ALL" && "Tất cả"}
                  {filter === "PENDING" && "Chờ hoàn tiền"}
                  {filter === "COMPLETED" && "Đã hoàn tất"}
                  {filter === "REJECTED" && "Đã từ chối"}
                </Button>
              ))}
            </div>

            {filteredRefunds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <User className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Chưa có yêu cầu hoàn tiền nào từ khách hàng.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Thời gian</th>
                      <th className="p-3.5 font-medium">Khách hàng & Đơn</th>
                      <th className="p-3.5 font-medium">Số tiền hoàn</th>
                      <th className="p-3.5 font-medium">Tài khoản nhận hoàn tiền</th>
                      <th className="p-3.5 font-medium">Lý do hủy đơn</th>
                      <th className="p-3.5 font-medium">Trạng thái</th>
                      <th className="p-3.5 font-medium text-right">Hành động hoàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRefunds.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("vi-VN")}
                          <div className="font-mono text-micro text-muted-foreground/70">#{r.id.slice(0, 8)}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{r.property_name || "Đặt phòng"}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">Đơn: #{r.booking_id.slice(0, 8)}</div>
                        </td>
                        <td className="p-3.5 font-bold text-destructive text-sm">
                          {money(r.amount, r.currency)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{r.bank_name || r.bank_code}</div>
                          <div className="font-mono text-xs text-primary flex items-center gap-1.5">
                            <span>{r.account_number}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(r.account_number, `r-acc-${r.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Sao chép STK"
                            >
                              {copiedId === `r-acc-${r.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{r.account_holder_name}</div>
                        </td>
                        <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                          {r.cancellation_reason || "Khách yêu cầu hủy phòng"}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {(r.status === "PENDING" || r.status === "PENDING_REVIEW" || r.status === "PROCESSING") && (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-micro">
                              <Clock className="mr-1 h-3 w-3" /> Chờ hoàn tiền
                            </Badge>
                          )}
                          {(r.status === "COMPLETED" || r.status === "REFUNDED") && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Đã hoàn tiền
                            </Badge>
                          )}
                          {r.status === "REJECTED" && (
                            <Badge variant="destructive" className="text-micro">
                              <XCircle className="mr-1 h-3 w-3" /> Từ chối
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {(r.status === "PENDING" || r.status === "PENDING_REVIEW" || r.status === "PROCESSING") ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => setSelectedRefund(r)}
                                className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>Quét VietQR Hoàn Tiền</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejectingRefund(r)}
                                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Đã xử lý</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Global Ledger */}
        {activeTab === "ledger" && (
          <div className="space-y-3">
            {ledger.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <FileSpreadsheet className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Chưa có giao dịch nào được ghi vào sổ cái.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Thời gian</th>
                      <th className="p-3.5 font-medium">Loại giao dịch</th>
                      <th className="p-3.5 font-medium">Đối tác / Cơ sở</th>
                      <th className="p-3.5 font-medium">Số tiền biến động</th>
                      <th className="p-3.5 font-medium">Số dư sau GD</th>
                      <th className="p-3.5 font-medium">Chi tiết diễn giải</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.map((entry) => {
                      const isPositive = entry.amount > 0;
                      return (
                        <tr key={entry.id} className="hover:bg-muted/20">
                          <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString("vi-VN")}
                          </td>
                          <td className="p-3.5">
                            <Badge variant="outline" className="font-mono text-micro">
                              {entry.entry_type}
                            </Badge>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                            {entry.business_id ? `#${entry.business_id.slice(0, 8)}` : "HỆ THỐNG"}
                          </td>
                          <td className="p-3.5 font-semibold">
                            <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                              {isPositive ? "+" : ""}{money(entry.amount, entry.currency)}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {entry.balance_after !== undefined ? money(entry.balance_after, entry.currency) : "-"}
                          </td>
                          <td className="p-3.5 text-muted-foreground max-w-sm truncate">
                            {entry.description || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Partner Withdrawal VietQR Payout */}
      {selectedWithdrawal && (
        <Dialog open={!!selectedWithdrawal} onOpenChange={(open) => { if (!open) setSelectedWithdrawal(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6">
            <DialogHeader className="pr-8 pb-2 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <QrCode className="h-5 w-5 text-primary" />
                <span>Chi trả cho Đối tác qua VietQR NAPAS 247</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Mở ứng dụng ngân hàng bất kỳ trên điện thoại của bạn, quét mã QR dưới đây để chuyển khoản cho chủ khách sạn.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* 2-Column Grid: Left QR, Right Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Dynamic VietQR Image */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white p-3.5 text-center shadow-xs">
                  <Image
                    src={buildVietQrUrl({
                      bankCode: selectedWithdrawal.bank_code,
                      accountNumber: selectedWithdrawal.account_number,
                      accountName: selectedWithdrawal.account_holder_name,
                      amount: selectedWithdrawal.amount,
                      description: `TRIPSENSE RUT ${selectedWithdrawal.id.slice(0, 8)}`,
                    })}
                    alt="VietQR Payout"
                    width={210}
                    height={210}
                    className="rounded-lg shadow-2xs"
                    unoptimized
                  />
                  <p className="text-[11px] text-zinc-600 mt-2 font-medium">
                    Mã QR chứa sẵn STK, tên chủ tài khoản & số tiền
                  </p>
                </div>

                {/* Transfer Details Card */}
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ngân hàng:</span>
                    <span className="font-semibold text-foreground text-right">{selectedWithdrawal.bank_name || selectedWithdrawal.bank_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground text-sm">{selectedWithdrawal.account_number}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedWithdrawal.account_number, "payout-acc")}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Sao chép STK"
                      >
                        {copiedId === "payout-acc" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Chủ tài khoản:</span>
                    <span className="font-semibold text-foreground uppercase">{selectedWithdrawal.account_holder_name}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/70 pt-2">
                    <span className="text-muted-foreground">Số tiền chuyển:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-primary text-base">{money(selectedWithdrawal.amount, selectedWithdrawal.currency)}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedWithdrawal.amount.toString(), "payout-amt")}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Sao chép số tiền"
                      >
                        {copiedId === "payout-amt" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Nội dung CK:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-foreground text-[11px]">TRIPSENSE RUT {selectedWithdrawal.id.slice(0, 8)}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`TRIPSENSE RUT ${selectedWithdrawal.id.slice(0, 8)}`, "payout-memo")}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Sao chép nội dung"
                      >
                        {copiedId === "payout-memo" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Input for Bank Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="bankRef" className="text-xs font-medium">Mã tham chiếu ngân hàng (Sau khi CK)</Label>
                  <Input
                    id="bankRef"
                    placeholder="Ví dụ: FT2610189999..."
                    value={bankRefCode}
                    onChange={(e) => setBankRefCode(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminNote" className="text-xs font-medium">Ghi chú đối soát (Tùy chọn)</Label>
                  <Input
                    id="adminNote"
                    placeholder="Ghi chú thêm..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCompleteWithdrawal(true)}
                  disabled={completingWithdrawal}
                  className="gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                  title="Duyệt nhanh để kiểm thử luồng mà không cần quét mã thật"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>⚡ Duyệt Nhanh (Demo Mode)</span>
                </Button>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWithdrawal(null)}>
                    Đóng
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={completingWithdrawal || !bankRefCode.trim()}
                    onClick={() => handleCompleteWithdrawal(false)}
                    className="gap-1.5 font-semibold"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{completingWithdrawal ? "Đang xử lý..." : "Xác nhận đã chuyển"}</span>
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Customer Refund VietQR Modal */}
      {selectedRefund && (
        <Dialog open={!!selectedRefund} onOpenChange={(open) => { if (!open) setSelectedRefund(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6">
            <DialogHeader className="pr-8 pb-2 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <QrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Hoàn tiền cho Khách qua VietQR NAPAS 247</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Khách hàng đã hủy đơn. Quét mã QR dưới đây từ ứng dụng ngân hàng của bạn để hoàn lại tiền phòng cho khách.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* 2-Column Grid: Left QR, Right Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Dynamic VietQR Image */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white p-3.5 text-center shadow-xs">
                  <Image
                    src={buildVietQrUrl({
                      bankCode: selectedRefund.bank_code,
                      accountNumber: selectedRefund.account_number,
                      accountName: selectedRefund.account_holder_name,
                      amount: selectedRefund.amount,
                      description: `TRIPSENSE HOAN TIEN ${selectedRefund.booking_id.slice(0, 8)}`,
                    })}
                    alt="VietQR Refund"
                    width={210}
                    height={210}
                    className="rounded-lg shadow-2xs"
                    unoptimized
                  />
                  <p className="text-[11px] text-zinc-600 mt-2 font-medium">
                    Quét mã để chuyển hoàn tiền trực tiếp cho khách
                  </p>
                </div>

                {/* Details Card */}
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Khách sạn:</span>
                    <span className="font-semibold text-foreground text-right">{selectedRefund.property_name || "Khách sạn"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ngân hàng:</span>
                    <span className="font-semibold text-foreground text-right">{selectedRefund.bank_name || selectedRefund.bank_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground text-sm">{selectedRefund.account_number}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedRefund.account_number, "refund-acc")}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Sao chép STK"
                      >
                        {copiedId === "refund-acc" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tên thụ hưởng:</span>
                    <span className="font-semibold text-foreground uppercase">{selectedRefund.account_holder_name}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/70 pt-2">
                    <span className="text-muted-foreground">Số tiền hoàn:</span>
                    <span className="font-bold text-destructive text-base">{money(selectedRefund.amount, selectedRefund.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lý do hủy:</span>
                    <span className="text-muted-foreground italic truncate max-w-[150px]">{selectedRefund.cancellation_reason || "Khách hủy phòng"}</span>
                  </div>
                </div>
              </div>

              {/* Form Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="refundBankRef" className="text-xs font-medium">Mã giao dịch ngân hàng</Label>
                  <Input
                    id="refundBankRef"
                    placeholder="Ví dụ: FT2610188888..."
                    value={refundBankRefCode}
                    onChange={(e) => setRefundBankRefCode(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="refundAdminNote" className="text-xs font-medium">Ghi chú đối soát</Label>
                  <Input
                    id="refundAdminNote"
                    placeholder="Ghi chú thêm..."
                    value={refundAdminNotes}
                    onChange={(e) => setRefundAdminNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCompleteRefund(true)}
                  disabled={completingRefund}
                  className="gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>⚡ Hoàn Nhanh (Demo Mode)</span>
                </Button>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRefund(null)}>
                    Đóng
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={completingRefund || !refundBankRefCode.trim()}
                    onClick={() => handleCompleteRefund(false)}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{completingRefund ? "Đang xử lý..." : "Xác nhận đã hoàn tiền"}</span>
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Reject Withdrawal */}
      {rejectingWithdrawal && (
        <Dialog open={!!rejectingWithdrawal} onOpenChange={(open) => { if (!open) setRejectingWithdrawal(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Từ chối Yêu cầu Rút tiền</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Số tiền sẽ được hoàn trả lại ví khả dụng của đối tác kèm lý do từ chối.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rejectReason" className="text-xs font-medium">Lý do từ chối (*)</Label>
                <Input
                  id="rejectReason"
                  placeholder="Ví dụ: Sai thông tin tài khoản ngân hàng thụ hưởng..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectingWithdrawal(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={submittingReject || !rejectionReason.trim()}
                onClick={handleRejectWithdrawal}
              >
                {submittingReject ? "Đang xử lý..." : "Xác nhận từ chối"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Reject Customer Refund */}
      {rejectingRefund && (
        <Dialog open={!!rejectingRefund} onOpenChange={(open) => { if (!open) setRejectingRefund(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Từ chối Yêu cầu Hoàn tiền</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Vui lòng cung cấp lý do từ chối hoàn tiền cho khách hàng.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="refundRejectReason" className="text-xs font-medium">Lý do từ chối (*)</Label>
                <Input
                  id="refundRejectReason"
                  placeholder="Ví dụ: Đơn đã qua thời hạn hủy phòng theo chính sách..."
                  value={refundRejectionReason}
                  onChange={(e) => setRefundRejectionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectingRefund(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={submittingRefundReject || !refundRejectionReason.trim()}
                onClick={handleRejectRefund}
              >
                {submittingRefundReject ? "Đang xử lý..." : "Xác nhận từ chối"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
