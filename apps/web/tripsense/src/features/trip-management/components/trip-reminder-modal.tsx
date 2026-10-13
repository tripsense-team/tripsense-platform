"use client";

import * as React from "react";
import { Bell, BellRing, Clock, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

export interface TripReminderSettings {
  remind1DayBefore: boolean;
  remind3DaysBefore: boolean;
  remindActivity1HourBefore: boolean;
}

export function TripReminderModal({
  open,
  onOpenChange,
  tripId,
  tripName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
}) {
  const { t } = useTranslation();
  const storageKey = `tripsense:reminders:${tripId}`;

  const [settings, setSettings] = React.useState<TripReminderSettings>({
    remind1DayBefore: true,
    remind3DaysBefore: false,
    remindActivity1HourBefore: true,
  });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  const handleToggle = (key: keyof TripReminderSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // Ignore
      }
    }
  };

  const requestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      await Notification.requestPermission();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">
              {t("trip.reminderSettingsTitle", { defaultValue: "Cài đặt Nhắc lịch Chuyến đi" })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {tripName} · {t("trip.reminderSettingsDesc", { defaultValue: "Bật thông báo để không bỏ lỡ các mốc quan trọng và hoạt động trong chuyến đi." })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Nhắc trước ngày khởi hành 1 ngày</span>
              </span>
              <p className="text-muted-foreground text-micro">
                Kiểm tra hành lý và xác nhận thời gian di chuyển.
              </p>
            </div>
            <Switch
              checked={settings.remind1DayBefore}
              onCheckedChange={() => handleToggle("remind1DayBefore")}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-teal-600" />
                <span>Nhắc trước 3 ngày để chuẩn bị đồ</span>
              </span>
              <p className="text-muted-foreground text-micro">
                Lên danh sách mua sắm và hoàn tất checklist.
              </p>
            </div>
            <Switch
              checked={settings.remind3DaysBefore}
              onCheckedChange={() => handleToggle("remind3DaysBefore")}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Nhắc trước mỗi hoạt động 1 giờ</span>
              </span>
              <p className="text-muted-foreground text-micro">
                Thông báo điểm đến tiếp theo trong ngày theo lịch trình.
              </p>
            </div>
            <Switch
              checked={settings.remindActivity1HourBefore}
              onCheckedChange={() => handleToggle("remindActivity1HourBefore")}
            />
          </div>

          {saved && (
            <p className="text-micro text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Đã lưu tùy chọn nhắc nhở!</span>
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-border/50 flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={requestPermission} className="text-micro text-muted-foreground">
            Bật quyền thông báo trình duyệt
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {t("common.confirm", { defaultValue: "Xong" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
