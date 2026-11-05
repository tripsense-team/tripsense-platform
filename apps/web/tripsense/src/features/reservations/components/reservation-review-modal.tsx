"use client";

import * as React from "react";
import { Star, Sparkles, MessageSquare, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ReservationReview {
  reservationId: string;
  businessName: string;
  rating: number;
  content: string;
  tags: string[];
  createdAt: string;
}

const RATING_LABELS: Record<number, string> = {
  5: "Tuyệt vời! Rất hài lòng",
  4: "Rất tốt, sẽ quay lại",
  3: "Hài lòng, đúng kỳ vọng",
  2: "Tạm ổn, cần cải thiện",
  1: "Chưa hài lòng",
};

const SUGGESTED_TAGS = [
  "Món ăn đậm đà",
  "Phục vụ nhiệt tình",
  "Không gian ấm cúng",
  "Lên món đúng giờ",
  "Giá cả hợp lý",
  "Vệ sinh sạch sẽ",
];

interface ReservationReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  businessName: string;
  initialRating?: number;
  initialContent?: string;
  onReviewSubmitted?: (review: ReservationReview) => void;
}

export function getStoredReview(reservationId: string): ReservationReview | null {
  if (typeof window === "undefined" || !reservationId) return null;
  try {
    const raw = window.localStorage.getItem(`tripsense:review:${reservationId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredReview(review: ReservationReview) {
  if (typeof window === "undefined" || !review.reservationId) return;
  try {
    window.localStorage.setItem(`tripsense:review:${review.reservationId}`, JSON.stringify(review));
    window.dispatchEvent(
      new CustomEvent("tripsense:review-updated", {
        detail: { reservationId: review.reservationId, review },
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function ReservationReviewModal({
  open,
  onOpenChange,
  reservationId,
  businessName,
  initialRating = 5,
  initialContent = "",
  onReviewSubmitted,
}: ReservationReviewModalProps) {
  const [rating, setRating] = React.useState<number>(initialRating);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [content, setContent] = React.useState<string>(initialContent);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync stored review when opened
  React.useEffect(() => {
    if (open && reservationId) {
      const existing = getStoredReview(reservationId);
      if (existing) {
        setRating(existing.rating || 5);
        setContent(existing.content || "");
        setSelectedTags(existing.tags || []);
      } else {
        setRating(initialRating);
        setContent(initialContent);
        setSelectedTags([]);
      }
      setError(null);
    }
  }, [open, reservationId, initialRating, initialContent]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rating || rating < 1) {
      setError("Vui lòng chọn số sao đánh giá (1 đến 5 sao).");
      return;
    }

    const trimmed = content.trim();
    if (trimmed.length > 0 && trimmed.length < 10) {
      setError("Nhận xét tối thiểu từ 10 ký tự để mô tả chi tiết hơn trải nghiệm của bạn.");
      return;
    }

    setSubmitting(true);
    try {
      // Build review payload
      const finalContent =
        trimmed ||
        (selectedTags.length > 0
          ? `Trải nghiệm tại quán: ${selectedTags.join(", ")}.`
          : `Đã dùng bữa tại ${businessName}, phục vụ chu đáo.`);

      const review: ReservationReview = {
        reservationId,
        businessName,
        rating,
        content: finalContent,
        tags: selectedTags,
        createdAt: new Date().toISOString(),
      };

      // Save to local storage for instant sync across tabs & cards
      saveStoredReview(review);

      toast.success("Cảm ơn bạn đã gửi đánh giá!", {
        description: `Đánh giá ${rating} sao cho ${businessName} đã được ghi nhận.`,
      });

      onReviewSubmitted?.(review);
      onOpenChange(false);
    } catch {
      setError("Không thể gửi đánh giá lúc này. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Đánh giá trải nghiệm
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-[280px]">
                {businessName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Interactive Star Rating */}
          <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 text-center space-y-2">
            <span className="text-xs font-semibold text-muted-foreground block">
              Mức độ hài lòng của bạn
            </span>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= activeRating
                        ? "fill-amber-500 text-amber-500 drop-shadow-xs"
                        : "text-muted-foreground/30 fill-transparent"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 min-h-[18px]">
              {RATING_LABELS[activeRating] || ""}
            </p>
          </div>

          {/* Quick Impression Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Điểm nổi bật của quán</span>
              <span className="text-[11px] font-normal text-muted-foreground">(chọn nhanh)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-muted/50 text-muted-foreground border-border/70 hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Details Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Cảm nhận chi tiết
              </label>
              <span className="text-[11px] text-muted-foreground">
                {content.length} / 1000 ký tự
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Chia sẻ hương vị món ăn, thái độ phục vụ, không gian quán hoặc lưu ý cho thực khách khác..."
              rows={3}
              maxLength={1000}
              className="resize-none text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Hoàn tất đánh giá</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

