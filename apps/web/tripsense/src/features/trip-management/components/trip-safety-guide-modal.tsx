"use client";

import * as React from "react";
import {
  AlertTriangle,
  PhoneCall,
  Shield,
  ShieldAlert,
  SunMedium,
  HeartPulse,
  Flame,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

const EMERGENCY_HOTLINES = [
  { number: "113", label: "Cảnh sát phản ứng nhanh", icon: ShieldAlert, color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  { number: "115", label: "Cấp cứu y tế", icon: HeartPulse, color: "text-red-600 bg-red-500/10 border-red-500/20" },
  { number: "114", label: "Cứu nạn & Cứu hỏa", icon: Flame, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
];

const TOURIST_SUPPORT_LINES = [
  { city: "Đà Nẵng", phone: "0236.3550.111", desc: "Trung tâm Hỗ trợ Du khách Đà Nẵng (24/7)" },
  { city: "Hà Nội", phone: "024.3825.2222", desc: "Tổng đài Thông tin & Trợ giúp Du lịch Hà Nội" },
  { city: "TP. Hồ Chí Minh", phone: "1022", desc: "Tổng đài Tiếp nhận phản ánh du khách (nhánh 8)" },
  { city: "Khánh Hòa", phone: "0258.3528.000", desc: "Đường dây nóng Hỗ trợ du lịch Nha Trang" },
];

const SAFETY_TIPS = [
  { title: "Bảo quản tài sản cá nhân", desc: "Để hộ chiếu và giấy tờ gốc tại két an toàn khách sạn, mang theo bản sao hoặc ảnh chụp trên điện thoại." },
  { title: "An toàn giao thông & Di chuyển", desc: "Ưu tiên đặt xe qua các ứng dụng gọi xe có biển số và giá cước hiển thị minh bạch." },
  { title: "Lưu ý thời tiết & Biển", desc: "Luôn chú ý cờ báo động tại các bãi biển (cờ đỏ: cấm tắm) và kiểm tra dự báo mưa bão theo mùa." },
];

export function TripSafetyGuideModal({
  open,
  onOpenChange,
  destination,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">
              {t("trip.safetyTitle", { defaultValue: "Cẩm nang An toàn & Số khẩn cấp" })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {t("trip.safetyDesc", { defaultValue: "Thông tin liên hệ khẩn cấp và lưu ý an toàn cho chuyến đi đến" })} {destination}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1 text-xs">
          {/* Emergency Hotlines */}
          <div className="space-y-2.5">
            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-micro">
              {t("trip.nationalEmergency", { defaultValue: "Số điện thoại khẩn cấp quốc gia" })}
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              {EMERGENCY_HOTLINES.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.number}
                    href={`tel:${item.number}`}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all hover:scale-[1.02] shadow-2xs ${item.color}`}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-base font-bold font-mono">{item.number}</span>
                    <span className="text-[11px] leading-tight mt-0.5 font-medium">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Local Tourist Support */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-micro">
              {t("trip.touristHotlines", { defaultValue: "Đường dây nóng hỗ trợ du khách" })}
            </h4>
            <div className="space-y-1.5">
              {TOURIST_SUPPORT_LINES.map((item) => (
                <div
                  key={item.city}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card"
                >
                  <div>
                    <span className="font-bold text-foreground mr-1.5">{item.city}:</span>
                    <span className="text-muted-foreground text-micro">{item.desc}</span>
                  </div>
                  <a
                    href={`tel:${item.phone.replace(/[^0-9]/g, "")}`}
                    className="font-mono font-bold text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <PhoneCall className="h-3 w-3" />
                    <span>{item.phone}</span>
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Practical safety tips */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-micro">
              {t("trip.safetyTipsTitle", { defaultValue: "Lưu ý an toàn quan trọng" })}
            </h4>
            <div className="space-y-2">
              {SAFETY_TIPS.map((tip, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-0.5">
                  <p className="font-semibold text-foreground text-xs">{tip.title}</p>
                  <p className="text-muted-foreground text-micro leading-relaxed">{tip.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.close", { defaultValue: "Đóng" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
