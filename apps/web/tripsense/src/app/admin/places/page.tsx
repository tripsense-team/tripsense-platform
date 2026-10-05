"use client";

import * as React from "react";
import {
  MapPin,
  Search,
  Plus,
  Star,
  CheckCircle,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PlaceRecord {
  id: string;
  name: string;
  category: "HOTEL" | "ATTRACTION" | "RESTAURANT" | "CULTURE";
  city: string;
  rating: number;
  reviewCount: number;
  provider: "Ziomap" | "OSM" | "Local";
  verified: boolean;
  coverUrl: string;
}

const initialPlaces: PlaceRecord[] = [
  {
    id: "pl-1",
    name: "Dragon Bridge (Cầu Rồng)",
    category: "ATTRACTION",
    city: "Da Nang, Vietnam",
    rating: 4.8,
    reviewCount: 3420,
    provider: "Ziomap",
    verified: true,
    coverUrl: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "pl-2",
    name: "Senso-ji Ancient Temple",
    category: "CULTURE",
    city: "Tokyo, Japan",
    rating: 4.9,
    reviewCount: 8910,
    provider: "Ziomap",
    verified: true,
    coverUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "pl-3",
    name: "Hanoi Luxury Grand Hotel",
    category: "HOTEL",
    city: "Hanoi, Vietnam",
    rating: 4.7,
    reviewCount: 520,
    provider: "Local",
    verified: true,
    coverUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "pl-4",
    name: "Bà Nà Hills SunWorld",
    category: "ATTRACTION",
    city: "Da Nang, Vietnam",
    rating: 4.7,
    reviewCount: 6150,
    provider: "Ziomap",
    verified: true,
    coverUrl: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "pl-5",
    name: "Sukiyabashi Jiro Sushi",
    category: "RESTAURANT",
    city: "Tokyo, Japan",
    rating: 4.6,
    reviewCount: 840,
    provider: "OSM",
    verified: false,
    coverUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
  },
];

export default function AdminPlacesPage() {
  const [places, setPlaces] = React.useState<PlaceRecord[]>(initialPlaces);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  const filteredPlaces = places.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === "ALL" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const toggleVerified = (id: string) => {
    setPlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, verified: !p.verified } : p)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <MapPin className="h-3.5 w-3.5 mr-1" /> Geospatial Catalog
            </Badge>
            <span className="text-xs text-muted-foreground">Place Service & Ziomap</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Destinations & Places</h1>
          <p className="text-sm text-muted-foreground">
            Curate points of interest, sync with Ziomap/OSM, and verify traveler destinations.
          </p>
        </div>

        <Button className="gap-2 shadow-xs self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add New Place
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by place name or city..."
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
          {["ALL", "ATTRACTION", "HOTEL", "RESTAURANT", "CULTURE"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                categoryFilter === cat
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Places Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPlaces.map((place) => (
          <Card key={place.id} className="bg-card border-border shadow-2xs overflow-hidden group hover:shadow-xs transition-all">
            <div className="h-44 w-full relative overflow-hidden bg-muted">
              {/* Image */}
              <img
                src={place.coverUrl}
                alt={place.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge className="bg-background/90 text-foreground backdrop-blur-md shadow-xs text-micro font-semibold">
                  {place.category}
                </Badge>
                <Badge variant="outline" className="bg-background/80 backdrop-blur-md text-micro">
                  {place.provider}
                </Badge>
              </div>
              <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-semibold shadow-xs">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{place.rating}</span>
                <span className="text-micro text-muted-foreground">({place.reviewCount})</span>
              </div>
            </div>

            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-bold text-foreground text-sm truncate">{place.name}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {place.city}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                <button
                  type="button"
                  onClick={() => toggleVerified(place.id)}
                  className={`flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors ${
                    place.verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{place.verified ? "Verified Official" : "Unverified Place"}</span>
                </button>

                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground">
                  <Eye className="h-3.5 w-3.5" /> Inspect
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
