"use client";

import * as React from "react";
import { Building2, Utensils, Compass, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { enrollPartner } from "../services/partner-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useTranslation } from "@/i18n";

interface PartnerEnrollmentBannerProps {
  onEnrolled?: () => void;
}

export function PartnerEnrollmentBanner({ onEnrolled }: PartnerEnrollmentBannerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  const handleEnroll = async () => {
    try {
      setLoading(true);
      setError(null);
      await enrollPartner("1.0");
      // Update local auth store roles if present
      if (user) {
        const currentRoles = user.roles || [];
        if (!currentRoles.includes("ROLE_PARTNER")) {
          useAuthStore.setState({
            user: { ...user, roles: [...currentRoles, "ROLE_PARTNER"] },
          });
        }
      }
      onEnrolled?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đăng ký không thành công";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background shadow-lg">
      <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <CardContent className="p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
            <ShieldCheck className="h-4 w-4" />
            <span>Khu vực Dành cho Đối tác</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-3">
            Phát triển kinh doanh cùng TripSense
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6">
            Tham gia mạng lưới đối tác để quản lý khách sạn, quán ăn hoặc quảng bá năng lực hướng dẫn viên cá nhân. 
            Xét duyệt minh bạch theo hồ sơ chuyên môn, chủ động mở bán và kết nối trực tiếp với du khách.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Khách sạn</p>
                <p className="text-[11px] text-muted-foreground">Quản lý phòng & đặt giữ chỗ</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Nhà hàng / Quán ăn</p>
                <p className="text-[11px] text-muted-foreground">Thực đơn & điểm hẹn ẩm thực</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Hướng dẫn viên</p>
                <p className="text-[11px] text-muted-foreground">Quảng bá chuyên môn & tư vấn</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          <Button
            size="lg"
            onClick={handleEnroll}
            disabled={loading}
            className="group font-medium shadow-md transition-all hover:shadow-primary/25"
          >
            {loading ? "Đang xử lý..." : "Trở thành đối tác ngay"}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
