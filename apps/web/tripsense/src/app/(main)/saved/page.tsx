"use client";

import * as React from "react";
import Link from "next/link";
import {
  Heart,
  MapPin,
  Star,
  Sparkles,
  Plus,
  Trash2,
  Compass,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

interface SavedPlace {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviews: number;
  coverUrl: string;
  notes?: string;
}

const initialSavedPlaces: SavedPlace[] = [
  {
    id: "sp-1",
    name: "Dragon Bridge (Cầu Rồng)",
    category: "Attraction",
    city: "Da Nang, Vietnam",
    rating: 4.8,
    reviews: 3420,
    coverUrl: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80",
    notes: "Must visit on Saturday/Sunday night at 9 PM for fire show!",
  },
  {
    id: "sp-2",
    name: "Senso-ji Ancient Temple",
    category: "Culture",
    city: "Tokyo, Japan",
    rating: 4.9,
    reviews: 8910,
    coverUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80",
    notes: "Arrive at 7:30 AM before the tour buses.",
  },
  {
    id: "sp-3",
    name: "Hanoi Luxury Suites",
    category: "Hotel",
    city: "Hanoi, Vietnam",
    rating: 4.7,
    reviews: 520,
    coverUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80",
  },
];

export default function SavedPlacesPage() {
  const { t } = useTranslation();
  const [places, setPlaces] = React.useState<SavedPlace[]>(initialSavedPlaces);

  const removePlace = (id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs">
              <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 mr-1" /> {t("nav.savedPlaces") || "Saved Places"}
            </Badge>
            <span className="text-xs text-muted-foreground">My Travel Bookmarks</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("nav.savedPlaces") || "Saved Places"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Destinations, hotels, and attractions you have bookmarked for upcoming journeys.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="gap-2 shadow-xs">
            <Link href="/ai-planner">
              <Sparkles className="h-4 w-4" /> Plan Trip with Saved Places
            </Link>
          </Button>
        </div>
      </div>

      {/* Places Grid */}
      {places.length === 0 ? (
        <Card className="bg-card border-border p-12 text-center text-muted-foreground">
          <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No saved places yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Explore destinations on the map or ask the AI assistant, then click the heart icon to save spots here.
          </p>
          <Button asChild variant="outline" className="mt-4 text-xs">
            <Link href="/explore">Explore Destinations</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {places.map((place) => (
            <Card key={place.id} className="bg-card border-border shadow-2xs overflow-hidden group hover:shadow-xs transition-all flex flex-col">
              <div className="h-44 w-full relative overflow-hidden bg-muted">
                <img
                  src={place.coverUrl}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <Badge className="absolute top-3 left-3 bg-background/90 text-foreground backdrop-blur-md shadow-xs text-micro font-semibold">
                  {place.category}
                </Badge>
                <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-semibold shadow-xs">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{place.rating}</span>
                </div>
              </div>

              <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{place.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {place.city}
                  </p>
                  {place.notes && (
                    <p className="text-micro text-muted-foreground bg-muted/30 p-2 rounded mt-2 border border-border/40 italic">
                      "{place.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-primary">
                    <Link href={`/places?search=${encodeURIComponent(place.name)}`}>
                      <Compass className="h-3.5 w-3.5" /> View Place
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlace(place.id)}
                    className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
