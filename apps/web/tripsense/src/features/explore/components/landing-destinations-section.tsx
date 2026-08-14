"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DestinationCard } from "./destination-card";

const popularDestinations = [
  {
    name: "Paris",
    location: "France",
    description: "The city of light, world-class art, culinary delights, and iconic landmarks.",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600",
    rating: 4.9,
    reviewCount: 3420,
    category: "Culture",
    priceLevel: 3 as const,
    tags: ["Art", "Romance", "Food"],
  },
  {
    name: "Tokyo",
    location: "Japan",
    description: "Futuristic skyscrapers meet ancient temples, incredible street food, and vibrant nightlife.",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600",
    rating: 4.95,
    reviewCount: 5120,
    category: "Metropolis",
    priceLevel: 3 as const,
    tags: ["Technology", "Food", "Shopping"],
  },
  {
    name: "Swiss Alps",
    location: "Switzerland",
    description: "Breathtaking mountain peaks, crystal-clear lakes, and world-renowned alpine railways.",
    image: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=600",
    rating: 4.88,
    reviewCount: 1890,
    category: "Adventure",
    priceLevel: 4 as const,
    tags: ["Nature", "Skiing", "Scenic"],
  },
];

export function LandingDestinationsSection() {
  return (
    <section id="explore" className="py-16 md:py-24 bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold rounded-full border-border">
              Popular Destinations
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Explore handpicked places loved by travelers.
            </h2>
            <p className="text-base text-muted-foreground">
              Get inspired by curated locations, intelligent itineraries, and real traveler insights.
            </p>
          </div>

          <Link href="/explore">
            <Button variant="outline" className="rounded-full gap-2 px-5 font-semibold shrink-0">
              <span>View all destinations</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {popularDestinations.map((dest) => (
            <DestinationCard key={dest.name} {...dest} />
          ))}
        </div>
      </div>
    </section>
  );
}
