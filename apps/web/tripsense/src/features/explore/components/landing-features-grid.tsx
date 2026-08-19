import { Calendar, Map, Users, RefreshCw, Compass, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Calendar,
    title: "Smart Itineraries",
    description: "Generate optimized day-by-day travel schedules tailored to your preferences, travel style, and pace.",
  },
  {
    icon: Map,
    title: "Interactive Route Map",
    description: "Visualize all your places, routes, and travel times seamlessly on a real-time interactive map.",
  },
  {
    icon: Users,
    title: "Group Collaboration",
    description: "Invite friends and family to plan together, vote on places, and share travel memories in one hub.",
  },
  {
    icon: RefreshCw,
    title: "Real-time Syncing",
    description: "Access your trip plan anytime across all your devices, online or offline.",
  },
  {
    icon: Compass,
    title: "AI Recommendations",
    description: "Get smart suggestions for restaurants, hidden gems, and optimal visiting times.",
  },
  {
    icon: Bookmark,
    title: "Custom Collections",
    description: "Save places from Instagram, TikTok, or blogs into personal travel boards.",
  },
];

export function LandingFeaturesGrid() {
  return (
    <section id="features" className="py-16 md:py-24 bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold rounded-full border-border">
            Platform Features
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Everything you need for your next adventure.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Designed for modern travelers who want smart planning without the hassle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <Card key={feat.title} className="p-6 rounded-2xl border border-border bg-card shadow-2xs hover:shadow-md transition-all space-y-3">
                <div className="p-3 w-fit rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feat.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
