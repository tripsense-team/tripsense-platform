import * as React from "react";
import { AlertTriangle, CalendarDays, CloudSun, Heart, Info, MapPin, Route, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiArtifact, AiItineraryPreview, AiPlaceEvidence } from "./types";
import type { Place as CorePlace, PlacePhotoEvidence } from "@/features/places/types";
import { getPlaceDetails } from "@/features/places/services/places-api";
import { ApprovedPlaceImage } from "./approved-place-image";

type Place = { id?: string; name?: string; address?: string; city?: string; rating?: number; userRatingCount?: number; provider?: string; location?: { lat: number; lng: number }; categories?: string[]; freshness?: string; primaryPhoto?: PlacePhotoEvidence; recommendationEvidence?: { score?: number; uncertainty?: string; missingOptionalFeatures?: string[] } };

function Provenance({ artifact }: { artifact: AiArtifact }) {
  const source = artifact.provenance?.[0];
  if (!source) return null;
  const rawSource = String(source.source || "REAL");
  const displaySource = rawSource === "UNKNOWN" ? "REAL" : rawSource;
  const displayProvider = String(source.provider || "TripSense");
  return <p className="mt-1 text-micro uppercase tracking-wide text-muted-foreground">
    {displaySource} / {displayProvider}
  </p>;
}

function Places({ artifact, onFeedback, onSelectPlace, selectedPlaceId, onViewDetails }: {
  artifact: AiArtifact;
  onFeedback?: (artifactId: string, candidateId: string, action: "SAVE" | "REJECT" | "MORE_LIKE_THIS") => void;
  onSelectPlace?: (id: string) => void;
  selectedPlaceId?: string | null;
  onViewDetails?: (place: CorePlace) => void;
}) {
  const places = (artifact.data.places as Place[] | undefined) || [];
  const [enrichedPhotos, setEnrichedPhotos] = React.useState<Record<string, PlacePhotoEvidence>>({});
  const inFlightRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    places.forEach((place) => {
      const id = place.id;
      if (!id || place.primaryPhoto?.url || enrichedPhotos[id] || inFlightRef.current.has(id)) return;
      inFlightRef.current.add(id);
      getPlaceDetails(id, place.name, undefined, undefined, undefined, true)
        .then((res) => {
          if (res.data?.primaryPhoto) {
            setEnrichedPhotos((prev) => ({
              ...prev,
              [id]: res.data!.primaryPhoto!,
            }));
          }
        })
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(id);
        });
    });
  }, [places, enrichedPhotos]);

  if (!places.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Địa điểm gợi ý ({places.length})
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {places.map((place, index) => {
          const isSelected = selectedPlaceId === place.id;
          const activePhoto = (place.id ? enrichedPhotos[place.id] : undefined) || place.primaryPhoto;
          return (
            <div
              key={place.id || index}
              onClick={() => place.id && onSelectPlace?.(place.id)}
              className={`group relative flex w-52 shrink-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md cursor-pointer ${
                isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <div className="relative h-28 w-full overflow-hidden bg-muted">
                <ApprovedPlaceImage
                  photo={activePhoto}
                  name={place.name || "địa điểm"}
                  category={place.categories?.[0]}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (place.id) {
                      onViewDetails?.({
                        id: place.id,
                        name: place.name || "Địa điểm",
                        address: place.address,
                        city: place.city,
                        rating: place.rating,
                        userRatingCount: place.userRatingCount,
                        location: place.location,
                        categories: place.categories || [],
                        photos: [],
                        primaryPhoto: place.primaryPhoto,
                      });
                    }
                  }}
                  className="absolute top-2 right-11 w-8 rounded-full bg-black/40 px-0 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-primary shadow-xs [&_svg]:size-4"
                  aria-label="Xem chi tiết địa điểm (ⓘ)"
                  title="Xem thông tin chi tiết (ⓘ)"
                >
                  <Info />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (place.id && onFeedback) onFeedback(artifact.artifactId, place.id, "SAVE");
                  }}
                  className="absolute top-2 right-2 w-8 rounded-full bg-black/40 px-0 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-rose-500 shadow-xs [&_svg]:size-4"
                  aria-label="Lưu địa điểm"
                >
                  <Heart />
                </Button>
                {place.rating != null && (
                  <span className="absolute bottom-1.5 left-2 flex items-center gap-0.5 text-micro font-bold text-amber-300 drop-shadow-xs">
                    <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                    {place.rating.toFixed(1)}
                    {place.userRatingCount != null && <span className="text-micro font-normal text-white/80">({place.userRatingCount})</span>}
                  </span>
                )}
              </div>
              <div className="p-2.5 flex flex-col flex-1 justify-between gap-1">
                <p className="font-semibold text-xs leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                  {place.name || "Địa điểm"}
                </p>
                {(place.address || place.city) && (
                  <p className="text-micro text-muted-foreground truncate flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    {place.address || place.city}
                  </p>
                )}
                <div className="flex items-center justify-between pt-0.5 text-micro">
                  <span className="text-primary font-medium group-hover:underline inline-flex items-center gap-0.5">
                    Xem trên map →
                  </span>
                  {place.categories?.[0] && <span className="text-micro text-muted-foreground truncate max-w-[80px]">{place.categories[0]}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Provenance artifact={artifact} />
    </div>
  );
}

function Confirmation({ artifact, onConfirm, onReject }: { artifact: AiArtifact; onConfirm?: (id: string) => void; onReject?: (id: string) => void }) {
  const data = artifact.data as { id?: string; businessState?: string; expiresAt?: string; validation?: { issues?: Array<{ message?: string }> } };
  return <article className="rounded-xl border border-primary/30 bg-card p-4 shadow-sm">
    <h4 className="font-semibold">Trip change proposal</h4>
    <p className="mt-1 text-xs text-muted-foreground">State: {data.businessState || "UNKNOWN"}{data.expiresAt ? ` · expires ${data.expiresAt}` : ""}</p>
    {data.validation?.issues?.map((issue, index) => <p key={`val-issue-${index}`} className="mt-1 text-xs text-amber-700">{issue.message}</p>)}
    {data.id && data.businessState === "READY" && <div className="mt-3 flex gap-2">
      <Button size="sm" onClick={() => onConfirm?.(data.id!)}>Thêm vào lịch trình</Button>
      <Button size="sm" variant="outline" onClick={() => onReject?.(data.id!)}>Reject</Button>
    </div>}
  </article>;
}

function TripContext({ artifact }: { artifact: AiArtifact }) {
  const data = artifact.data as { name?: string; destinationName?: string; startDate?: string; endDate?: string; status?: string; days?: unknown[] };
  return <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <h4 className="font-semibold">{data.name || (artifact.type === "ITINERARY_CONTEXT" ? "Trip itinerary" : "Trip")}</h4>
    {data.destinationName && <p className="mt-1 flex gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{data.destinationName}</p>}
    {(data.startDate || data.endDate) && <p className="mt-1 flex gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{data.startDate} - {data.endDate}</p>}
    {data.days && <p className="mt-1 text-xs text-muted-foreground">{data.days.length} itinerary days</p>}
    {data.status && <p className="mt-2 text-micro font-medium uppercase text-primary">{data.status}</p>}
    <Provenance artifact={artifact} />
  </article>;
}

type PreviewItem = AiPlaceEvidence;
type PreviewDay = { dayNumber?: number; date?: string; weather?: { condition?: string; temperatureC?: number; isIllustrative?: boolean }; items?: PreviewItem[]; routes?: unknown[] };
type PreviewIssue = { code?: string; severity?: string; message?: string; dayNumber?: number };

function ItineraryPreview({ artifact, onSelectPlace, selectedPlaceId, onViewDetails, onCreateTripFromPlan }: {
  artifact: AiArtifact;
  onSelectPlace?: (id: string) => void;
  selectedPlaceId?: string | null;
  onViewDetails?: (place: CorePlace) => void;
  onCreateTripFromPlan?: () => void;
}) {
  const data = artifact.data as AiItineraryPreview & { scope?: string; days?: PreviewDay[]; preservedDayNumbers?: number[]; issues?: PreviewIssue[]; explanation?: string };
  const [enrichedPlaces, setEnrichedPlaces] = React.useState<Record<string, Partial<Place>>>({});
  const inFlightRef = React.useRef<Set<string>>(new Set());

  const items = React.useMemo(() => (data.days || []).flatMap((day) => day.items || []), [data.days]);

  React.useEffect(() => {
    items.forEach((item) => {
      const id = item.canonicalPlaceId;
      if (!id || (item.location && item.primaryPhoto)) return;
      if (enrichedPlaces[id] || inFlightRef.current.has(id)) return;

      inFlightRef.current.add(id);
      getPlaceDetails(id, item.title, undefined, undefined, undefined, true)
        .then((res) => {
          if (res.data) {
            setEnrichedPlaces((prev) => ({
              ...prev,
              [id]: res.data as Partial<Place>,
            }));
          }
        })
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(id);
        });
    });
  }, [items, enrichedPlaces]);

  return <article className="space-y-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div>
        <h4 className="font-semibold text-xs">Lịch trình đề xuất</h4>
        <p className="text-micro text-muted-foreground">Bản xem trước · bấm vào thẻ để định vị trên bản đồ</p>
      </div>
      <div className="flex items-center gap-2">
        {(() => {
          const vState = data.validityState || (data.validForPreview ? "VALID" : "BLOCKED");
          if (vState === "VALID") {
            return (
              <span className="rounded-full px-2 py-0.5 text-micro font-semibold bg-emerald-500/10 text-emerald-700">
                ✓ GỢI Ý HỢP LỆ
              </span>
            );
          }
          if (vState === "PARTIAL") {
            return (
              <span className="rounded-full px-2 py-0.5 text-micro font-semibold bg-amber-500/10 text-amber-700">
                ⚠ GỢI Ý CHƯA HOÀN CHỈNH
              </span>
            );
          }
          if (vState === "INVALID") {
            return (
              <span className="rounded-full px-2 py-0.5 text-micro font-semibold bg-destructive/10 text-destructive">
                ✕ KHÔNG THỂ TẠO LỊCH
              </span>
            );
          }
          return (
            <span className="rounded-full px-2 py-0.5 text-micro font-semibold bg-amber-500/10 text-amber-700">
              ⚠ CẦN THÊM THÔNG TIN
            </span>
          );
        })()}
        {onCreateTripFromPlan && (
          <Button
            size="sm"
            onClick={onCreateTripFromPlan}
            disabled={data.canCommit === false || (data.validityState ? data.validityState !== "VALID" : !data.validForPreview)}
            className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tạo chuyến đi
          </Button>
        )}
      </div>
    </div>
    {data.preservedDayNumbers?.length ? <p className="flex items-center gap-1 text-xs text-muted-foreground px-1"><ShieldCheck className="h-3.5 w-3.5" />Giữ nguyên các ngày: {data.preservedDayNumbers.join(", ")}</p> : null}
    {data.days?.map((day, dayIndex) => <section key={`preview-day-${day.dayNumber ?? dayIndex}`} className="rounded-xl border border-border/70 bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h5 className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          Ngày {day.dayNumber}{day.date ? ` · ${day.date}` : ""}
        </h5>
        {day.weather && <span className="flex items-center gap-1 text-micro text-muted-foreground"><CloudSun className="h-3 w-3 text-amber-500" />{day.weather.temperatureC}°C</span>}
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {day.items?.map((rawItem, index) => {
          const enriched = enrichedPlaces[rawItem.canonicalPlaceId];
          const item = {
            ...rawItem,
            address: rawItem.address || enriched?.address,
            location: rawItem.location || enriched?.location,
            primaryPhoto: rawItem.primaryPhoto || enriched?.primaryPhoto,
            ratingSummary: rawItem.ratingSummary || (enriched?.rating != null ? {
              value: enriched.rating,
              count: enriched.userRatingCount,
              source: enriched.provider || "place-service",
            } : undefined),
          };
          const isSelected = selectedPlaceId === item.canonicalPlaceId;
          return <div
            key={`preview-item-${rawItem.canonicalPlaceId}-${index}`}
            onClick={() => onSelectPlace?.(item.canonicalPlaceId)}
            className={`group relative flex w-52 shrink-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md cursor-pointer ${
              isSelected ? "border-primary ring-2 ring-primary/30 shadow-sm" : "border-border"
            }`}
          >
            <div className="relative h-28 w-full overflow-hidden bg-muted">
              <ApprovedPlaceImage photo={item.primaryPhoto} name={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
              {item.startTime && (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-micro font-medium text-white shadow-xs">
                  {item.startTime}{item.endTime ? `–${item.endTime}` : ""}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails?.({
                    id: item.canonicalPlaceId,
                    name: item.title,
                    address: item.address,
                    location: item.location,
                    categories: [],
                    photos: [],
                    primaryPhoto: item.primaryPhoto,
                    rating: item.ratingSummary?.value,
                  });
                }}
                className="absolute top-2 right-11 w-8 rounded-full bg-black/40 px-0 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-primary shadow-xs [&_svg]:size-4"
                aria-label="Xem chi tiết địa điểm (ⓘ)"
                title="Xem thông tin chi tiết (ⓘ)"
              >
                <Info />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="absolute top-2 right-2 w-8 rounded-full bg-black/40 px-0 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-rose-500 shadow-xs [&_svg]:size-4"
                aria-label="Lưu địa điểm"
              >
                <Heart />
              </Button>
              {item.ratingSummary && (
                <span className="absolute bottom-1.5 left-2 flex items-center gap-0.5 text-micro font-bold text-amber-300 drop-shadow-xs">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  {item.ratingSummary.value.toFixed(1)}
                  {item.ratingSummary.count != null && <span className="text-micro font-normal text-white/80">({item.ratingSummary.count})</span>}
                </span>
              )}
            </div>
            <div className="p-2.5 flex flex-col flex-1 justify-between gap-1">
              <p className="font-semibold text-xs leading-snug line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </p>
              {item.address && (
                <p className="text-micro text-muted-foreground truncate flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  {item.address}
                </p>
              )}
              <div className="flex items-center justify-between pt-0.5 text-micro">
                <span className="text-primary font-medium group-hover:underline inline-flex items-center gap-0.5">
                  Xem trên map →
                </span>
                {item.cost?.kind === "VERIFIED" && <span className="text-micro text-muted-foreground">Giá xác minh</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
      {day.routes?.length ? <p className="mt-1 flex items-center gap-1 text-micro uppercase text-muted-foreground px-1"><Route className="h-3 w-3" />Ước tính lộ trình di chuyển</p> : null}
    </section>)}
    {data.issues?.length ? <div className="space-y-1">{data.issues.map((issue, index) => <p key={`issue-${issue.code}-${index}`} className="flex gap-1 text-xs text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{issue.message}</p>)}</div> : null}
    {onCreateTripFromPlan && (
      <div className="pt-1 flex items-center justify-end">
        <Button
          size="sm"
          onClick={onCreateTripFromPlan}
          className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Tạo chuyến đi từ gợi ý này
        </Button>
      </div>
    )}
    <Provenance artifact={artifact} />
  </article>;
}

export function ArtifactRenderer({
  artifacts = [],
  onFeedback,
  onConfirm,
  onReject,
  onSelectPlace,
  selectedPlaceId,
  onViewDetails,
  onCreateTripFromPlan,
}: {
  artifacts?: AiArtifact[];
  onFeedback?: (artifactId: string, candidateId: string, action: "SAVE" | "REJECT" | "MORE_LIKE_THIS") => void;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  onSelectPlace?: (id: string) => void;
  selectedPlaceId?: string | null;
  onViewDetails?: (place: CorePlace) => void;
  onCreateTripFromPlan?: () => void;
}) {
  if (!artifacts.length) return null;
  const hasItineraryPreview = artifacts.some((a) => a.type === "ITINERARY_PREVIEW");
  const visibleArtifacts = hasItineraryPreview
    ? artifacts.filter((a) => a.type !== "PLACE_LIST" && a.type !== "PLACE_CARD")
    : artifacts;

  return <div className="space-y-2">{visibleArtifacts.map((artifact, artIndex) => {
    const artKey = `art-${artifact.artifactId || artIndex}`;
    if (artifact.type === "PLACE_LIST" || artifact.type === "PLACE_CARD") return <Places key={artKey} artifact={artifact} onFeedback={onFeedback} onSelectPlace={onSelectPlace} selectedPlaceId={selectedPlaceId} onViewDetails={onViewDetails} />;
    if (artifact.type === "TRIP_CONTEXT" || artifact.type === "ITINERARY_CONTEXT") return <TripContext key={artKey} artifact={artifact} />;
    if (artifact.type === "ITINERARY_PREVIEW") return <ItineraryPreview key={artKey} artifact={artifact} onSelectPlace={onSelectPlace} selectedPlaceId={selectedPlaceId} onViewDetails={onViewDetails} onCreateTripFromPlan={onCreateTripFromPlan} />;
    if (artifact.type === "CONFIRMATION") return <Confirmation key={artKey} artifact={artifact} onConfirm={onConfirm} onReject={onReject} />;
    return <p key={artKey} className="rounded-lg border border-border p-3 text-xs text-muted-foreground">Unsupported artifact version. The text response remains available.</p>;
  })}</div>;
}
