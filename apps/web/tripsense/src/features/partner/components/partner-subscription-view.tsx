"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  HelpCircle,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  createSubscriptionCheckout,
  getBusinessDetail,
  getPartnerSubscription,
  getSubscriptionOrderStatus,
  getSubscriptionPlans,
} from "../services/partner-api";
import type {
  BusinessDetailDto,
  PartnerSubscriptionDto,
  PartnerSubscriptionPlanDto,
  SubscriptionCheckoutResponse,
} from "../types";

interface PartnerSubscriptionViewProps {
  businessId: string;
  showBackButton?: boolean;
  embedded?: boolean;
}

export function PartnerSubscriptionView({
  businessId,
  showBackButton = false,
  embedded = false,
}: PartnerSubscriptionViewProps) {
  const router = useRouter();

  const [business, setBusiness] = React.useState<BusinessDetailDto | null>(null);
  const [subscription, setSubscription] = React.useState<PartnerSubscriptionDto | null>(null);
  const [plans, setPlans] = React.useState<PartnerSubscriptionPlanDto[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [checkoutOrder, setCheckoutOrder] = React.useState<SubscriptionCheckoutResponse | null>(null);
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);

  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const biz = await getBusinessDetail(businessId);
      setBusiness(biz);

      const [subData, plansData] = await Promise.all([
        getPartnerSubscription(businessId),
        getSubscriptionPlans(biz.kind),
      ]);

      setSubscription(subData);
      setPlans(plansData);

      // Default select the recommended 3-month or 1-year plan
      const defaultPlan = plansData.find((p) => p.durationDays === 90) || plansData[0];
      if (defaultPlan) {
        setSelectedPlanId(defaultPlan.planId);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể tải thông tin gói thuê bao đối tác."));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Clean up polling interval
  React.useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Handle Checkout initiation via PayOS
  const handleCheckout = async (planId: string) => {
    setSelectedPlanId(planId);
    setCheckoutLoading(true);
    setError(null);
    setPaymentSuccess(false);

    try {
      const response = await createSubscriptionCheckout(businessId, { planId });
      setCheckoutOrder(response);
      setCheckoutModalOpen(true);

      // Start polling order status every 2.5 seconds for automated activation
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getSubscriptionOrderStatus(businessId, response.orderCode);
          if (status.status === "PAID") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentSuccess(true);
            // Refresh subscription in background
            const updatedSub = await getPartnerSubscription(businessId);
            setSubscription(updatedSub);
          }
        } catch {
          // Keep polling silently
        }
      }, 2500);
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể tạo liên kết thanh toán PayOS."));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setCheckoutModalOpen(false);
    setCheckoutOrder(null);
    if (paymentSuccess) {
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải gói dịch vụ và ưu đãi đối tác...</p>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
          <p className="font-medium">{error}</p>
          <Button variant="outline" className="mt-4" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
          </Button>
        </div>
      </div>
    );
  }

  const isCurrentActive = subscription?.isActive ?? false;
  const daysRemaining = subscription?.daysRemaining ?? 0;
  const currentPlan = subscription?.currentPlan;

  const kindName = business?.kind === "HOTEL"
    ? "Khách Sạn & Lưu Trú"
    : business?.kind === "RESTAURANT"
      ? "Nhà Hàng & Quán Ăn"
      : "Hướng Dẫn Viên Du Lịch";

  return (
    <div className={embedded ? "w-full space-y-6" : "container mx-auto max-w-6xl px-4 py-8 space-y-6"}>
      {/* Top Navigation Back Button if requested */}
      {showBackButton && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/partner" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Quay lại Cơ sở của tôi
            </Link>
          </Button>
        </div>
      )}

      {/* Business Identity & Status Header */}
      {business && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-primary">
              {business.kind === "HOTEL" ? (
                <Building2 className="h-6 w-6 text-blue-500" />
              ) : business.kind === "RESTAURANT" ? (
                <Utensils className="h-6 w-6 text-amber-500" />
              ) : (
                <Compass className="h-6 w-6 text-emerald-500" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground sm:text-xl">
                  {business.displayName}
                </h2>
                {isCurrentActive && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Verified Partner
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {kindName} • ID: {business.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {business.kind === "RESTAURANT" && (
              <Button asChild variant="outline" size="sm" className="h-8.5 text-xs">
                <Link href={`/partner/businesses/${business.id}/restaurant-menu`}>
                  <Utensils className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Quản lý thực đơn
                </Link>
              </Button>
            )}
            {business.kind === "HOTEL" && (
              <Button asChild variant="outline" size="sm" className="h-8.5 text-xs">
                <Link href={`/partner/businesses/${business.id}/hotel`}>
                  <Building2 className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Quản lý phòng nghỉ
                </Link>
              </Button>
            )}
            {business.kind === "TOUR_GUIDE" && (
              <Button asChild variant="outline" size="sm" className="h-8.5 text-xs">
                <Link href={`/partner/businesses/${business.id}/guide-promotions`}>
                  <Compass className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Bài viết quảng bá
                </Link>
              </Button>
            )}

            {isCurrentActive ? (
              <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400 py-1 px-3">
                <BadgeCheck className="mr-1.5 h-4 w-4 text-emerald-600" />
                {currentPlan?.name || "Gói Hội viên"} ({daysRemaining} ngày còn lại)
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 py-1 px-3">
                <Clock className="mr-1.5 h-4 w-4" />
                Chưa kích hoạt gói
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Hero Value Banner */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Gói Hội Viên Đối Tác {kindName}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Tăng Trưởng Doanh Thu — Tiếp Cận 50.000+ Du Khách Mỗi Tháng
          </h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Được <strong className="text-foreground">AI Trip Planner</strong> tự động đưa vào lịch trình du lịch, nhận huy hiệu xác thực uy tín và kết nối khách hàng trực tiếp.{" "}
            <span className="font-semibold text-primary">Giữ trọn 100% doanh thu (0% hoa hồng sàn)!</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Tiềm năng tiếp cận: <strong>52.480+ lượt tìm kiếm</strong></span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Hoa hồng sàn: <strong className="text-emerald-600">0%</strong></span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Huy hiệu: <strong>Verified Partner</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Service-First Advisory Banner */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Mẹo tối ưu hiệu quả:</strong> Hãy đảm bảo cơ sở của bạn đã cập nhật đầy đủ thực đơn hoặc hạng phòng tại mục <Link href="/partner/services" className="font-semibold text-primary underline underline-offset-2">Dịch vụ & Thực đơn</Link> để du khách có thể đặt chỗ hoặc liên hệ trực tiếp ngay khi hồ sơ được kích hoạt huy hiệu Pro!
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="h-7 text-xs shrink-0 self-end sm:self-center">
          <Link href="/partner/services">
            Quản lý Dịch vụ
          </Link>
        </Button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="mb-14">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Bảng Gói Cước Niêm Yết & Quảng Bá</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Phí cố định trọn gói, kích hoạt tức thì qua mã VietQR. Không phát sinh chi phí ẩn.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isBestValue = plan.durationDays === 365;
            const isMostPopular = plan.durationDays === 90;
            const isSelected = selectedPlanId === plan.planId;

            const monthlyPriceEquivalent = Math.round(plan.priceVnd / (plan.durationDays / 30));

            return (
              <Card
                key={plan.planId}
                className={`relative flex flex-col transition-all duration-200 hover:shadow-xl ${
                  isBestValue
                    ? "border-primary/50 bg-gradient-to-b from-primary/5 via-background to-background shadow-md ring-2 ring-primary/20"
                    : isMostPopular
                      ? "border-amber-500/40 bg-gradient-to-b from-amber-500/5 via-background to-background"
                      : "border-border"
                } ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                {isBestValue && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                    ⭐ Tiết Kiệm Nhất (Tặng 4 Tháng)
                  </div>
                )}
                {isMostPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                    🔥 Được Đăng Ký Nhiều Nhất
                  </div>
                )}

                <CardHeader className="pt-6">
                  <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                  <CardDescription className="min-h-10 text-xs">
                    {plan.tagline || `Thời hạn sử dụng ${plan.durationDays} ngày`}
                  </CardDescription>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {new Intl.NumberFormat("vi-VN").format(plan.priceVnd)}đ
                    </span>
                    {plan.originalPriceVnd && plan.originalPriceVnd > plan.priceVnd && (
                      <span className="text-sm text-muted-foreground line-through">
                        {new Intl.NumberFormat("vi-VN").format(plan.originalPriceVnd)}đ
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Tương đương:</span>
                    <strong className="text-foreground">
                      ~{new Intl.NumberFormat("vi-VN").format(monthlyPriceEquivalent)}đ/tháng
                    </strong>
                    {plan.discountPercent ? (
                      <Badge variant="secondary" className="px-1.5 py-0 text-micro font-bold text-emerald-600">
                        -{plan.discountPercent}%
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pt-2 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span><strong>Ưu tiên TOP 1</strong> đề xuất lịch trình du khách (AI Boost)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Huy hiệu <strong>{plan.badgeLabel || "Verified Partner"}</strong></span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Ghim nổi bật trên bản đồ du lịch tương tác</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Khách liên hệ & đặt trực tiếp (0% hoa hồng)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Báo cáo thống kê lượt xem & thêm vào chuyến đi</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full gap-2 font-semibold shadow-sm"
                    variant={isBestValue ? "default" : "outline"}
                    disabled={checkoutLoading}
                    onClick={() => handleCheckout(plan.planId)}
                  >
                    {checkoutLoading && selectedPlanId === plan.planId ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        <span>Đang tạo mã thanh toán...</span>
                      </>
                    ) : isCurrentActive ? (
                      "Gia hạn thêm gói"
                    ) : (
                      "Kích hoạt ngay"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Value Comparison Table */}
      <div className="mb-14 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-6 text-lg font-bold text-foreground">So Sánh Quyền Lợi: Miễn Phí vs Gói Đối Tác</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-3 font-semibold">Tính năng & Quyền lợi</th>
                <th className="py-3 text-center font-semibold text-muted-foreground">Gói Miễn Phí (Free)</th>
                <th className="py-3 text-center font-semibold text-primary">Gói Đối Tác (Partner Pro)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3.5 font-medium">Trọng số đề xuất AI Trip Planner</td>
                <td className="py-3.5 text-center text-muted-foreground">Xếp cuối danh sách</td>
                <td className="py-3.5 text-center font-semibold text-emerald-600">⭐ Ưu tiên TOP 1 gợi ý</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Huy hiệu Xác thực Uy tín</td>
                <td className="py-3.5 text-center text-muted-foreground"><X className="mx-auto h-4 w-4 text-muted-foreground/60" /></td>
                <td className="py-3.5 text-center font-semibold text-emerald-600"><Check className="mx-auto h-4 w-4 text-emerald-600" /></td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Ghim hiển thị trên Bản đồ vệ tinh</td>
                <td className="py-3.5 text-center text-muted-foreground">Ghim thông thường</td>
                <td className="py-3.5 text-center font-semibold text-primary">📍 Ghim Nổi Bật (Featured Pin)</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Hình ảnh thực đơn / Phòng / Dịch vụ</td>
                <td className="py-3.5 text-center text-muted-foreground">Giới hạn tối đa 3 ảnh</td>
                <td className="py-3.5 text-center font-semibold text-foreground">Không giới hạn ảnh đẹp</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Nút Gọi Hotline & Chỉ đường trực tiếp</td>
                <td className="py-3.5 text-center text-muted-foreground">Giới hạn click</td>
                <td className="py-3.5 text-center font-semibold text-emerald-600"><Check className="mx-auto h-4 w-4 text-emerald-600" /></td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Chiết khấu hoa hồng từng đơn hàng</td>
                <td className="py-3.5 text-center text-muted-foreground">0%</td>
                <td className="py-3.5 text-center font-bold text-emerald-600">0% (Giữ trọn 100% doanh thu)</td>
              </tr>
              <tr>
                <td className="py-3.5 font-medium">Báo cáo lượt xem & Lịch trình (Analytics)</td>
                <td className="py-3.5 text-center text-muted-foreground"><X className="mx-auto h-4 w-4 text-muted-foreground/60" /></td>
                <td className="py-3.5 text-center font-semibold text-emerald-600">Báo cáo thời gian thực</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PayOS Automated Checkout Modal */}
      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <QrCode className="h-5 w-5 text-primary" /> Thanh Toán Tự Động Qua PayOS
            </DialogTitle>
            <DialogDescription>
              Quét mã QR bằng ứng dụng ngân hàng hoặc mở trực tiếp trên PayOS. Gói đối tác sẽ được kích hoạt tự động ngay khi thanh toán hoàn tất.
            </DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Kích Hoạt Thành Công!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cơ sở kinh doanh của bạn đã được nâng cấp lên gói đối tác và ưu tiên hiển thị trên TripSense ngay bây giờ.
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={handleCloseModal}>
                Hoàn tất
              </Button>
            </div>
          ) : checkoutOrder ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-4">
                {checkoutOrder.qrCode ? (
                  <div className="relative overflow-hidden rounded-lg bg-white p-2 shadow-inner">
                    <img
                      src={
                        checkoutOrder.qrCode.startsWith("http") || checkoutOrder.qrCode.startsWith("data:")
                          ? checkoutOrder.qrCode
                          : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkoutOrder.qrCode)}`
                      }
                      alt="Mã thanh toán PayOS"
                      className="h-52 w-52 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center text-muted-foreground">
                    <Spinner className="h-6 w-6" />
                  </div>
                )}

                <div className="mt-3 text-center">
                  <div className="text-xs text-muted-foreground">Số tiền thanh toán:</div>
                  <div className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat("vi-VN").format(checkoutOrder.amount)} VNĐ
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Mã đơn hàng PayOS: <strong className="text-foreground">#{checkoutOrder.orderCode}</strong>
                  </div>
                </div>
              </div>

              {/* PayOS Direct Link Button */}
              {checkoutOrder.paymentUrl && (
                <Button
                  asChild
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 shadow-sm"
                >
                  <a
                    href={checkoutOrder.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Thanh toán trực tiếp trên cổng PayOS</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {/* Auto Polling Status Indicator */}
              <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 font-medium">
                <Spinner className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                <span>Đang chờ xác nhận tự động từ cổng PayOS...</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          )}

          {!paymentSuccess && (
            <DialogFooter className="sm:justify-end">
              <Button variant="outline" size="sm" onClick={handleCloseModal}>
                Đóng
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
