"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  ListTodo,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

export interface ChecklistItem {
  id: string;
  text: string;
  category: "DOCUMENTS" | "CLOTHING" | "MEDICAL" | "TODO";
  completed: boolean;
}

const DEFAULT_PRESETS: Omit<ChecklistItem, "id" | "completed">[] = [
  { text: "Hộ chiếu / CCCD / Giấy tờ tùy thân", category: "DOCUMENTS" },
  { text: "Vé máy bay / Xác nhận đặt phòng khách sạn", category: "DOCUMENTS" },
  { text: "Bảo hiểm du lịch", category: "DOCUMENTS" },
  { text: "Quần áo phù hợp thời tiết & đồ bơi", category: "CLOTHING" },
  { text: "Áo khoác gió & ô/dù che mưa", category: "CLOTHING" },
  { text: "Kem chống nắng & thuốc xịt côn trùng", category: "MEDICAL" },
  { text: "Thuốc cảm, tiêu hóa, urgo cứu thương", category: "MEDICAL" },
  { text: "Sạc dự phòng & củ sạc điện thoại", category: "TODO" },
  { text: "Khóa van gas & tắt thiết bị điện ở nhà", category: "TODO" },
  { text: "Đổi tiền mặt hoặc kích hoạt thanh toán QR", category: "TODO" },
];

export function TripChecklistModal({
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
  const storageKey = `tripsense:checklist:${tripId}`;

  const [items, setItems] = React.useState<ChecklistItem[]>(() =>
    DEFAULT_PRESETS.map((p, idx) => ({
      id: `item-preset-${idx}`,
      ...p,
      completed: false,
    }))
  );
  const [newItemText, setNewItemText] = React.useState("");
  const [newCategory, setNewCategory] =
    React.useState<ChecklistItem["category"]>("TODO");

  // Load from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Load default presets for fresh trip
        const initial = DEFAULT_PRESETS.map((p, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          ...p,
          completed: false,
        }));
        setItems(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  const saveItems = (updated: ChecklistItem[]) => {
    setItems(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore
      }
    }
  };

  const toggleItem = (id: string) => {
    saveItems(
      items.map((it) =>
        it.id === id ? { ...it, completed: !it.completed } : it,
      ),
    );
  };

  const deleteItem = (id: string) => {
    saveItems(items.filter((it) => it.id !== id));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      category: newCategory,
      completed: false,
    };

    saveItems([...items, newItem]);
    setNewItemText("");
  };

  const resetToPresets = () => {
    const initial = DEFAULT_PRESETS.map((p, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      ...p,
      completed: false,
    }));
    saveItems(initial);
  };

  const completedCount = items.filter((it) => it.completed).length;
  const progressPercent =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const categories: {
    id: ChecklistItem["category"];
    label: string;
  }[] = [
    { id: "DOCUMENTS", label: "Giấy tờ & Vé" },
    { id: "CLOTHING", label: "Trang phục & Hành lý" },
    { id: "MEDICAL", label: "Y tế & Sức khỏe" },
    { id: "TODO", label: "Việc cần làm" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">
                {t("trip.checklistTitle", { defaultValue: "Danh sách chuẩn bị hành lý" })}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToPresets}
              className="h-7 px-2 text-micro text-muted-foreground hover:text-foreground gap-1"
              title="Đặt lại mẫu chuẩn bị"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t("trip.resetPresets", { defaultValue: "Mẫu gợi ý" })}</span>
            </Button>
          </div>
          <DialogDescription className="text-xs">
            {tripName} · {completedCount}/{items.length} {t("trip.itemsPacked", { defaultValue: "mục hoàn thành" })} ({progressPercent}%)
          </DialogDescription>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </DialogHeader>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1">
          {categories.map((cat) => {
            const catItems = items.filter((it) => it.category === cat.id);
            if (catItems.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {cat.label} ({catItems.filter((i) => i.completed).length}/{catItems.length})
                </h4>
                <div className="space-y-1.5">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                        item.completed
                          ? "border-emerald-500/20 bg-emerald-500/5 text-muted-foreground line-through"
                          : "border-border/60 bg-card hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border ${
                            item.completed
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {item.completed && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{item.text}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="text-muted-foreground/50 hover:text-destructive p-1 rounded-md transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new item form */}
        <form onSubmit={handleAddItem} className="pt-3 border-t border-border/60 flex gap-2">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={t("trip.addChecklistPlaceholder", { defaultValue: "Thêm đồ cần mang hoặc việc cần làm..." })}
            className="h-9 text-xs flex-1"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ChecklistItem["category"])}
            className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9 gap-1 text-xs shrink-0 font-medium">
            <Plus className="h-4 w-4" />
            <span>{t("common.add", { defaultValue: "Thêm" })}</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
