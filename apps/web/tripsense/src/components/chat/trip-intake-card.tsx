"use client";

import React, { useState, useTransition, useCallback } from "react";
import {
  MapPin,
  Calendar,
  Users,
  Wallet,
  Check,
  ChevronLeft,
  X,
  Loader2,
  Plus,
  Minus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  patchPlanningBrief,
  cancelPlanningBrief,
} from "@/features/ai-trip-commit/services/ai-trip-commit-api";
import type {
  TripBriefState,
  TripPlanningBrief,
} from "@/features/ai-trip-commit/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type IntakeStep = "WHERE" | "WHEN" | "WHO" | "BUDGET";

interface TripIntakeCardProps {
  chatId?: string;
  initialState: TripBriefState;
  isLatestMessage?: boolean;
}

const POPULAR_DESTINATIONS = [
  "Đà Nẵng",
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Lạt",
  "Phú Quốc",
  "Nha Trang",
];

function getWeekendDates(offsetWeeks = 0): { startDate: string; endDate: string } {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 6 is Saturday
  let daysUntilSaturday = (6 - day + 7) % 7;
  if (daysUntilSaturday === 0 && day === 6 && offsetWeeks === 0) {
    daysUntilSaturday = 0;
  } else if (daysUntilSaturday === 0 && offsetWeeks === 0) {
    daysUntilSaturday = 7;
  }
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysUntilSaturday + offsetWeeks * 7);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  return {
    startDate: sat.toISOString().slice(0, 10),
    endDate: sun.toISOString().slice(0, 10),
  };
}

function getNextWeekDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const day = now.getDay();
  const daysUntilNextMon = ((1 - day + 7) % 7) || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() + daysUntilNextMon);
  const wed = new Date(mon);
  wed.setDate(mon.getDate() + 2);

  return {
    startDate: mon.toISOString().slice(0, 10),
    endDate: wed.toISOString().slice(0, 10),
  };
}

export function TripIntakeCard({
  chatId: propChatId,
  initialState,
  isLatestMessage = true,
}: TripIntakeCardProps) {
  const { t } = useTranslation();
  const { chatId: activeChatId, sendMessage } = useActiveChat();
  const resolvedChatId = propChatId || activeChatId;

  const [state, setState] = useState<TripBriefState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active question step
  const determineInitialStep = (): IntakeStep => {
    if (state.missingFields && state.missingFields.length > 0) {
      return state.missingFields[0];
    }
    return "WHERE";
  };

  const [currentStep, setCurrentStep] = useState<IntakeStep>(determineInitialStep);
  const [showCustomWhere, setShowCustomWhere] = useState(false);
  const [customWhereText, setCustomWhereText] = useState("");

  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(
    state.brief.when?.startDate || ""
  );
  const [customEndDate, setCustomEndDate] = useState(
    state.brief.when?.endDate || ""
  );

  const [showCustomWho, setShowCustomWho] = useState(false);
  const [customAdults, setCustomAdults] = useState(state.brief.who?.adults || 2);
  const [customChildren, setCustomChildren] = useState(
    state.brief.who?.children || 0
  );
  const [customInfants, setCustomInfants] = useState(
    state.brief.who?.infants || 0
  );
  const [customPets, setCustomPets] = useState(state.brief.who?.pets || 0);

  const [showCustomBudget, setShowCustomBudget] = useState(false);
  const [customBudgetAmount, setCustomBudgetAmount] = useState(
    state.brief.budget?.mode === "TOTAL" ? String(state.brief.budget.amount) : ""
  );
  const [customBudgetCurrency, setCustomBudgetCurrency] = useState(
    state.brief.budget?.mode === "TOTAL" ? state.brief.budget.currency : "VND"
  );

  const handleApplyPatch = useCallback(
    (patch: Partial<TripPlanningBrief>) => {
      if (!resolvedChatId) return;
      setErrorMsg(null);

      startTransition(async () => {
        try {
          const res = await patchPlanningBrief({
            chatId: resolvedChatId,
            expectedVersion: state.version,
            patch,
          });

          if (res.accepted) {
            setState(res.state);

            if (res.state.status === "TRIP_LINKED") {
              window.dispatchEvent(
                new CustomEvent("tripsense:chat-trip-linked", {
                  detail: { chatId: resolvedChatId },
                })
              );
            } else if (res.state.missingFields && res.state.missingFields.length > 0) {
              setCurrentStep(res.state.missingFields[0]);
              setShowCustomWhere(false);
              setShowCustomDates(false);
              setShowCustomWho(false);
              setShowCustomBudget(false);
            }
          }
        } catch {
          setErrorMsg(t("aiPlanner.commitError"));
        }
      });
    },
    [resolvedChatId, state.version, t]
  );

  const handleCancel = useCallback(() => {
    if (!resolvedChatId) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await cancelPlanningBrief(resolvedChatId);
        if (res.accepted) {
          setState(res.state);
        }
      } catch {
        setErrorMsg(t("aiPlanner.commitError"));
      }
    });
  }, [resolvedChatId, t]);

  // If already linked/completed, render clean persistent summary
  if (state.status === "TRIP_LINKED" || state.status === "COMPLETED") {
    return (
      <div className="my-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 backdrop-blur-sm transition-all shadow-[var(--shadow-card)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="size-3" />
            </div>
            <span>{t("aiPlanner.intake.tripLinked")}</span>
          </div>

          {state.status === "TRIP_LINKED" && isLatestMessage && (
            <Button
              size="sm"
              onClick={() => {
                sendMessage({
                  parts: [
                    {
                      type: "text",
                      text: t("aiPlanner.intake.generatePrompt"),
                    },
                  ],
                  role: "user",
                });
              }}
              className="rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-xs"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              <span>{t("aiPlanner.intake.generateAction")}</span>
            </Button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {state.brief.where?.destinationText && (
            <span className="flex items-center gap-1 rounded-lg bg-card/80 border border-border/50 px-2.5 py-1">
              <MapPin className="size-3 text-primary" />
              {state.brief.where.destinationText}
            </span>
          )}
          {state.brief.when?.startDate && (
            <span className="flex items-center gap-1 rounded-lg bg-card/80 border border-border/50 px-2.5 py-1">
              <Calendar className="size-3 text-primary" />
              {state.brief.when.startDate} → {state.brief.when.endDate}
            </span>
          )}
          {state.brief.who && (
            <span className="flex items-center gap-1 rounded-lg bg-card/80 border border-border/50 px-2.5 py-1">
              <Users className="size-3 text-primary" />
              {state.brief.who.adults +
                state.brief.who.children +
                state.brief.who.infants}{" "}
              {t("aiPlanner.intake.stepWho")}
            </span>
          )}
          {state.brief.budget && (
            <span className="flex items-center gap-1 rounded-lg bg-card/80 border border-border/50 px-2.5 py-1">
              <Wallet className="size-3 text-primary" />
              {state.brief.budget.mode === "FLEXIBLE"
                ? t("aiPlanner.intake.budgetFlexible")
                : `${state.brief.budget.amount.toLocaleString()} ${state.brief.budget.currency}`}
            </span>
          )}
        </div>
      </div>
    );
  }

  // If cancelled
  if (state.status === "CANCELLED") {
    return (
      <div className="my-2 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>{t("aiPlanner.intake.cancelled")}</span>
      </div>
    );
  }

  // Steps definition for header indicators
  const stepsList: Array<{ id: IntakeStep; label: string; icon: any; isDone: boolean }> = [
    {
      id: "WHERE",
      label: t("aiPlanner.intake.stepWhere"),
      icon: MapPin,
      isDone: Boolean(state.brief.where?.destinationText),
    },
    {
      id: "WHEN",
      label: t("aiPlanner.intake.stepWhen"),
      icon: Calendar,
      isDone: Boolean(state.brief.when?.startDate && state.brief.when?.endDate),
    },
    {
      id: "WHO",
      label: t("aiPlanner.intake.stepWho"),
      icon: Users,
      isDone: Boolean(state.brief.who && state.brief.who.adults > 0),
    },
    {
      id: "BUDGET",
      label: t("aiPlanner.intake.stepBudget"),
      icon: Wallet,
      isDone: Boolean(state.brief.budget),
    },
  ];

  const currentStepIndex = stepsList.findIndex((s) => s.id === currentStep);

  return (
    <div className="my-2.5 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card/95 to-card/80 shadow-[var(--shadow-card)] backdrop-blur-md transition-all">
      {/* Step Indicator Header */}
      <div className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span className="text-xs font-semibold text-foreground">
              {t("aiPlanner.intake.title")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {stepsList.map((s, idx) => {
              const isActive = s.id === currentStep;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    if (s.isDone || idx <= currentStepIndex) {
                      setCurrentStep(s.id);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : s.isDone
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                      : "bg-muted text-muted-foreground/70"
                  )}
                  disabled={!s.isDone && idx > currentStepIndex}
                >
                  {s.isDone ? (
                    <Check className="size-2.5" />
                  ) : (
                    <s.icon className="size-2.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Interactive Question Area */}
      <div className="p-4 space-y-4">
        {/* Error notification */}
        {errorMsg && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* STEP 1: WHERE */}
        {currentStep === "WHERE" && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" />
              {t("aiPlanner.intake.whereTitle")}
            </div>

            <div className="flex flex-wrap gap-2">
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  type="button"
                  key={dest}
                  disabled={isPending}
                  onClick={() =>
                    handleApplyPatch({
                      where: { destinationText: dest },
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40",
                    state.brief.where?.destinationText === dest &&
                      "border-primary bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <MapPin className="size-3 text-muted-foreground" />
                  <span>{dest}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowCustomWhere((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground active:scale-95"
              >
                <span>{t("aiPlanner.intake.whereOther")}</span>
              </button>
            </div>

            {showCustomWhere && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                <input
                  type="text"
                  value={customWhereText}
                  onChange={(e) => setCustomWhereText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customWhereText.trim()) {
                      e.preventDefault();
                      handleApplyPatch({
                        where: { destinationText: customWhereText.trim() },
                      });
                    }
                  }}
                  placeholder={t("aiPlanner.intake.wherePlaceholder")}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  size="sm"
                  disabled={!customWhereText.trim() || isPending}
                  onClick={() =>
                    handleApplyPatch({
                      where: { destinationText: customWhereText.trim() },
                    })
                  }
                  className="rounded-xl px-3 text-xs"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: WHEN */}
        {currentStep === "WHEN" && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="size-4 text-primary" />
              {t("aiPlanner.intake.whenTitle")}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const dates = getWeekendDates(0);
                  handleApplyPatch({ when: dates });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <Calendar className="size-3 text-muted-foreground" />
                <span>{t("aiPlanner.intake.thisWeekend")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const dates = getWeekendDates(1);
                  handleApplyPatch({ when: dates });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <Calendar className="size-3 text-muted-foreground" />
                <span>{t("aiPlanner.intake.nextWeekend")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const dates = getNextWeekDates();
                  handleApplyPatch({ when: dates });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <Calendar className="size-3 text-muted-foreground" />
                <span>{t("aiPlanner.intake.nextWeek")}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomDates((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground active:scale-95"
              >
                <span>{t("aiPlanner.intake.customDates")}</span>
              </button>
            </div>

            {showCustomDates && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <span className="block text-micro text-muted-foreground mb-1">
                      {t("aiPlanner.intake.startDate")}
                    </span>
                    <input
                      type="date"
                      value={customStartDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-micro text-muted-foreground mb-1">
                      {t("aiPlanner.intake.endDate")}
                    </span>
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={
                    !customStartDate ||
                    !customEndDate ||
                    customStartDate > customEndDate ||
                    isPending
                  }
                  onClick={() =>
                    handleApplyPatch({
                      when: {
                        startDate: customStartDate,
                        endDate: customEndDate,
                      },
                    })
                  }
                  className="rounded-xl px-4 text-xs mt-2 sm:mt-4"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span>{t("aiPlanner.intake.confirm")}</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: WHO */}
        {currentStep === "WHO" && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="size-4 text-primary" />
              {t("aiPlanner.intake.whoTitle")}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    who: { adults: 1, children: 0, infants: 0, pets: 0 },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.solo")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    who: { adults: 2, children: 0, infants: 0, pets: 0 },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.twoPeople")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    who: { adults: 2, children: 1, infants: 0, pets: 0 },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.family")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    who: { adults: 4, children: 0, infants: 0, pets: 0 },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.group")}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomWho((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground active:scale-95"
              >
                <span>{t("aiPlanner.intake.customTravelers")}</span>
              </button>
            </div>

            {showCustomWho && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Adults */}
                  <div className="flex flex-col items-center justify-between rounded-lg border border-border/50 bg-card p-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t("aiPlanner.intake.adults")}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomAdults((n) => Math.max(1, n - 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="font-semibold text-xs min-w-4 text-center">
                        {customAdults}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomAdults((n) => Math.min(100, n + 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div className="flex flex-col items-center justify-between rounded-lg border border-border/50 bg-card p-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t("aiPlanner.intake.children")}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomChildren((n) => Math.max(0, n - 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="font-semibold text-xs min-w-4 text-center">
                        {customChildren}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomChildren((n) => Math.min(100, n + 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Infants */}
                  <div className="flex flex-col items-center justify-between rounded-lg border border-border/50 bg-card p-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t("aiPlanner.intake.infants")}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomInfants((n) => Math.max(0, n - 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="font-semibold text-xs min-w-4 text-center">
                        {customInfants}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomInfants((n) => Math.min(100, n + 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Pets */}
                  <div className="flex flex-col items-center justify-between rounded-lg border border-border/50 bg-card p-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t("aiPlanner.intake.pets")}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomPets((n) => Math.max(0, n - 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="font-semibold text-xs min-w-4 text-center">
                        {customPets}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomPets((n) => Math.min(20, n + 1))}
                        className="size-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      handleApplyPatch({
                        who: {
                          adults: customAdults,
                          children: customChildren,
                          infants: customInfants,
                          pets: customPets,
                        },
                      })
                    }
                    className="rounded-xl px-4 text-xs"
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span>{t("aiPlanner.intake.confirm")}</span>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: BUDGET */}
        {currentStep === "BUDGET" && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wallet className="size-4 text-primary" />
              {t("aiPlanner.intake.budgetTitle")}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    budget: { mode: "FLEXIBLE" },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.budgetFlexible")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    budget: { mode: "TOTAL", amount: 5000000, currency: "VND" },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.budgetEconomy")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    budget: { mode: "TOTAL", amount: 10000000, currency: "VND" },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.budgetStandard")}</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleApplyPatch({
                    budget: { mode: "TOTAL", amount: 20000000, currency: "VND" },
                  })
                }
                className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
              >
                <span>{t("aiPlanner.intake.budgetLuxury")}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomBudget((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground active:scale-95"
              >
                <span>{t("aiPlanner.intake.customAmount")}</span>
              </button>
            </div>

            {showCustomBudget && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={customBudgetAmount}
                  onChange={(e) => setCustomBudgetAmount(e.target.value)}
                  placeholder="5000000"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                />
                <select
                  value={customBudgetCurrency}
                  onChange={(e) => setCustomBudgetCurrency(e.target.value)}
                  className="rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                </select>
                <Button
                  size="sm"
                  disabled={
                    !customBudgetAmount ||
                    Number(customBudgetAmount) < 0 ||
                    isPending
                  }
                  onClick={() =>
                    handleApplyPatch({
                      budget: {
                        mode: "TOTAL",
                        amount: Number(customBudgetAmount),
                        currency: customBudgetCurrency,
                      },
                    })
                  }
                  className="rounded-xl px-4 text-xs"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span>{t("aiPlanner.intake.confirm")}</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation: Back & Cancel */}
      <div className="flex items-center justify-between border-t border-border/40 bg-muted/10 px-4 py-2.5 text-xs">
        <div>
          {currentStepIndex > 0 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const prev = stepsList[currentStepIndex - 1];
                if (prev) setCurrentStep(prev.id);
              }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ChevronLeft className="size-3.5" />
              <span>{t("aiPlanner.intake.back")}</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              <span>{t("aiPlanner.intake.saving")}</span>
            </div>
          )}

          <button
            type="button"
            disabled={isPending}
            onClick={handleCancel}
            className="text-xs text-muted-foreground/80 hover:text-destructive transition-colors"
          >
            {t("aiPlanner.intake.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
