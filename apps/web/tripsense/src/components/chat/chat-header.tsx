"use client";

import { useState } from "react";
import { ChevronDown, Luggage, Pencil, Trash2 } from "lucide-react";

import type { TripPreferences } from "./modals/trip-preferences-types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { TripResponse } from "@/features/trip-management/types";
import { formatWhenSelection } from "@/features/trip-management/utils/date";
import { useTranslation } from "@/i18n/i18n-context";
import { formatTripTitle } from "./sidebar-flyout";
import { isGenericChatTitle } from "@/hooks/use-ai-chats";

type ChatHeaderProps = {
  chatId?: string;
  chatTitle?: string;
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  onRenameChat?: (newTitle: string) => Promise<void>;
  onDeleteChat?: () => Promise<void>;
  onSelectTopic?: (topic: string) => void;
  isBackendReady?: boolean | null;
  historyCount?: number;
  tripPreferences?: TripPreferences;
  onOpenWhere?: () => void;
  onOpenWhen?: () => void;
  onOpenWho?: () => void;
  onOpenBudget?: () => void;
  onOpenPreferences?: () => void;
  onCreateTripClick?: () => void;
  activeTrip?: TripResponse | null;
  isTripDetailOpen?: boolean;
  onToggleTripDetail?: () => void;
};

export function ChatHeader({
  chatTitle,
  onRenameChat,
  onDeleteChat,
  tripPreferences,
  onOpenWhere,
  onOpenWhen,
  onOpenWho,
  onOpenBudget,
  onOpenPreferences,
  onCreateTripClick,
  activeTrip,
  isTripDetailOpen,
  onToggleTripDetail,
}: ChatHeaderProps) {
  const { locale, t } = useTranslation();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(chatTitle || "");
  const [prevChatTitle, setPrevChatTitle] = useState(chatTitle);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Sync title during render if chatTitle changed externally
  if (prevChatTitle !== chatTitle) {
    setPrevChatTitle(chatTitle);
    setEditTitle(chatTitle || "");
  }

  const handleSaveRename = async () => {
    if (!editTitle.trim()) return;
    setIsRenaming(true);
    try {
      await onRenameChat?.(editTitle.trim());
      setIsRenameOpen(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteChat?.();
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format labels from tripPreferences
  const whereLabel = tripPreferences?.where?.location || t("trip.intakeWhere");

  let whenLabel = t("trip.intakeWhen");
  if (tripPreferences?.when) {
    whenLabel = formatWhenSelection({
      type: tripPreferences.when.type,
      startDate: tripPreferences.when.startDate,
      endDate: tripPreferences.when.endDate,
      durationDays: tripPreferences.when.durationDays,
      flexibleMonths: tripPreferences.when.flexibleMonths,
      locale,
    });
  }

  let whoLabel = t("trip.intakeWho");
  if (tripPreferences?.who) {
    const total =
      tripPreferences.who.adults +
      tripPreferences.who.children +
      tripPreferences.who.infants;
    if (total > 0) {
      whoLabel =
        total === 1
          ? t("trip.travelerCountOne")
          : t("trip.travelerCountMultiple", { count: total });
    }
  }

  let budgetLabel = t("trip.budget");
  if (tripPreferences?.budget && typeof tripPreferences.budget === "object") {
    budgetLabel =
      tripPreferences.budget.mode === "FLEXIBLE"
        ? "Flexible"
        : typeof tripPreferences.budget.amount === "number"
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: tripPreferences.budget.currency || "VND",
            maximumFractionDigits: 0,
          }).format(tripPreferences.budget.amount)
        : t("trip.budget");
  } else if (
    typeof tripPreferences?.budget === "string" &&
    tripPreferences.budget !== "any"
  ) {
    const budgetMap = {
      budget: "$",
      sensible: "$$",
      upscale: "$$$",
      luxury: "$$$$",
    };
    budgetLabel =
      budgetMap[tripPreferences.budget as keyof typeof budgetMap] || t("trip.budget");
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 md:px-6 backdrop-blur-md">
        {/* Left: Chat Title dropdown selector matching user's Mindtrip screenshot */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 -ml-2 rounded-xl hover:bg-muted/70 transition-colors text-left group cursor-pointer max-w-[200px] sm:max-w-[320px]"
              title={locale === "vi" ? "Tuỳ chọn cuộc trò chuyện" : "Chat options"}
            >
              <span className="font-semibold text-sm tracking-tight text-foreground truncate">
                {(!chatTitle || isGenericChatTitle(chatTitle))
                  ? (activeTrip?.destinationName
                      ? (locale === "vi" ? `Lịch trình ${activeTrip.destinationName}` : `Trip to ${activeTrip.destinationName}`)
                      : activeTrip?.name || t("aiPlanner.newChat"))
                  : chatTitle}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5 shadow-xl border-border/70">
            <DropdownMenuItem
              onClick={() => {
                setEditTitle(chatTitle || "");
                setIsRenameOpen(true);
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl cursor-pointer hover:bg-muted"
            >
              <Pencil className="size-4 text-muted-foreground" />
              <span>{t("aiPlanner.renameChat")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-500 hover:text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20 rounded-xl cursor-pointer"
            >
              <Trash2 className="size-4 text-red-500" />
              <span>{t("aiPlanner.deleteChat")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Center: Where | When | Who | Budget | Preferences pill group matching Mindtrip screenshot */}
        <div className="hidden sm:flex items-center rounded-full border border-border/80 bg-muted/20 px-1 py-0.5 text-xs text-muted-foreground divide-x divide-border/60 shadow-2xs">
          <button
            type="button"
            onClick={onOpenWhere}
            className={`px-3.5 py-1 hover:text-foreground transition-colors font-medium cursor-pointer max-w-[120px] truncate ${
              tripPreferences?.where?.location ? "text-foreground font-semibold" : ""
            }`}
          >
            {whereLabel}
          </button>
          <button
            type="button"
            onClick={onOpenWhen}
            className={`px-3.5 py-1 hover:text-foreground transition-colors font-medium cursor-pointer ${
              tripPreferences?.when?.startDate || tripPreferences?.when?.durationDays ? "text-foreground font-semibold" : ""
            }`}
          >
            {whenLabel}
          </button>
          <button
            type="button"
            onClick={onOpenWho}
            className={`px-3.5 py-1 hover:text-foreground transition-colors font-medium cursor-pointer ${
              tripPreferences?.who ? "text-foreground font-semibold" : ""
            }`}
          >
            {whoLabel}
          </button>
          <button
            type="button"
            onClick={onOpenBudget}
            className={`px-3.5 py-1 hover:text-foreground transition-colors font-medium cursor-pointer ${
              tripPreferences?.budget && tripPreferences.budget !== "any" ? "text-foreground font-semibold" : ""
            }`}
          >
            {budgetLabel}
          </button>
          <button
            type="button"
            onClick={onOpenPreferences}
            className={`px-3.5 py-1 hover:text-foreground transition-colors font-medium cursor-pointer ${
              tripPreferences?.preferences?.length ? "text-foreground font-semibold" : ""
            }`}
          >
            Preferences
          </button>
        </div>

        {/* Right: Create a trip button & Active trip toggle */}
        <div className="flex items-center gap-2">
          {activeTrip ? (
            <button
              type="button"
              onClick={onToggleTripDetail}
              className={`h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isTripDetailOpen
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 hover:bg-muted text-foreground"
              }`}
              title={
                isTripDetailOpen
                  ? locale === "vi"
                    ? "Đóng bảng chi tiết chuyến đi"
                    : "Close trip details panel"
                  : locale === "vi"
                  ? "Mở bảng chi tiết chuyến đi"
                  : "Open trip details panel"
              }
            >
              <Luggage className="size-3.5 shrink-0" />
              <span className="max-w-[140px] sm:max-w-[200px] truncate">
                {formatTripTitle(activeTrip.name, activeTrip.destinationName, locale)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateTripClick}
              className="h-8 px-3.5 rounded-full bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Luggage className="size-3.5 shrink-0" />
              <span>{t("nav.createTrip")}</span>
            </button>
          )}
        </div>
      </header>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t("aiPlanner.renameChat")}</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveRename();
                }
              }}
              placeholder={t("aiPlanner.renameChatPlaceholder")}
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              autoFocus
            />
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsRenameOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-border hover:bg-muted transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={isRenaming || !editTitle.trim()}
              onClick={() => void handleSaveRename()}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isRenaming ? t("aiPlanner.saving") : t("common.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600">{t("aiPlanner.deleteChat")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t("aiPlanner.deleteChatConfirm")}
          </p>
          <DialogFooter className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-border hover:bg-muted transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isDeleting ? t("aiPlanner.deleting") : t("aiPlanner.deleteChatAction")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
