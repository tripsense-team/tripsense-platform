"use client";

import * as React from "react";
import Image from "next/image";
import { Search, MapPin, Sparkles, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const samplePlaces = [
  {
    title: "Kyoto Gardens",
    location: "Kyoto, Japan",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=500",
    tag: "Nature",
  },
  {
    title: "Amalfi Coast",
    location: "Salerno, Italy",
    image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=500",
    tag: "Coastal",
  },
  {
    title: "Santorini Sunset",
    location: "Cyclades, Greece",
    image: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=500",
    tag: "Romantic",
  },
];

export function LandingHowItWorks() {
  const [query, setQuery] = React.useState("");

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold rounded-full border-border">
            How it works
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            From inspiration to itinerary in seconds.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Type any destination, upload a photo, or ask our AI to create your dream trip itinerary tailored to your exact pace and taste.
          </p>
        </div>

        {/* AI Prompt Query Bar Box */}
        <div className="max-w-2xl mx-auto">
          <Card className="p-2 sm:p-3 rounded-2xl border border-border bg-card shadow-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground ml-3 shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Where do you want to go? e.g. 5 days in Switzerland with scenic trains"
              className="border-0 shadow-none focus-visible:ring-0 text-sm sm:text-base placeholder:text-muted-foreground/70"
            />
            <Button size="sm" className="rounded-xl px-4 py-5 gap-2 shrink-0">
              <span>Ask AI</span>
              <Sparkles className="h-4 w-4 text-amber-200" />
            </Button>
          </Card>
        </div>

        {/* Photo Grid Collage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
          {samplePlaces.map((place, idx) => (
            <Card key={idx} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <Image
                  src={place.image}
                  alt={place.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur font-medium">
                    {place.tag}
                  </Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <div className="p-2 rounded-full bg-background/80 backdrop-blur text-foreground shadow-xs">
                    <Heart className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                  {place.title}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{place.location}</span>
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
