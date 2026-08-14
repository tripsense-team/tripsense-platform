"use client";

import Image from "next/image";
import { Sparkles, Play, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LandingHeroProps {
  onOpenAuthModal?: (mode: "signin" | "signup") => void;
}

export function LandingHero({ onOpenAuthModal }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Hero Banner Canvas */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/90 via-orange-500/80 to-amber-600 p-8 sm:p-12 md:p-16 text-white shadow-xl min-h-[520px] md:min-h-[580px] flex flex-col justify-between">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/30 pointer-events-none" />

          {/* Hero Content Header */}
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/30 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              <span>Next-Gen AI Travel Companion</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              Travel <br className="hidden sm:inline" />
              differently.
            </h1>

            <p className="text-base sm:text-xl text-white/90 font-medium max-w-lg leading-relaxed">
              Plan trips, get personalized recommendations, and book all in one place with intelligent AI assistance.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => onOpenAuthModal?.("signup")}
                className="rounded-full bg-black text-white hover:bg-black/80 px-8 py-6 text-base font-semibold shadow-lg gap-2 border border-white/10"
              >
                <span>Start a trip</span>
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full bg-white/15 backdrop-blur-md border-white/30 text-white hover:bg-white/25 px-6 py-6 text-base font-semibold gap-2"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                </div>
                <span>Play video</span>
              </Button>
            </div>
          </div>

          {/* Floating UI Elements Showcase */}
          <div className="relative md:absolute bottom-6 right-6 md:bottom-10 md:right-10 z-10 mt-8 md:mt-0 flex flex-col sm:flex-row items-end sm:items-center gap-4 pointer-events-auto">
            {/* AI Prompt Floating Pill */}
            <div className="rounded-2xl bg-white/90 backdrop-blur-md p-3.5 text-black shadow-xl border border-white/40 flex items-center gap-3 max-w-xs animate-bounce-subtle">
              <Avatar className="h-9 w-9 border border-black/10 shrink-0">
                <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" alt="Traveler" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="text-xs">
                <p className="font-bold text-foreground">AI Travel Assistant</p>
                <p className="text-muted-foreground line-clamp-1">&quot;Suggesting 3-day Paris itinerary...&quot;</p>
              </div>
            </div>

            {/* Place Card Floating Badge */}
            <div className="rounded-2xl bg-black/80 backdrop-blur-md p-3 text-white shadow-2xl border border-white/20 flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0">
                <Image src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=300" alt="Eiffel Tower" fill className="object-cover" />
              </div>
              <div className="text-xs pr-2">
                <div className="flex items-center gap-1 font-bold">
                  <span>Eiffel Tower, Paris</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-amber-300 mt-0.5">
                  <Star className="h-3 w-3 fill-current" />
                  <span>4.9 (12.4k reviews)</span>
                </div>
              </div>
              <Heart className="h-4 w-4 text-red-400 fill-current ml-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
