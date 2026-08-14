"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Calendar, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockTrips = [
  {
    id: "trip-1",
    title: "Summer Getaway to Da Nang & Hoi An",
    destination: "Da Nang, Vietnam",
    dates: "Aug 20 - Aug 24, 2026",
    status: "Upcoming",
    daysCount: 5,
    spotsCount: 12,
    cover: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "trip-2",
    title: "Autumn Escape in Kyoto",
    destination: "Kyoto, Japan",
    dates: "Nov 10 - Nov 16, 2026",
    status: "Planning",
    daysCount: 7,
    spotsCount: 18,
    cover: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
  },
];

export default function TripsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">My Trips</h1>
          <p className="text-sm text-muted-foreground">Manage your upcoming itineraries, saved plans, and past travel memories.</p>
        </div>
        <Button className="rounded-full px-5 gap-2 font-semibold text-xs h-10 shadow-xs self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>Create New Trip</span>
        </Button>
      </div>

      {/* Trips List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockTrips.map((trip) => (
          <div
            key={trip.id}
            className="group flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:shadow-md"
          >
            <div className="relative aspect-16/9 sm:aspect-square sm:w-48 shrink-0 bg-muted overflow-hidden">
              <Image
                src={trip.cover}
                alt={trip.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <Badge
                variant={trip.status === "Upcoming" ? "default" : "secondary"}
                className="absolute top-3 left-3 text-[10px] font-bold"
              >
                {trip.status}
              </Badge>
            </div>
            <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
              <div className="space-y-2">
                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                  {trip.title}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{trip.destination}</span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{trip.dates}</span>
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {trip.daysCount} days
                  </span>
                  <span>•</span>
                  <span>{trip.spotsCount} places</span>
                </div>
                <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold text-primary">
                  View Plan
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
