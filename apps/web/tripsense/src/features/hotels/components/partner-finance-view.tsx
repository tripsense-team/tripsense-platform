"use client";

import * as React from "react";
import {
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Building,
  CreditCard,
  History,
  FileSpreadsheet,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
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
  PartnerWalletSummary,
  PartnerWithdrawalRequest,
  FinancialLedgerEntry,
  POPULAR_BANKS,
} from "../types";

interface StatementRow {
  booking_id: string;
  property_name: string;
  room_name: string;
  booking_status: string;
  amount: number;
  commission_amount: number;
  partner_amount: number;
  currency: string;
  payment_state: string;
  settlement_state: string;
}

export function PartnerFinanceView({ businessId }: { businessId?: string }) {
  const [wallet, setWallet] = React.useState<PartnerWalletSummary | null>(null);
  const [withdrawals, setWithdrawals] = React.useState<PartnerWithdrawalRequest[]>([]);
  const [ledger, setLedger] = React.useState<FinancialLedgerEntry[]>([]);
  const [statements, setStatements] = React.useState<StatementRow[]>([]);
  const [activeTab, setActiveTab] = React.useState<"withdrawals" | "ledger" | "statements">("withdrawals");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Modals
  const [withdrawModalOpen, setWithdrawModalOpen] = React.useState(false);
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>("");
  const [withdrawNotes, setWithdrawNotes] = React.useState<string>("");
  const [submittingWithdraw, setSubmittingWithdraw] = React.useState(false);

  const [bankModalOpen, setBankModalOpen] = React.useState(false);
  const [bankCode, setBankCode] = React.useState<string>("MB");
  const [accountNumber, setAccountNumber] = React.useState<string>("");
  const [accountHolderName, setAccountHolderName] = React.useState<string>("");
  const [branchName, setBranchName] = React.useState<string>("");
  const [submittingBank, setSubmittingBank] = React.useState(false);

  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const loadData = React.useCallback(async () => {
    try {
      setError(null);
      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";

      const [walletRes, withdrawalsRes, ledgerRes, statementsRes] = await Promise.all([
        hotelApi<PartnerWalletSummary>(`/finance/summary${query}`),
        hotelApi<PartnerWithdrawalRequest[]>(`/finance/withdrawals${query}`),
        hotelApi<FinancialLedgerEntry[]>(`/finance/ledger${query}`),
        hotelApi<StatementRow[]>(`/commerce${query}`),
      ]);

      setWallet(walletRes);
      setWithdrawals(withdrawalsRes || []);
      setLedger(ledgerRes || []);
      setStatements(statementsRes || []);

      if (walletRes?.payout_account) {
        setBankCode(walletRes.payout_account.bank_code || "MB");
        setAccountNumber(walletRes.payout_account.account_number || "");
        setAccountHolderName(walletRes.payout_account.account_holder_name || "");
        setBranchName(walletRes.payout_account.branch_name || "");
      }
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Không thể tải dữ liệu tài chính của đối tác"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet?.business_id) return;
    setSubmittingBank(true);
    setError(null);
    try {
      const selectedBank = POPULAR_BANKS.find((b) => b.code === bankCode);
      await hotelApi(`/finance/payout-account?businessId=${encodeURIComponent(wallet.business_id)}`, "PUT", {
        bankCode,
        bankName: selectedBank ? selectedBank.name : bankCode,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
        branchName: branchName.trim() || undefined,
      });
      setSuccessMsg("Cập nhật tài khoản ngân hàng thụ hưởng thành công!");
      setBankModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Không thể cập nhật tài khoản ngân hàng"));
    } finally {
      setSubmittingBank(false);
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 1000) {
      setError("Số tiền rút tối thiểu là 1.000 VND");
      return;
    }
    if (amountNum > wallet.available_balance) {
      setError("Số tiền rút vượt quá số dư khả dụng hiện tại");
      return;
    }
    if (!wallet.payout_account) {
      setError("Vui lòng thiết lập tài khoản ngân hàng thụ hưởng trước khi rút tiền");
      return;
    }

    setSubmittingWithdraw(true);
    setError(null);
    try {
      await hotelApi(`/finance/withdrawals?businessId=${encodeURIComponent(wallet.business_id)}`, "POST", {
        amount: amountNum,
      });
      setSuccessMsg(`Yêu cầu rút ${money(amountNum, wallet.currency)} đã được gửi thành công! Admin sẽ xử lý chuyển khoản sớm.`);
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      await loadData();
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, "Gửi yêu cầu rút tiền thất bại"));
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const money = (val: number, cur = "VND") =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: cur }).format(val);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 rounded-2xl bg-muted/30" />
          <div className="h-32 rounded-2xl bg-muted/30" />
          <div className="h-32 rounded-2xl bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
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

      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-primary" />
            <span>Ví Đối tác & Doanh thu Khách sạn</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Minh bạch dòng tiền: Tiền khách thanh toán được bảo lưu an toàn trong Escrow và tự động quyết toán 90% về ví khi khách hoàn tất lưu trú.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9 gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setWithdrawModalOpen(true)}
            disabled={!wallet || wallet.available_balance <= 0}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Yêu cầu rút tiền</span>
          </Button>
        </div>
      </div>

      {/* KPI Balances */}
      {wallet && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Available Balance */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Số dư khả dụng (Có thể rút ngay)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-primary">
                {money(wallet.available_balance, wallet.currency)}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Tổng đã rút: {money(wallet.total_withdrawn, wallet.currency)}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Sẵn sàng rút</span>
              </div>
            </div>
          </div>

          {/* Card 2: Escrow Pending (Customer stayed but not checked out) */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tạm giữ Escrow (Chờ khách check-out)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {money(wallet.pending_escrow_net, wallet.currency)}
              </p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                <span>Tổng doanh thu gốc: {money(wallet.pending_escrow_gross, wallet.currency)} (90% đối tác)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Processing Withdrawals */}
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đang xử lý rút (Chờ duyệt)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {money(wallet.locked_balance, wallet.currency)}
              </p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                <span>Tổng thu nhập lũy kế: {money(wallet.total_earned, wallet.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Account Info Card */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Tài khoản Ngân hàng nhận thanh toán (Payout)</h3>
                {wallet?.payout_account?.is_verified && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Đã xác thực
                  </Badge>
                )}
              </div>
              {wallet?.payout_account ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{wallet.payout_account.bank_name}</span> · STK:{" "}
                  <span className="font-mono font-medium text-foreground">{wallet.payout_account.account_number}</span> · Chủ TK:{" "}
                  <span className="font-medium text-foreground">{wallet.payout_account.account_holder_name}</span>
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Chưa cài đặt tài khoản ngân hàng thụ hưởng. Hãy bổ sung để có thể nhận tiền rút.
                </p>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => setBankModalOpen(true)} className="h-8 text-xs shrink-0">
            {wallet?.payout_account ? "Thay đổi tài khoản ngân hàng" : "Thêm tài khoản nhận tiền"}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
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
            <History className="h-4 w-4" />
            <span>Lịch sử Rút tiền ({withdrawals.length})</span>
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
            <span>Sổ cái Biến động Số dư ({ledger.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("statements")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "statements"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Đối soát Đơn đặt phòng ({statements.length})</span>
          </button>
        </div>

        {/* Tab 1: Withdrawals */}
        {activeTab === "withdrawals" && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <History className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Chưa có yêu cầu rút tiền nào.</p>
                <p className="text-xs text-muted-foreground mt-1">Khi bạn có số dư khả dụng, hãy bấm &quot;Yêu cầu rút tiền&quot; ở trên.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Thời gian</th>
                      <th className="p-3.5 font-medium">Mã yêu cầu</th>
                      <th className="p-3.5 font-medium">Số tiền rút</th>
                      <th className="p-3.5 font-medium">Tài khoản thụ hưởng</th>
                      <th className="p-3.5 font-medium">Trạng thái</th>
                      <th className="p-3.5 font-medium">Mã giao dịch / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/20">
                        <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                          {new Date(w.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                          #{w.id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">
                          {money(w.amount, w.currency)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-foreground">{w.bank_name || w.bank_code}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {w.account_number} · {w.account_holder_name}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {(w.status === "PENDING" || w.status === "PENDING_REVIEW" || w.status === "PROCESSING") && (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                              <Clock className="mr-1 h-3 w-3" /> Chờ admin duyệt
                            </Badge>
                          )}
                          {(w.status === "APPROVED" || w.status === "COMPLETED") && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Đã chuyển khoản
                            </Badge>
                          )}
                          {w.status === "REJECTED" && (
                            <Badge variant="destructive" className="text-[10px]">
                              <XCircle className="mr-1 h-3 w-3" /> Từ chối
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {w.bank_reference_code && (
                            <div className="font-mono text-[11px] text-primary">
                              Ref: {w.bank_reference_code}
                            </div>
                          )}
                          {w.rejection_reason && (
                            <div className="text-destructive text-[11px]">
                              Lý do: {w.rejection_reason}
                            </div>
                          )}
                          {w.admin_notes && (
                            <div className="text-xs italic text-muted-foreground mt-0.5">
                              {w.admin_notes}
                            </div>
                          )}
                          {!w.bank_reference_code && !w.rejection_reason && !w.admin_notes && (
                            <span className="text-muted-foreground/60">-</span>
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

        {/* Tab 2: Ledger */}
        {activeTab === "ledger" && (
          <div className="space-y-3">
            {ledger.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <TrendingUp className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Chưa có biến động số dư nào được ghi nhận.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Thời gian</th>
                      <th className="p-3.5 font-medium">Loại giao dịch</th>
                      <th className="p-3.5 font-medium">Biến động</th>
                      <th className="p-3.5 font-medium">Số dư sau GD</th>
                      <th className="p-3.5 font-medium">Diễn giải</th>
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
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {entry.entry_type}
                            </Badge>
                          </td>
                          <td className="p-3.5 font-semibold">
                            <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                              {isPositive ? "+" : ""}{money(entry.amount, entry.currency)}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {entry.balance_after !== undefined ? money(entry.balance_after, entry.currency) : "-"}
                          </td>
                          <td className="p-3.5 text-muted-foreground max-w-xs truncate">
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

        {/* Tab 3: Statements */}
        {activeTab === "statements" && (
          <div className="space-y-3">
            {statements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                <FileSpreadsheet className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">Chưa có đơn đặt phòng nào cần đối soát.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-medium">Đơn đặt phòng</th>
                      <th className="p-3.5 font-medium">Khách sạn & Phòng</th>
                      <th className="p-3.5 font-medium">Tổng tiền khách trả</th>
                      <th className="p-3.5 font-medium">Phí nền tảng (10%)</th>
                      <th className="p-3.5 font-medium">Đối tác thực nhận (90%)</th>
                      <th className="p-3.5 font-medium">Trạng thái quyết toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {statements.map((s) => (
                      <tr key={s.booking_id} className="hover:bg-muted/20">
                        <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                          #{s.booking_id.slice(0, 8)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-foreground">{s.property_name}</div>
                          <div className="text-[11px] text-muted-foreground">{s.room_name}</div>
                        </td>
                        <td className="p-3.5 font-medium text-foreground">
                          {money(s.amount, s.currency)}
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {money(s.commission_amount, s.currency)}
                        </td>
                        <td className="p-3.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          {money(s.partner_amount, s.currency)}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {s.settlement_state === "SETTLED" ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Đã về ví
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                              <Clock className="mr-1 h-3 w-3" /> Tạm giữ Escrow
                            </Badge>
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
      </div>

      {/* Modal: Request Withdrawal */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              <span>Yêu cầu Rút tiền về Ngân hàng</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tiền sẽ được admin duyệt và chuyển khoản qua mạng lưới NAPAS 247 tới tài khoản ngân hàng thụ hưởng của bạn.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestWithdrawal} className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số dư khả dụng:</span>
                <span className="font-semibold text-primary">{wallet ? money(wallet.available_balance, wallet.currency) : "0 VND"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tài khoản nhận:</span>
                <span className="font-medium text-foreground">
                  {wallet?.payout_account ? `${wallet.payout_account.bank_code} - ${wallet.payout_account.account_number}` : "Chưa cấu hình"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-medium">Số tiền muốn rút (VND)</Label>
              <Input
                id="amount"
                type="number"
                min="1000"
                step="1000"
                placeholder="Nhập số tiền..."
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
              />
              {wallet && wallet.available_balance > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setWithdrawAmount(Math.min(wallet.available_balance, 50000).toString())}
                  >
                    50.000đ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setWithdrawAmount(Math.min(wallet.available_balance, 500000).toString())}
                  >
                    500.000đ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setWithdrawAmount(wallet.available_balance.toString())}
                  >
                    Tất cả ({money(wallet.available_balance, wallet.currency)})
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs font-medium">Ghi chú (Tùy chọn)</Label>
              <Input
                id="notes"
                placeholder="Ghi chú thêm cho ban quản trị..."
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setWithdrawModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submittingWithdraw}>
                {submittingWithdraw ? "Đang gửi..." : "Gửi yêu cầu rút"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Update Payout Bank Account */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <span>Thiết lập Tài khoản Ngân hàng Thụ hưởng</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vui lòng cung cấp chính xác tài khoản ngân hàng chính chủ để nhận tiền quyết toán.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank" className="text-xs font-medium">Ngân hàng</Label>
              <select
                id="bank"
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              >
                {POPULAR_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-xs font-medium">Số tài khoản</Label>
              <Input
                id="accountNumber"
                placeholder="Ví dụ: 0987654321..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountHolderName" className="text-xs font-medium">Tên chủ tài khoản (Viết hoa không dấu)</Label>
              <Input
                id="accountHolderName"
                placeholder="Ví dụ: NGUYEN VAN A"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch" className="text-xs font-medium">Chi nhánh (Không bắt buộc)</Label>
              <Input
                id="branch"
                placeholder="Ví dụ: Chi nhánh Đà Nẵng..."
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBankModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submittingBank}>
                {submittingBank ? "Đang lưu..." : "Lưu tài khoản"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
