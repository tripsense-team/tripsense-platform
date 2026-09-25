"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Check, UserPlus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { SuggestedCreator } from "../types";

interface SuggestedCreatorsWidgetProps {
  creators: SuggestedCreator[];
  onToggleFollow: (creatorId: string) => void;
  followingMap?: Record<string, boolean>;
}

export function SuggestedCreatorsWidget({
  creators,
  onToggleFollow,
  followingMap = {},
}: SuggestedCreatorsWidgetProps) {
  const { t } = useTranslation();

  if (!creators || creators.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              {t("social.suggestedCreators")}
            </h2>
            <p className="text-micro text-muted-foreground">
              {t("social.suggestedCreatorsSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Creator List */}
      <div className="mt-4 space-y-3">
        {creators.map((creator) => {
          const isPending = !!followingMap[creator.id];
          const initials = creator.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div
              key={creator.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 p-2.5 transition-colors hover:bg-muted/70"
            >
              {/* Creator Info */}
              <Link
                href={`/community/users/${creator.id}`}
                className="flex items-center gap-2.5 min-w-0 group flex-1 focus-visible:outline-hidden"
              >
                <Avatar className="h-10 w-10 shrink-0 group-hover:scale-105 transition-transform">
                  <AvatarImage src={creator.avatar} alt={creator.name} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {creator.name}
                  </p>
                  <p className="text-micro text-muted-foreground truncate">
                    {creator.nicheKey
                      ? t(`social.${creator.nicheKey}`)
                      : creator.niche}
                  </p>
                  <p className="text-micro text-muted-foreground/80 mt-0.5">
                    {t("social.followersCount", {
                      count: creator.followerCount,
                    })}
                  </p>
                </div>
              </Link>

              {/* Follow Button */}
              <Button
                type="button"
                size="sm"
                variant={creator.isFollowing ? "secondary" : "outline"}
                disabled={isPending}
                onClick={() => onToggleFollow(creator.id)}
                className={`shrink-0 rounded-full text-xs font-semibold px-3 transition-all ${
                  creator.isFollowing
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span>
                      {creator.isFollowing
                        ? t("social.following")
                        : t("social.follow")}
                    </span>
                  </>
                ) : creator.isFollowing ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    <span>{t("social.following")}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3 mr-1" />
                    <span>{t("social.follow")}</span>
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
