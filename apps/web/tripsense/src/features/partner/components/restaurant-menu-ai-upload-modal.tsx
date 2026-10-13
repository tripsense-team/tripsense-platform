"use client";

import * as React from "react";
import {
  Sparkles,
  UploadCloud,
  ImageIcon,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { extractRestaurantMenuFromImage } from "../services/partner-api";
import type { RestaurantMenuItemDto } from "../types";

interface RestaurantMenuAiUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyItems: (items: RestaurantMenuItemDto[], mode: "append" | "replace") => void;
}

interface EditableExtractedItem extends RestaurantMenuItemDto {
  selected: boolean;
}

export function RestaurantMenuAiUploadModal({
  open,
  onOpenChange,
  onApplyItems,
}: RestaurantMenuAiUploadModalProps) {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const [extractedItems, setExtractedItems] = React.useState<EditableExtractedItem[]>([]);
  const [step, setStep] = React.useState<"upload" | "review">("upload");
  const [applyMode, setApplyMode] = React.useState<"append" | "replace">("append");

  const resetState = React.useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
    setAnalyzing(false);
    setError(null);
    setIsDragging(false);
    setExtractedItems([]);
    setStep("upload");
  }, []);

  const processFile = React.useCallback(
    (file: File) => {
      const isImage =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

      if (!isImage) {
        setError(
          t("partner.restaurant.aiInvalidFile", {
            defaultValue: "Vui lòng chọn tệp định dạng ảnh (PNG, JPG, WebP, Screenshot)",
          }),
        );
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        setError(
          t("partner.restaurant.aiFileTooLarge", {
            defaultValue: "Kích thước ảnh tối đa là 15MB",
          }),
        );
        return;
      }

      setError(null);
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [t],
  );

  // Allow pasting screenshot directly via Ctrl+V
  React.useEffect(() => {
    if (!open || step !== "upload") return;

    const onGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", onGlobalPaste);
    return () => window.removeEventListener("paste", onGlobalPaste);
  }, [open, step, processFile]);

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setAnalyzing(true);
      setError(null);
      const res = await extractRestaurantMenuFromImage(selectedFile);
      const rawList = res.items || [];

      if (rawList.length === 0) {
        setError(t("partner.restaurant.aiNoItemsFound", { defaultValue: "AI không tìm thấy món ăn nào trong ảnh. Vui lòng thử ảnh rõ nét hơn." }));
        return;
      }

      setExtractedItems(
        rawList.map((item, idx) => ({
          ...item,
          displayOrder: idx + 1,
          selected: true,
        }))
      );
      setStep("review");
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("partner.restaurant.aiAnalyzeFailed", { defaultValue: "Không thể phân tích ảnh thực đơn. Vui lòng thử lại sau." })));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setExtractedItems((prev) => prev.map((it) => ({ ...it, selected: checked })));
  };

  const handleItemChange = (index: number, field: keyof RestaurantMenuItemDto, value: unknown) => {
    setExtractedItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: value } : it))
    );
  };

  const handleDeleteItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApply = () => {
    const chosen = extractedItems
      .filter((it) => it.selected)
      .map(({ selected, ...rest }) => rest);

    if (chosen.length === 0) {
      setError(t("partner.restaurant.aiNoSelectedToApply", { defaultValue: "Vui lòng chọn ít nhất 1 món ăn để áp dụng." }));
      return;
    }

    onApplyItems(chosen, applyMode);
    onOpenChange(false);
  };

  const selectedCount = extractedItems.filter((it) => it.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {step === "upload"
                  ? t("partner.restaurant.aiScanTitle", { defaultValue: "Quét & Phân tích Thực đơn bằng AI" })
                  : t("partner.restaurant.aiReviewTitle", { defaultValue: "Xem lại danh sách món AI nhận diện" })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {step === "upload"
                  ? t("partner.restaurant.aiScanDesc", { defaultValue: "Tải lên ảnh chụp thực đơn để AI tự động trích xuất món ăn, giá tiền và danh mục." })
                  : t("partner.restaurant.aiReviewDesc", { defaultValue: "Kiểm tra và chỉnh sửa nhanh thông tin trước khi thêm vào thực đơn của quán." })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Notifications */}
        {error && (
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4">
          {step === "upload" ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[0.99]"
                      : "border-border/70 hover:border-primary/60 bg-muted/20 hover:bg-muted/30"
                  }`}
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("partner.restaurant.aiDropPrompt", {
                        defaultValue: "Nhấn để chọn ảnh, kéo thả ảnh hoặc nhấn Ctrl+V để dán ảnh chụp màn hình",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("partner.restaurant.aiDropSub", {
                        defaultValue: "Hỗ trợ ảnh chụp màn hình, ảnh PNG, JPG, WebP (Tối đa 15MB)",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs">
                      {t("partner.restaurant.aiSelectImage", { defaultValue: "Chọn tệp ảnh" })}
                    </Button>
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      Phím tắt: Ctrl + V
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl border border-border overflow-hidden bg-black/5 dark:bg-white/5 max-h-72 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Menu preview"
                      className="max-h-72 w-auto object-contain mx-auto"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => {
                        setSelectedFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-xs shadow-xs"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{selectedFile?.name} ({(Number(selectedFile?.size || 0) / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-primary hover:underline font-medium"
                    >
                      {t("partner.restaurant.aiChangeImage", { defaultValue: "Chọn ảnh khác" })}
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-primary/5 p-3.5 border border-primary/10 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("partner.restaurant.aiTipsTitle", { defaultValue: "Mẹo để AI nhận diện chính xác nhất:" })}
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Chụp thực đơn ở góc thẳng đứng, đủ ánh sáng, chữ không bị lóa hoặc mờ.</li>
                  <li>Nếu thực đơn có nhiều trang, bạn có thể quét từng trang một rồi bấm "Thêm vào thực đơn hiện có".</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header bar of review */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedCount === extractedItems.length && extractedItems.length > 0}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>
                      {t("partner.restaurant.aiSelectAll", { defaultValue: "Chọn tất cả" })} ({selectedCount}/{extractedItems.length})
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t("partner.restaurant.aiApplyMethod", { defaultValue: "Cách thức thêm:" })}</span>
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
                    <button
                      type="button"
                      onClick={() => setApplyMode("append")}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        applyMode === "append"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("partner.restaurant.aiAppend", { defaultValue: "Thêm nối tiếp" })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyMode("replace")}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        applyMode === "replace"
                          ? "bg-destructive text-destructive-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("partner.restaurant.aiReplace", { defaultValue: "Ghi đè tất cả" })}
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      item.selected
                        ? "border-primary/40 bg-card shadow-xs"
                        : "border-border/40 bg-muted/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setExtractedItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, selected: e.target.checked } : it))
                          )
                        }
                        className="mt-2 h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0 cursor-pointer"
                      />

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Tên món</label>
                          <Input
                            value={item.name}
                            onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                            className="h-8 text-xs font-medium"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Danh mục</label>
                          <Input
                            value={item.category || ""}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            placeholder="Món chính..."
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Giá (VND)</label>
                          <Input
                            type="number"
                            step="1000"
                            value={item.price}
                            onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs font-mono font-medium text-foreground"
                          />
                        </div>

                        {item.description && (
                          <div className="sm:col-span-12 text-[11px] text-muted-foreground italic">
                            {item.description}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(idx)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 gap-2 shrink-0">
          {step === "upload" ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("common.cancel", { defaultValue: "Hủy bỏ" })}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyze}
                disabled={!selectedFile || analyzing}
                className="gap-1.5 font-medium shadow-xs"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("partner.restaurant.aiAnalyzing", { defaultValue: "AI đang phân tích thực đơn..." })}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("partner.restaurant.aiStartAnalyze", { defaultValue: "Bắt đầu phân tích AI" })}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setStep("upload")}>
                {t("common.back", { defaultValue: "Quay lại" })}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={selectedCount === 0}
                className="gap-1.5 font-medium shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                {t("partner.restaurant.aiApplyButton", { defaultValue: "Áp dụng vào thực đơn" })} ({selectedCount})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
