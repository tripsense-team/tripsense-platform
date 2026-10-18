"use client";

import * as React from "react";
import {
  CheckCircle2,
  Heart,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Vote,
  Sparkles,
  MapPin,
  Calendar,
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
import type { ItineraryDayResponse, ItineraryResponse } from "../types";

export interface PollIdea {
  id: string;
  title: string;
  proposedBy?: string;
  votes: number;
  userVoted?: "UP" | "DOWN" | null;
  pinnedDayId?: string | null;
}

const SAMPLE_IDEAS: Omit<PollIdea, "id">[] = [
  { title: "Ăn hải sản đêm bên bờ biển", votes: 3 },
  { title: "Thức dậy sớm đón bình minh", votes: 2 },
  { title: "Trải nghiệm chèo SUP ngắm hoàng hôn", votes: 4 },
];

export function TripActivityPollModal({
  open,
  onOpenChange,
  tripId,
  tripName,
  itinerary,
  onPinToDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
  itinerary?: ItineraryResponse | null;
  onPinToDay?: (dayId: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const storageKey = `tripsense:poll:${tripId}`;

  const [ideas, setIdeas] = React.useState<PollIdea[]>(() =>
    SAMPLE_IDEAS.map((idea, idx) => ({
      id: `poll-sample-${idx}`,
      title: idea.title,
      votes: (idea as any).votes || 1,
      userVoted: null,
      pinnedDayId: null,
    }))
  );
  const [newIdeaTitle, setNewIdeaTitle] = React.useState("");
  const [selectedDayId, setSelectedDayId] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setIdeas(JSON.parse(stored));
      } else {
        const initial = SAMPLE_IDEAS.map((idea, idx) => ({
          id: `poll-${Date.now()}-${idx}`,
          title: idea.title,
          votes: (idea as any).votes || 1,
          userVoted: null,
          pinnedDayId: null,
        }));
        setIdeas(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  const saveIdeas = (updated: PollIdea[]) => {
    setIdeas(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore
      }
    }
  };

  const handleVote = (id: string, direction: "UP" | "DOWN") => {
    saveIdeas(
      ideas.map((item) => {
        if (item.id !== id) return item;

        let voteDiff = 0;
        let nextVoted: "UP" | "DOWN" | null = direction;

        if (item.userVoted === direction) {
          // Cancel vote
          voteDiff = direction === "UP" ? -1 : 1;
          nextVoted = null;
        } else if (item.userVoted === null) {
          voteDiff = direction === "UP" ? 1 : -1;
        } else {
          // Switch vote
          voteDiff = direction === "UP" ? 2 : -2;
        }

        return {
          ...item,
          votes: item.votes + voteDiff,
          userVoted: nextVoted,
        };
      }),
    );
  };

  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle.trim()) return;

    const newIdea: PollIdea = {
      id: `poll-${Date.now()}`,
      title: newIdeaTitle.trim(),
      votes: 1,
      userVoted: "UP",
      pinnedDayId: null,
    };

    saveIdeas([...ideas, newIdea]);
    setNewIdeaTitle("");
  };

  const handleDelete = (id: string) => {
    saveIdeas(ideas.filter((it) => it.id !== id));
  };

  const handlePin = (idea: PollIdea) => {
    const targetDayId = selectedDayId || itinerary?.days?.[0]?.id;
    if (!targetDayId || !onPinToDay) return;

    onPinToDay(targetDayId, idea.title);

    saveIdeas(
      ideas.map((it) =>
        it.id === idea.id ? { ...it, pinnedDayId: targetDayId } : it,
      ),
    );
  };

  const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">
              {t("trip.pollTitle", { defaultValue: "Bình chọn ý tưởng hoạt động nhóm" })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {tripName} · {t("trip.pollDesc", { defaultValue: "Đề xuất địa điểm hoặc hoạt động để cả nhóm cùng vote trước khi xếp vào lịch." })}
          </DialogDescription>
        </DialogHeader>

        {/* Ideas List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
          {sortedIdeas.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t("trip.noIdeasYet", { defaultValue: "Chưa có ý tưởng nào. Hãy là người đầu tiên đề xuất!" })}
            </div>
          ) : (
            sortedIdeas.map((idea, index) => (
              <div
                key={idea.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-colors shadow-2xs gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-mono font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {idea.title}
                    </p>
                    {idea.pinnedDayId && (
                      <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("trip.pinnedToItinerary", { defaultValue: "Đã chốt vào lịch" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vote actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center rounded-xl bg-muted/60 p-0.5 border border-border/40">
                    <button
                      type="button"
                      onClick={() => handleVote(idea.id, "UP")}
                      className={`p-1.5 rounded-lg transition-colors ${
                        idea.userVoted === "UP"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Bình chọn thích"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-xs font-mono font-bold">
                      {idea.votes}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleVote(idea.id, "DOWN")}
                      className={`p-1.5 rounded-lg transition-colors ${
                        idea.userVoted === "DOWN"
                          ? "bg-destructive text-destructive-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Không đồng ý"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {itinerary?.days && itinerary.days.length > 0 && onPinToDay && !idea.pinnedDayId && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handlePin(idea)}
                      className="text-micro font-medium"
                      title="Chốt ý tưởng này vào lịch trình"
                    >
                      <Calendar className="h-3 w-3 mr-1 text-primary" />
                      {t("trip.pinToDay", { defaultValue: "Chốt vào lịch" })}
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(idea.id)}
                    className="text-muted-foreground/40 hover:text-destructive p-1 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add idea form */}
        <form onSubmit={handleAddIdea} className="pt-3 border-t border-border/60 flex gap-2">
          <Input
            value={newIdeaTitle}
            onChange={(e) => setNewIdeaTitle(e.target.value)}
            placeholder={t("trip.addIdeaPlaceholder", { defaultValue: "Đề xuất địa điểm hoặc hoạt động mới..." })}
            className="h-9 text-xs flex-1"
          />
          <Button type="submit" size="sm" className="h-9 gap-1 text-xs shrink-0 font-medium">
            <Plus className="h-4 w-4" />
            <span>{t("trip.propose", { defaultValue: "Đề xuất" })}</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
