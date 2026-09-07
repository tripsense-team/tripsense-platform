"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Compass,
  Eye,
  Globe2,
  Info,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  Route,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { socialPostRepository } from "@/features/social-post/services";
import { getItinerary, getTrip, listTrips } from "@/features/trip-management/services/trip-management-api";
import type { ItineraryItemResponse, ItineraryResponse, TripResponse } from "@/features/trip-management/types";
import { countTripDays, displayTripTitle, formatShortRange, titleCaseDestination } from "@/features/trip-management/utils/format";
import { searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import { cn } from "@/lib/utils";

const MapVinaContainer = dynamic(
  () => import("@/features/map/components/mapvina-container").then((mod) => mod.MapVinaContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-border bg-muted text-sm font-semibold text-muted-foreground">
        Loading map...
      </div>
    ),
  }
);

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

const visibilityOptions: Array<{
  value: Visibility;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: "PUBLIC",
    title: "Public",
    icon: Globe2,
    description: "Anyone on TripSense can discover this shared post in Community.",
  },
  {
    value: "UNLISTED",
    title: "Unlisted",
    icon: Users,
    description: "Visible to signed-in TripSense community members.",
  },
  {
    value: "PRIVATE",
    title: "Private",
    icon: Lock,
    description: "Only visible to you in Community and owner contexts.",
  },
];

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function itineraryItemCount(itinerary: ItineraryResponse | null) {
  return itinerary?.days.reduce((total, day) => total + day.items.length, 0) ?? 0;
}

function tripPlaces(itinerary: ItineraryResponse | null): Place[] {
  if (!itinerary) return [];

  return itinerary.days.flatMap((day) =>
    day.items
      .filter((item) => item.latSnapshot != null && item.lngSnapshot != null)
      .map((item) => ({
        id: item.id,
        providerPlaceId: item.placeId || undefined,
        name: item.placeNameSnapshot || item.title,
        location: {
          lat: item.latSnapshot as number,
          lng: item.lngSnapshot as number,
        },
        address: item.placeAddressSnapshot || undefined,
        categories: [item.type.toLowerCase()],
        photos: [],
      }))
  );
}

function firstMapCenter(places: Place[]): [number, number] | undefined {
  const firstPlace = places.find((place) => place.location);
  return firstPlace?.location ? [firstPlace.location.lng, firstPlace.location.lat] : undefined;
}

function itineraryItems(itinerary: ItineraryResponse | null) {
  return itinerary?.days.flatMap((day) => day.items) ?? [];
}

function useResolvedTripPlaces(trip: TripResponse | null, itinerary: ItineraryResponse | null) {
  const [places, setPlaces] = React.useState<Place[]>([]);

  React.useEffect(() => {
    if (!trip || !itinerary) {
      return;
    }

    const currentTrip = trip;
    const controller = new AbortController();
    const items = itineraryItems(itinerary);
    const snapshotPlaces = tripPlaces(itinerary);
    const missingCoordinates = items.filter((item) => item.latSnapshot == null || item.lngSnapshot == null);

    async function resolvePlaces() {
      const resolved = await Promise.all(
        missingCoordinates.slice(0, 8).map(async (item) => {
          const query = [item.placeNameSnapshot || item.title, currentTrip.destinationName].filter(Boolean).join(", ");
          try {
            const response = await searchPlaces({ q: query, limit: 1, signal: controller.signal });
            return response.data[0] ?? null;
          } catch {
            return null;
          }
        })
      );

      if (!controller.signal.aborted) {
        setPlaces([...snapshotPlaces, ...resolved.filter((place): place is Place => Boolean(place?.location))]);
      }
    }

    void resolvePlaces();
    return () => controller.abort();
  }, [trip, itinerary]);

  return places;
}

export function TripSharingWorkspace() {
  const user = useAuthStore((state) => state.user);
  const [trips, setTrips] = React.useState<TripResponse[]>([]);
  const [trip, setTrip] = React.useState<TripResponse | null>(null);
  const [itinerary, setItinerary] = React.useState<ItineraryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [switchingTripId, setSwitchingTripId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [visibilityOpen, setVisibilityOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState<Visibility>("PUBLIC");
  const [caption, setCaption] = React.useState("");
  const [publishedPostId, setPublishedPostId] = React.useState<string | null>(null);
  const [submittingShare, setSubmittingShare] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);

  const places = useResolvedTripPlaces(trip, itinerary);
  const visibilityLabel = visibilityOptions.find((option) => option.value === visibility)?.title ?? "Public";

  const loadTripDetails = React.useCallback(async (tripId: string) => {
    const [freshTrip, freshItinerary] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);
    return { trip: freshTrip, itinerary: freshItinerary };
  }, []);

  const applyWorkspaceData = React.useCallback(async () => {
    const page = await listTrips({ size: 20 });
    const availableTrips = page.content;
    const firstTrip = availableTrips[0] ?? null;

    if (!firstTrip) {
      return { trips: availableTrips, trip: null, itinerary: null };
    }

    const details = await loadTripDetails(firstTrip.id);
    return { trips: availableTrips, ...details };
  }, [loadTripDetails]);

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applyWorkspaceData();
      setTrips(data.trips);
      setTrip(data.trip);
      setItinerary(data.itinerary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trip data");
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaceData]);

  React.useEffect(() => {
    let ignore = false;

    async function loadInitialWorkspace() {
      try {
        const data = await applyWorkspaceData();
        if (!ignore) {
          setTrips(data.trips);
          setTrip(data.trip);
          setItinerary(data.itinerary);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Could not load trip data");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialWorkspace();

    return () => {
      ignore = true;
    };
  }, [applyWorkspaceData]);

  async function selectTrip(tripId: string) {
    if (tripId === trip?.id || switchingTripId) return;

    setSwitchingTripId(tripId);
    setError(null);
    setShareError(null);
    setPublishedPostId(null);
    try {
      const data = await loadTripDetails(tripId);
      setTrip(data.trip);
      setItinerary(data.itinerary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load selected trip");
    } finally {
      setSwitchingTripId(null);
    }
  }

  async function publishTripShare() {
    if (!trip) return;

    setSubmittingShare(true);
    setShareError(null);
    try {
      const created = await socialPostRepository.createTripShare(
        {
          tripId: trip.id,
          caption,
          visibility,
        },
        crypto.randomUUID()
      );
      setPublishedPostId(created.id);
      setShareOpen(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not share this trip");
    } finally {
      setSubmittingShare(false);
    }
  }

  if (loading) return <LoadingState className="min-h-screen" text="Loading your trip workspace..." />;
  if (error) return <ErrorState className="min-h-screen" message={error} onRetry={loadWorkspace} />;

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <EmptyState
          icon={Compass}
          title="No trips found"
          description="Create a trip in My Trips first, then come back to share it."
          action={
            <Button asChild className="rounded-full">
              <Link href="/trips/new">Create a Trip</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 pb-12">
      <TripHero trip={trip} itinerary={itinerary} userName={user?.name} visibilityLabel={visibilityLabel} onShare={() => setShareOpen(true)} />

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <TripSwitcher trips={trips} activeTripId={trip.id} switchingTripId={switchingTripId} onSelectTrip={selectTrip} />
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-xs">
            {["Itinerary List", "Expenses & Splits", "Notes & Bookings"].map((tab, index) => (
              <Button key={tab} size="sm" variant={index === 0 ? "default" : "ghost"} className="rounded-full text-xs font-semibold">
                {tab}
              </Button>
            ))}
            <Badge variant="secondary" className="ml-auto rounded-full">{itineraryItemCount(itinerary)} selected</Badge>
          </div>
          <ItineraryList itinerary={itinerary} />
        </div>

        <aside className="space-y-5">
          <RouteMapCard places={places} budget={trip.budgetAmount} currency={trip.budgetCurrency} />
          <CommunityPreviewCard
            trip={trip}
            itinerary={itinerary}
            caption={caption}
            publishedPostId={publishedPostId}
            onPublish={() => setShareOpen(true)}
            onOpenVisibility={() => setVisibilityOpen(true)}
            onRemove={() => setRemoveOpen(true)}
          />
        </aside>
      </section>

      <ShareTripDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        trip={trip}
        itinerary={itinerary}
        caption={caption}
        onCaptionChange={setCaption}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        userName={user?.name}
        userEmail={user?.email}
        submitting={submittingShare}
        error={shareError}
        onPublish={publishTripShare}
      />

      <VisibilityDialog open={visibilityOpen} onOpenChange={setVisibilityOpen} visibility={visibility} onVisibilityChange={setVisibility} />
      <RemoveShareDialog open={removeOpen} onOpenChange={setRemoveOpen} tripTitle={displayTripTitle(trip)} />
    </main>
  );
}

function TripCover({ trip, className, priority = false }: { trip: TripResponse; className?: string; priority?: boolean }) {
  if (!trip.coverImageUrl) {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-muted text-sm font-bold text-muted-foreground", className)}>
        No cover image
      </div>
    );
  }

  return <Image src={trip.coverImageUrl} alt={displayTripTitle(trip)} fill priority={priority} sizes="(max-width: 1024px) 100vw, 900px" className={cn("object-cover", className)} />;
}

function TripHero({
  trip,
  itinerary,
  userName,
  visibilityLabel,
  onShare,
}: {
  trip: TripResponse;
  itinerary: ItineraryResponse | null;
  userName?: string | null;
  visibilityLabel: string;
  onShare: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0">
        <TripCover trip={trip} priority />
        <div className="absolute inset-0 bg-primary/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
      </div>
      <div className="relative mx-auto flex min-h-[22rem] max-w-7xl flex-col justify-end px-4 py-8 text-primary-foreground">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-background text-foreground hover:bg-background">TF-56: Share a trip as a social post</Badge>
          <Badge className="rounded-full bg-background/90 text-foreground hover:bg-background">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Owner view
          </Badge>
          <Badge className="rounded-full bg-primary text-primary-foreground">
            <Globe2 className="mr-1 h-3 w-3" />
            {visibilityLabel}
          </Badge>
        </div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal">
          <MapPin className="h-3.5 w-3.5" />
          {titleCaseDestination(trip.destinationName)}
        </p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-normal sm:text-5xl">{displayTripTitle(trip)}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatShortRange(trip.startDate, trip.endDate)}</span>
              <span>{countTripDays(trip)} days</span>
              <span>{itineraryItemCount(itinerary)} curated stops</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {trip.travelerCount || 1} travelers</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-primary-foreground/20 bg-background/20 p-3 shadow-md backdrop-blur-md">
            <Button onClick={onShare} className="rounded-full font-bold">
              <Share2 className="h-4 w-4" />
              Share Trip
            </Button>
            <Button asChild variant="secondary" className="rounded-full font-bold">
              <Link href={`/trips/${trip.id}`}>
                <Plus className="h-4 w-4" />
                Add Place
              </Link>
            </Button>
            <Button variant="secondary" className="rounded-full font-bold">
              <Users className="h-4 w-4" />
              Invite
            </Button>
            <Button variant="secondary" size="icon" className="rounded-full" aria-label="Copy trip link">
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-5 flex -space-x-2">
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback>{initials(userName)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </section>
  );
}

function TripSwitcher({
  trips,
  activeTripId,
  switchingTripId,
  onSelectTrip,
}: {
  trips: TripResponse[];
  activeTripId: string;
  switchingTripId: string | null;
  onSelectTrip: (tripId: string) => void;
}) {
  if (trips.length <= 1) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black uppercase tracking-normal text-muted-foreground">Choose trip to share</h2>
          <p className="text-sm text-muted-foreground">Loaded from My Trips API</p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {trips.length} trips
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {trips.map((item) => {
          const selected = item.id === activeTripId;
          const switching = item.id === switchingTripId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTrip(item.id)}
              disabled={Boolean(switchingTripId)}
              className={cn(
                "group grid min-h-28 grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-background text-left shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-sm disabled:cursor-wait disabled:opacity-70",
                selected && "border-primary ring-2 ring-primary/15"
              )}
            >
              <div className="relative h-full min-h-28 bg-muted">
                <TripCover trip={item} />
              </div>
              <div className="min-w-0 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={selected ? "default" : "secondary"} className="rounded-full text-[10px]">
                    {selected ? "Selected" : "My Trip"}
                  </Badge>
                  {switching && <span className="text-xs font-semibold text-muted-foreground">Loading...</span>}
                </div>
                <p className="truncate text-sm font-black text-foreground">{displayTripTitle(item)}</p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                  {titleCaseDestination(item.destinationName)} · {formatShortRange(item.startDate, item.endDate)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ItineraryList({ itinerary }: { itinerary: ItineraryResponse | null }) {
  if (!itinerary || itinerary.days.length === 0) {
    return <EmptyState icon={Route} title="No itinerary yet" description="Add places in My Trips to build a shareable itinerary." />;
  }

  return (
    <div className="space-y-8">
      {itinerary.days.map((day) => (
        <section key={day.id} className="relative pl-8">
          <div className="absolute bottom-0 left-3 top-2 w-px bg-border" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
                D{day.dayNumber}
              </span>
              <div>
                <h2 className="text-xl font-black tracking-normal text-foreground">Day {day.dayNumber}</h2>
                <p className="text-sm text-muted-foreground">{day.date}</p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full text-primary">{day.items.length} stops</Badge>
          </div>
          <div className="space-y-4">
            {day.items.map((item) => <ItineraryCard key={item.id} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItineraryCard({ item }: { item: ItineraryItemResponse }) {
  return (
    <article className="relative rounded-2xl border border-border bg-card p-3 shadow-xs">
      <span className="absolute -left-[1.45rem] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <MapPin className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="rounded-md text-primary">
              {[item.startTime, item.endTime].filter(Boolean).join(" - ") || item.type}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">{item.status}</span>
          </div>
          <h3 className="mt-2 text-lg font-black tracking-normal text-foreground">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {item.placeNameSnapshot || item.placeAddressSnapshot || item.notes || "No additional notes."}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold">
            <span className="text-muted-foreground">{item.type}</span>
            <span>{item.durationMinutes ? `${item.durationMinutes} min` : "No duration"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function RouteMapCard({ places, budget, currency }: { places: Place[]; budget: number | null; currency: string | null }) {
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const center = firstMapCenter(places);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-normal">
          <Compass className="h-5 w-5 text-primary" />
          Interactive Route Map
        </h2>
        <Badge variant="secondary" className="rounded-full">From API</Badge>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl">
        {places.length > 0 && center ? (
          <MapVinaContainer places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={setSelectedPlaceId} center={center} zoom={12} className="h-80 w-full" />
        ) : (
          <div className="flex h-80 flex-col items-center justify-center rounded-2xl bg-muted p-6 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">No mapped itinerary stops</p>
            <p className="mt-1 text-sm text-muted-foreground">Add itinerary items with saved coordinates to show them on MapVina.</p>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Budget" value={budget ? `${budget.toLocaleString()} ${currency || ""}` : "Not set"} />
        <Metric label="Mapped Stops" value={String(places.length)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  );
}

function CommunityPreviewCard({
  trip,
  itinerary,
  caption,
  publishedPostId,
  onPublish,
  onOpenVisibility,
  onRemove,
}: {
  trip: TripResponse;
  itinerary: ItineraryResponse | null;
  caption: string;
  publishedPostId: string | null;
  onPublish: () => void;
  onOpenVisibility: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-normal">
          <MessageSquare className="h-5 w-5 text-primary" />
          Community Share Preview
        </h2>
        <Badge className="rounded-full">{publishedPostId ? "Published" : "Ready"}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">This preview uses your selected trip and itinerary from My Trips.</p>
      <div className="mt-4 rounded-2xl bg-muted p-3">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-card">
            <TripCover trip={trip} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-black">{displayTripTitle(trip)}</h3>
            <p className="line-clamp-2 text-xs text-muted-foreground">{caption || `${itineraryItemCount(itinerary)} stops in ${titleCaseDestination(trip.destinationName)}`}</p>
          </div>
          <Button onClick={onPublish} size="sm" className="rounded-full">{publishedPostId ? "Manage" : "Publish"}</Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={onOpenVisibility}>
          <Eye className="h-4 w-4" />
          Visibility
        </Button>
        <Button variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Remove
        </Button>
      </div>
    </section>
  );
}

function ShareTripDialog({
  open,
  onOpenChange,
  trip,
  itinerary,
  caption,
  onCaptionChange,
  visibility,
  onVisibilityChange,
  userName,
  userEmail,
  submitting,
  error,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripResponse;
  itinerary: ItineraryResponse | null;
  caption: string;
  onCaptionChange: (value: string) => void;
  visibility: Visibility;
  onVisibilityChange: (visibility: Visibility) => void;
  userName?: string | null;
  userEmail?: string | null;
  submitting: boolean;
  error: string | null;
  onPublish: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-normal">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Share2 className="h-5 w-5" />
            </span>
            Share Trip to Community Feed
          </DialogTitle>
          <DialogDescription className="sr-only">Create a shared trip post with caption and visibility.</DialogDescription>
        </DialogHeader>

        <div className="space-y-7 px-7 py-6">
          {error && <ErrorState message={error} />}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14"><AvatarFallback className="bg-primary text-primary-foreground">{initials(userName)}</AvatarFallback></Avatar>
              <div>
                <h3 className="font-black">{userName || "Current user"} <span className="font-medium text-muted-foreground">{userEmail || ""}</span></h3>
                <p className="text-sm font-semibold text-muted-foreground">Posting as author</p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              <ShieldCheck className="mr-1 h-4 w-4 text-primary" />
              Trip Owner
            </Badge>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between text-sm font-black uppercase tracking-normal">
              <span>Caption & insights <span className="font-medium text-muted-foreground">(optional)</span></span>
              <span className={cn(caption.length > 300 ? "text-destructive" : "text-primary")}>{caption.length} / 300</span>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <Textarea
                value={caption}
                maxLength={300}
                onChange={(event) => onCaptionChange(event.target.value)}
                className="min-h-28 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                placeholder="Write a short caption for your shared trip..."
              />
            </div>
          </section>

          <TripArtifact trip={trip} itinerary={itinerary} />
          <VisibilityPicker visibility={visibility} onVisibilityChange={onVisibilityChange} />

          <section className="rounded-2xl bg-primary/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-normal text-primary">
              <Info className="h-5 w-5" />
              Data source
            </h3>
            <p className="mt-2 text-sm text-foreground">Trip title, dates, budget, stops, and map markers come from your TripSense APIs.</p>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-border bg-muted/60 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-bold text-muted-foreground">Draft saved locally until you publish</span>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onPublish} disabled={submitting} className="rounded-xl px-6 font-bold">
              {submitting ? "Sharing..." : "Share Post"}
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function TripArtifact({ trip, itinerary }: { trip: TripResponse; itinerary: ItineraryResponse | null }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-normal">Attached Trip Artifact</h3>
        <Badge variant="secondary" className="rounded-full">
          <Lock className="mr-1 h-3.5 w-3.5" />
          Read-only snapshot
        </Badge>
      </div>
      <div className="grid gap-4 rounded-2xl bg-muted p-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-card">
          <TripCover trip={trip} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge>Itinerary Snapshot</Badge>
            <Badge variant="secondary"><Eye className="mr-1 h-3.5 w-3.5" /> API data</Badge>
          </div>
          <h3 className="mt-3 text-3xl font-black tracking-normal">{displayTripTitle(trip)}</h3>
          <p className="mt-2 flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-primary" /> {titleCaseDestination(trip.destinationName)}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
            <span>{formatShortRange(trip.startDate, trip.endDate)}</span>
            <span className="text-primary">{countTripDays(trip)} days</span>
            <span>{itineraryItemCount(itinerary)} places</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function VisibilityPicker({ visibility, onVisibilityChange }: { visibility: Visibility; onVisibilityChange: (visibility: Visibility) => void }) {
  return (
    <section>
      <h3 className="text-sm font-black uppercase tracking-normal">Who can see this post?</h3>
      <p className="text-sm text-muted-foreground">Control who can discover this shared copy in the community feed.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {visibilityOptions.map((option) => {
          const Icon = option.icon;
          const selected = visibility === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onVisibilityChange(option.value)}
              className={cn("min-h-40 rounded-2xl border border-border bg-muted p-4 text-left transition-all duration-200", selected && "border-primary bg-primary/10 shadow-sm")}
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground", selected && "bg-primary text-primary-foreground")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-background", selected && "bg-primary text-primary-foreground")}>
                  {selected && <Check className="h-4 w-4" />}
                </span>
              </div>
              <h4 className="mt-5 text-lg font-black">{option.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function VisibilityDialog({ open, onOpenChange, visibility, onVisibilityChange }: { open: boolean; onOpenChange: (open: boolean) => void; visibility: Visibility; onVisibilityChange: (visibility: Visibility) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle className="text-2xl font-black tracking-normal">Manage Post Visibility</DialogTitle>
          <DialogDescription>Choose who can see this shared trip in their feed and search results.</DialogDescription>
        </DialogHeader>
        <div className="px-7 py-6">
          <VisibilityPicker visibility={visibility} onVisibilityChange={onVisibilityChange} />
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm">
            <p className="font-black text-primary">Data integrity guarantee</p>
            <p className="mt-1 text-muted-foreground">Changing post visibility only affects the social feed post, not your private trip data.</p>
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t border-border px-7 py-5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl">Save Changes</Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function RemoveShareDialog({ open, onOpenChange, tripTitle }: { open: boolean; onOpenChange: (open: boolean) => void; tripTitle: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader className="items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Trash2 className="h-7 w-7" />
          </span>
          <Badge variant="destructive" className="mt-2">TF-61 Unpublish feed post</Badge>
          <DialogTitle className="text-2xl font-black tracking-normal">Remove this shared trip post?</DialogTitle>
          <DialogDescription>This removes the Community post for {tripTitle}. It does not delete the original trip.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-primary/10 p-4 text-sm">
          <p className="font-black text-primary">Your original itinerary is protected</p>
          <p className="mt-1 text-muted-foreground">Only the shared social post, comments, and reactions are removed.</p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> My Trips data remains unchanged.</p>
          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Private notes and bookings stay in your trip workspace.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => onOpenChange(false)} className="rounded-xl">Remove Post</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
