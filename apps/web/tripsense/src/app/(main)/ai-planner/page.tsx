"use client";

import * as React from "react";
import { Sparkles, Send, MapPin, Calendar, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AiPlannerPage() {
  const [prompt, setPrompt] = React.useState("");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 px-3 py-1 font-semibold text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          TripSense AI Assistant
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Plan your dream trip in seconds
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tell us where you want to go, your travel style, or budget, and our AI will build a personalized day-by-day itinerary for you.
        </p>
      </div>

      {/* AI Prompt Input Card */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lg space-y-4">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Create a 4-day food and cultural trip to Da Nang and Hoi An for 2 people with a budget of $500..."
            className="w-full h-32 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="outline" size="sm" className="rounded-full h-8 text-xs gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>Destination</span>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-8 text-xs gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>3-5 Days</span>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-8 text-xs gap-1">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>2 Travelers</span>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-8 text-xs gap-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span>Moderate</span>
            </Button>
          </div>

          <Button className="rounded-full px-6 h-10 gap-2 font-semibold text-xs shadow-md">
            <span>Generate Itinerary</span>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
