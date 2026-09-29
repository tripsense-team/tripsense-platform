"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderBookmark,
  Sparkles,
  MapPin,
  Compass,
  ArrowRight,
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

interface CollectionItem {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  destination: string;
  coverUrl: string;
  badge?: string;
}

const collectionsList: CollectionItem[] = [
  {
    id: "col-1",
    title: "Best Coffee Shops & Workspaces in Da Nang",
    description: "High-speed Wi-Fi, artisanal Vietnamese pour-over, and ocean breezes.",
    itemCount: 8,
    destination: "Da Nang, Vietnam",
    coverUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80",
    badge: "Trending",
  },
  {
    id: "col-2",
    title: "Must-See Historic Shrines of Tokyo",
    description: "Ancient architecture, peaceful gardens, and spiritual history across Asakusa and Meiji Jingu.",
    itemCount: 12,
    destination: "Tokyo, Japan",
    coverUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80",
    badge: "AI Curated",
  },
  {
    id: "col-3",
    title: "Hoi An Ancient Town Evening Street Food",
    description: "Famous Cao Lau noodles, white rose dumplings, and lantern-lit river walks.",
    itemCount: 7,
    destination: "Hoi An, Vietnam",
    coverUrl: "https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "col-4",
    title: "Paris Hidden Rooftops & Secret Bistros",
    description: "Escape the tourist traps with curated local dining spots in Montmartre and Le Marais.",
    itemCount: 9,
    destination: "Paris, France",
    coverUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80",
  },
];

export default function CollectionsPage() {
  const { t } = useTranslation();

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <FolderBookmark className="h-3.5 w-3.5 mr-1" /> {t("nav.collections") || "Curated Collections"}
            </Badge>
            <span className="text-xs text-muted-foreground">Editor & Community Curations</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("nav.collections") || "Collections"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Thematic lists of destinations, dining spots, and cultural experiences.
          </p>
        </div>

        <Button asChild className="gap-2 shadow-xs self-start sm:self-auto">
          <Link href="/ai-planner">
            <Sparkles className="h-4 w-4" /> Generate New Collection
          </Link>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {collectionsList.map((col) => (
          <Card
            key={col.id}
            className="bg-card border-border shadow-2xs overflow-hidden group hover:shadow-xs transition-all flex flex-col sm:flex-row"
          >
            <div className="sm:w-48 h-48 sm:h-auto relative overflow-hidden bg-muted shrink-0">
              <img
                src={col.coverUrl}
                alt={col.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {col.badge && (
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground shadow-xs text-micro font-semibold">
                  {col.badge}
                </Badge>
              )}
            </div>

            <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{col.destination}</span>
                  <span>•</span>
                  <span className="font-mono">{col.itemCount} Spots</span>
                </div>
                <h3 className="font-bold text-foreground text-base leading-snug group-hover:text-primary transition-colors">
                  {col.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {col.description}
                </p>
              </div>

              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="text-xs gap-1.5 w-full sm:w-fit">
                  <Link href={`/places?collection=${col.id}`}>
                    <span>Explore Collection</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
