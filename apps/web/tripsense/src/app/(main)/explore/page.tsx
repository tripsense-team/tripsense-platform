"use client";

import * as React from "react";
import Image from "next/image";
import { Compass, Sparkles, MapPin, Heart, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Rating } from "@/components/shared";

const categories = [
  { id: "all", name: "All Destinations", icon: Compass },
  { id: "trending", name: "🔥 Trending Now", icon: Sparkles },
  { id: "beach", name: "🏖️ Beach & Islands", icon: MapPin },
  { id: "nature", name: "🏔️ Mountain & Nature", icon: MapPin },
  { id: "culture", name: "🏛️ Culture & Heritage", icon: MapPin },
];

const mockDestinations = [
  {
    id: "1",
    name: "Da Nang & Hoi An Ancient Town",
    location: "Central Vietnam",
    image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80",
    rating: 4.9,
    reviews: 2840,
    price: "$450 / 4 days",
    category: "culture",
    tag: "Popular",
  },
  {
    id: "2",
    name: "Phu Quoc Tropical Island",
    location: "Kien Giang, Vietnam",
    image: "https://images.unsplash.com/photo-1540206395-68808572332f?w=800&auto=format&fit=crop&q=80",
    rating: 4.8,
    reviews: 1920,
    price: "$620 / 5 days",
    category: "beach",
    tag: "Best Beach",
  },
  {
    id: "3",
    name: "Ha Long Bay & Cat Ba",
    location: "Quang Ninh, Vietnam",
    image: "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop&q=80",
    rating: 4.95,
    reviews: 4150,
    price: "$380 / 3 days",
    category: "trending",
    tag: "UNESCO Heritage",
  },
  {
    id: "4",
    name: "Sapa Misty Mountains & Terraces",
    location: "Lao Cai, Vietnam",
    image: "https://images.unsplash.com/photo-1508672019048-805479767793?w=800&auto=format&fit=crop&q=80",
    rating: 4.75,
    reviews: 1430,
    price: "$290 / 3 days",
    category: "nature",
    tag: "Scenic Trail",
  },
  {
    id: "5",
    name: "Kyoto Ancient Temples & Bamboo Forest",
    location: "Kansai, Japan",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
    rating: 4.98,
    reviews: 5120,
    price: "$1,200 / 6 days",
    category: "culture",
    tag: "International",
  },
  {
    id: "6",
    name: "Bali Island & Ubud Sanctuary",
    location: "Indonesia",
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&auto=format&fit=crop&q=80",
    rating: 4.91,
    reviews: 3890,
    price: "$850 / 5 days",
    category: "beach",
    tag: "Relaxing",
  },
];

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredDestinations = mockDestinations.filter((dest) => {
    const matchesCategory = selectedCategory === "all" || dest.category === selectedCategory;
    const matchesSearch =
      dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-primary/90 via-primary to-primary/80 text-primary-foreground p-6 sm:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-4">
          <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-md">
            ✨ AI-Powered Discovery
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Where would you like to explore next?
          </h1>
          <p className="text-sm sm:text-base text-primary-foreground/90 leading-relaxed">
            Discover hand-crafted itineraries, hidden gems, and AI-personalized travel recommendations around the world.
          </p>

          {/* Quick Search Input */}
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur text-foreground p-2 rounded-2xl shadow-md max-w-xl">
            <Search className="h-5 w-5 text-muted-foreground ml-3 shrink-0" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by city, country, or vibe..."
              className="border-0 bg-transparent focus-visible:ring-0 text-sm"
            />
            <Button className="rounded-xl px-5 font-semibold text-xs shrink-0">Search</Button>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
          <Compass className="h-96 w-96" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.id)}
              className="rounded-full text-xs font-medium px-4 h-9 shrink-0 transition-all"
            >
              <span>{cat.name}</span>
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </Button>
      </div>

      {/* Destinations Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Featured Destinations ({filteredDestinations.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDestinations.map((dest) => (
            <div
              key={dest.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Image Container */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                <Image
                  src={dest.image}
                  alt={dest.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <Badge className="absolute top-3 left-3 bg-background/80 text-foreground backdrop-blur-md border-none font-semibold text-xs">
                  {dest.tag}
                </Badge>
                <button
                  type="button"
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center text-muted-foreground hover:text-rose-500 transition-colors shadow-2xs"
                >
                  <Heart className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Rating value={dest.rating} reviewCount={dest.reviews} />
                    <span className="text-xs font-semibold text-primary">{dest.price}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground mt-1.5 group-hover:text-primary transition-colors">
                    {dest.name}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{dest.location}</span>
                  </p>
                </div>

                <Button variant="outline" className="w-full rounded-xl text-xs font-semibold h-9">
                  Explore Itinerary
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
