"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, Calendar, Users, Clock, AlertCircle } from "lucide-react";
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
import { createGuideInquiry } from "../services/partner-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type { CreateGuideInquiryInput } from "../types";

export interface GuideInquiryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideBusinessId: string;
  guideDisplayName?: string;
  promotionId?: string;
  expectedSourceRevisionId: string;
  sourceCommunityPostId?: string;
  areaId: string;
  topicIds: string[];
}

export function GuideInquiryFormModal({
  open,
  onOpenChange,
  guideBusinessId,
  guideDisplayName,
  promotionId,
  expectedSourceRevisionId,
  sourceCommunityPostId,
  areaId,
  topicIds,
}: GuideInquiryFormModalProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated");

  const [dateFrom, setDateFrom] = React.useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [dateTo, setDateTo] = React.useState(
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [durationMinutes, setDurationMinutes] = React.useState(180);
  const [goals, setGoals] = React.useState("");
  const [supportNotes, setSupportNotes] = React.useState("");
  const [minBudget, setMinBudget] = React.useState<number>(500000);
  const [maxBudget, setMaxBudget] = React.useState<number>(2000000);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!goals.trim()) {
      setError("Vui lòng nêu rõ nhu cầu và mong muốn trải nghiệm của bạn.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const req: CreateGuideInquiryInput = {
        promotionId,
        expectedSourceRevisionId,
        sourceCommunityPostId,
        areaId,
        topicIds: topicIds.length > 0 ? topicIds : ["general"],
        languageCode: "vi",
        dateFrom,
        dateTo,
        timeZone: "Asia/Ho_Chi_Minh",
        durationMinutes,
        adults,
        children,
        goals: goals.trim(),
        supportNotes: supportNotes.trim() || undefined,
        budgetVnd: {
          minVnd: minBudget,
          maxVnd: maxBudget,
        },
      };

      const created = await createGuideInquiry(guideBusinessId, req);
      onOpenChange(false);
      router.push(`/guide-inquiries/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi gửi yêu cầu tư vấn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Gửi yêu cầu tư vấn du lịch
          </DialogTitle>
          <DialogDescription>
            Kết nối với {guideDisplayName || "Hướng dẫn viên"} để nhận phương án thiết kế chuyến đi riêng.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Từ ngày
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Đến ngày
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Người lớn
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="font-semibold text-foreground mb-1 block">Trẻ em</label>
              <Input
                type="number"
                min={0}
                max={30}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Thời lượng (phút)
              </label>
              <Input
                type="number"
                step={30}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-foreground mb-1 block">
              Mục tiêu chuyến đi & nhu cầu cụ thể *
            </label>
            <Textarea
              rows={3}
              placeholder="VD: Chúng tôi muốn tìm hiểu văn hóa phố cổ kết hợp chụp ảnh áo dài và thử các món ăn vặt địa phương..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>

          <div>
            <label className="font-semibold text-foreground mb-1 block">
              Ghi chú thêm (thể lực, chế độ ăn, người cao tuổi...)
            </label>
            <Input
              placeholder="Có người lớn tuổi đi cùng nên hạn chế đi bộ quá dốc..."
              value={supportNotes}
              onChange={(e) => setSupportNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-foreground mb-1 block">Ngân sách dự kiến tối thiểu (VND)</label>
              <Input
                type="number"
                value={minBudget}
                onChange={(e) => setMinBudget(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="font-semibold text-foreground mb-1 block">Ngân sách tối đa (VND)</label>
              <Input
                type="number"
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !goals.trim()}>
            {loading ? "Đang gửi..." : "Gửi yêu cầu tư vấn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
