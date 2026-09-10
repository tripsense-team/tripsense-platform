"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Clock, Edit3, Eye, Globe2, Lock, MapPin, Route, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { socialPostRepository } from "../services";
import type { SocialPost } from "../types";
import type { Place } from "@/features/places/types";
import { resolveSharedTripMapPlaces, sharedTripItemCount } from "../utils/shared-trip";

type Visibility = NonNullable<SocialPost["visibility"]>;

const MapVinaContainer = dynamic(
  () => import("@/features/map/components/mapvina-container").then((mod) => mod.MapVinaContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-muted text-sm font-semibold text-muted-foreground">
        Loading MapVina...
      </div>
    ),
  }
);

interface SharedTripDetailViewProps {
  post: SocialPost;
  onUpdated?: () => void;
}

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function titleCase(value?: string | null) {
  if (!value) return "Destination not set";
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return "Dates not set";
  if (!startDate) return endDate ?? "Dates not set";
  if (!endDate || startDate === endDate) return startDate;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`;
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function visibilityLabel(visibility?: SocialPost["visibility"]) {
  switch (visibility) {
    case "PRIVATE":
      return "Only me";
    case "UNLISTED":
      return "Community";
    default:
      return "Public";
  }
}

const visibilityOptions: Array<{
  value: Visibility;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "PUBLIC",
    title: "Public",
    description: "Anyone on TripSense can discover this post in Community.",
    icon: Globe2,
  },
  {
    value: "UNLISTED",
    title: "Unlisted",
    description: "Visible to signed-in community members and from direct links.",
    icon: Users,
  },
  {
    value: "PRIVATE",
    title: "Private",
    description: "Only you can see this post in Community.",
    icon: Lock,
  },
];

function StatBlock({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </p>
      <p className="mt-2 text-base font-black text-foreground">{value}</p>
    </div>
  );
}

function VisibilityEditor({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-black uppercase tracking-normal text-foreground">Privacy</h3>
        <p className="text-sm text-muted-foreground">Choose who can see this shared trip post.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visibilityOptions.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                selected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-muted hover:bg-accent"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </span>
              </div>
              <h4 className="mt-4 text-base font-black text-foreground">{option.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatTimeRange(startTime?: string | null, endTime?: string | null) {
  const values = [startTime, endTime].filter(Boolean).map((value) => String(value).slice(0, 5));
  return values.length > 0 ? values.join(" - ") : "No time set";
}

function firstCenter(places: Array<{ location?: { lat: number; lng: number } }>): [number, number] | undefined {
  const place = places.find((item) => item.location);
  return place?.location ? [place.location.lng, place.location.lat] : undefined;
}

export function SharedTripDetailView({ post, onUpdated }: SharedTripDetailViewProps) {
  const user = useAuthStore((state) => state.user);
  const trip = post.trip;
  const [editing, setEditing] = React.useState(false);
  const [caption, setCaption] = React.useState(post.content ?? "");
  const [draftVisibility, setDraftVisibility] = React.useState<Visibility>(post.visibility ?? "PUBLIC");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [mapPlaces, setMapPlaces] = React.useState<Place[]>([]);

  React.useEffect(() => {
    if (!trip) return;

    const controller = new AbortController();
    void resolveSharedTripMapPlaces(trip, controller.signal).then((places) => {
      if (!controller.signal.aborted) {
        setMapPlaces(places);
      }
    });

    return () => controller.abort();
  }, [trip]);

  if (!trip) return null;

  const itineraryDays = trip.itineraryDays ?? [];
  const snapshotItemCount = sharedTripItemCount(itineraryDays) || trip.itineraryItemCount || 0;
  const isOwner = user?.id === post.author.id;
  const highlights = trip.highlights ?? [];
  const center = firstCenter(mapPlaces);

  function startEditor() {
    setCaption(post.content ?? "");
    setDraftVisibility(post.visibility ?? "PUBLIC");
    setError(null);
    setEditing(true);
  }

  function resetEditor() {
    setCaption(post.content ?? "");
    setDraftVisibility(post.visibility ?? "PUBLIC");
    setError(null);
    setEditing(false);
  }

  async function savePostSettings() {
    setSaving(true);
    setError(null);
    try {
      const captionChanged = caption !== (post.content ?? "");
      const visibilityChanged = draftVisibility !== (post.visibility ?? "PUBLIC");

      if (captionChanged) {
        const updated = await socialPostRepository.updatePostContent(post.id, { content: caption });
        setCaption(updated.content ?? "");
      }

      if (visibilityChanged) {
        const updated = await socialPostRepository.updatePostVisibility(post.id, draftVisibility);
        setDraftVisibility(updated.visibility ?? draftVisibility);
      }

      setEditing(false);
      if (captionChanged || visibilityChanged) {
        onUpdated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xs">
      <section className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-border">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">{initials(post.author.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-sm font-black text-foreground">{post.author.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-bold">{visibilityLabel(post.visibility)}</Badge>
                <span>Shared trip snapshot</span>
              </div>
            </div>
          </div>
          {isOwner && !editing && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={startEditor}>
              <Edit3 className="h-4 w-4" />
              Edit post
            </Button>
          )}
        </div>

        <div className="mt-5">
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={5000}
                className="min-h-28 resize-none rounded-xl"
                placeholder="Add a caption for this shared trip..."
              />
              <VisibilityEditor value={draftVisibility} onChange={setDraftVisibility} />
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={resetEditor}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" className="rounded-full" disabled={saving} onClick={savePostSettings}>
                  <Check className="h-4 w-4" />
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
              {post.content || (isOwner ? "No caption yet. Add one to give this trip more context." : "No caption was added.")}
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="relative min-h-[22rem] overflow-hidden bg-muted">
          {trip.coverImageUrl ? (
            <Image src={trip.coverImageUrl} alt={trip.name} fill sizes="(max-width: 768px) 100vw, 1100px" className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground">No cover image</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/25 to-transparent" />
          <div className="absolute left-6 top-6 flex flex-wrap gap-2">
            <Badge className="rounded-full bg-background text-foreground hover:bg-background">Read-only Snapshot</Badge>
            <Badge className="rounded-full bg-background text-foreground hover:bg-background"><Eye className="mr-1 h-3.5 w-3.5" /> API data</Badge>
          </div>
          <div className="absolute bottom-8 left-6 max-w-[calc(100%-3rem)] text-primary-foreground">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal">
              <MapPin className="h-4 w-4" />
              {titleCase(trip.destinationName)}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">{trip.name}</h1>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-4">
          <StatBlock icon={CalendarDays} label="Dates" value={`${formatDateRange(trip.startDate, trip.endDate)} (${trip.dayCount ?? 0} days)`} />
          <StatBlock icon={MapPin} label="Destination" value={titleCase(trip.destinationName)} />
          <StatBlock icon={Route} label="Stops" value={`${snapshotItemCount} places`} />
          <StatBlock icon={Users} label="Travelers" value={`${trip.travelerCount ?? 1} travelers`} />
        </div>
      </section>

      <section className="border-t border-border p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-foreground">Detailed Itinerary</h3>
                <p className="text-sm text-muted-foreground">{snapshotItemCount} saved stops from this shared snapshot.</p>
              </div>
              {isOwner && (
                <Button asChild className="rounded-full">
                  <Link href={`/trips/${trip.tripId}`}>Open source trip</Link>
                </Button>
              )}
            </div>

            <div className="mt-4 space-y-6">
              {itineraryDays.length > 0 ? (
                itineraryDays.map((day) => (
                  <section key={day.id} className="relative pl-8">
                    <div className="absolute bottom-0 left-3 top-2 w-px bg-border" />
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">D{day.dayNumber}</span>
                        <div>
                          <h4 className="font-black text-foreground">Day {day.dayNumber}</h4>
                          <p className="text-xs text-muted-foreground">{day.date || "Date not set"}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">{day.items.length} stops</Badge>
                    </div>

                    <div className="space-y-3">
                      {day.items.map((item) => (
                        <article key={item.id} className="relative rounded-xl border border-border bg-background p-4 shadow-2xs">
                          <span className="absolute -left-[1.45rem] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary ring-4 ring-card" />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="secondary" className="rounded-md">
                              <Clock className="mr-1 h-3.5 w-3.5" />
                              {formatTimeRange(item.startTime, item.endTime)}
                            </Badge>
                            <span className="text-xs font-black uppercase text-muted-foreground">{item.status || "Planned"}</span>
                          </div>
                          <h5 className="mt-3 text-base font-black text-foreground">{item.title}</h5>
                          <p className="mt-1 text-sm text-muted-foreground">{item.notes || item.placeName || item.placeAddress || "No notes added."}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                            <span>{item.type}</span>
                            {item.durationMinutes ? <span>{item.durationMinutes} min</span> : null}
                            {item.placeAddress ? <span>{item.placeAddress}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">
                  This older shared post only has summary highlights. Share the trip again to publish the full itinerary snapshot.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-black text-foreground">
                  <Route className="h-4 w-4 text-primary" />
                  Route Map
                </h4>
                <Badge variant="secondary" className="rounded-full">Places API</Badge>
              </div>
              {mapPlaces.length > 0 && center ? (
                <MapVinaContainer places={mapPlaces} selectedPlaceId={selectedPlaceId} onSelectPlace={setSelectedPlaceId} center={center} zoom={12} className="h-80 w-full rounded-xl" />
              ) : (
                <div className="flex h-80 flex-col items-center justify-center rounded-xl bg-muted p-5 text-center">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-bold text-foreground">No mapped stops yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">No coordinates were saved and Places API could not resolve these stops.</p>
                </div>
              )}
            </section>

            {itineraryDays.length === 0 && highlights.length > 0 ? (
              <section className="rounded-2xl border border-border bg-background p-4">
                <h4 className="font-black text-foreground">Trip Highlights</h4>
                <div className="mt-3 space-y-2">
                  {highlights.map((item, index) => (
                    <div key={`${item.dayNumber}-${item.title}-${index}`} className="rounded-xl bg-muted p-3 text-sm">
                      <p className="font-black text-foreground">{item.placeName || item.title}</p>
                      <p className="text-muted-foreground">Day {item.dayNumber}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </article>
  );
}
