import Image from "next/image";
import { Link2, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LandingInspiration() {
  return (
    <section className="py-16 md:py-24 bg-accent/40 border-y border-border/50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Column Text */}
          <div className="space-y-6">
            <Badge variant="secondary" className="px-3.5 py-1 text-xs font-semibold rounded-full">
              Instant Import
            </Badge>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Start with an idea <br />
              or a photo.
            </h2>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Saw a stunning place on Instagram, TikTok, or a travel blog? Paste the URL or drop a photo to instantly identify the location and add it to your trip itinerary.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span>Extract exact locations from social photos & URLs</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span>Auto-generate opening hours, reviews & nearby spots</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span>One-click add to your personal trip planner</span>
              </div>
            </div>

            <div className="pt-4">
              <Button className="rounded-full gap-2 px-6 py-5 text-sm font-semibold">
                <span>Try Instant Import</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right Column Interactive Visual Card */}
          <div className="relative">
            <Card className="p-6 rounded-3xl border border-border bg-card shadow-xl space-y-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/70 border border-border/60 text-xs text-muted-foreground">
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">https://instagram.com/p/travel-inspiration-rio</span>
                <Badge variant="outline" className="ml-auto text-[10px] shrink-0 bg-background">
                  Imported
                </Badge>
              </div>

              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-muted">
                <Image
                  src="https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800"
                  alt="Rio de Janeiro Mountain"
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-background/90 backdrop-blur border border-border/80 shadow-lg flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-bold text-foreground">Sugarloaf Mountain</p>
                    <p className="text-muted-foreground">Rio de Janeiro, Brazil</p>
                  </div>
                  <Badge variant="default" className="gap-1 text-xs px-2.5 py-1 rounded-lg">
                    <Sparkles className="h-3 w-3 text-amber-200" />
                    <span>Matched</span>
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
