"use client";

import * as React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Archive, ImageOff, MapPin, Pencil, Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { ApiError } from "@/services/api-client";
import { loadPlacePhotoGallery } from "@/features/places/services/place-photo-enrichment";
import { approvedPhoto } from "@/features/places/utils/approved-photo";
import {
  archiveAdminPlace, createAdminPlace, getAdminPlace, listAdminPlaces,
  restoreAdminPlace, reverseGeocodeAdminPlace, updateAdminPlace,
} from "../services/admin-places-api";
import type { AdminPlaceDetail, AdminPlaceMutation, AdminPlaceSummary } from "../types";

type FormState = Record<"name" | "primaryType" | "categories" | "lat" | "lng" | "address" |
  "oldAddress" | "city" | "district" | "phone" | "website" | "socials" | "openingHours" |
  "businessStatus" | "description", string>;

const EMPTY_FORM: FormState = {
  name: "", primaryType: "tourist_attraction", categories: "tourist_attraction", lat: "", lng: "",
  address: "", oldAddress: "", city: "", district: "", phone: "", website: "", socials: "",
  openingHours: "", businessStatus: "OPERATIONAL", description: "",
};

const fieldClass = "space-y-1.5";
const selectClass = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const AdminPlaceLocationPicker = dynamic(
  () => import("./admin-place-location-picker").then((module) => module.AdminPlaceLocationPicker),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-xl" /> },
);

function formFromPlace(place: AdminPlaceDetail): FormState {
  return {
    name: place.name, primaryType: place.primaryType ?? "", categories: place.categories.join(", "),
    lat: String(place.location.lat), lng: String(place.location.lng), address: place.address,
    oldAddress: place.oldAddress ?? "", city: place.city, district: place.district ?? "",
    phone: place.phone ?? "", website: place.website ?? "", socials: place.socials.join(", "),
    openingHours: place.openingHours ?? "", businessStatus: place.businessStatus ?? "",
    description: place.description ?? "",
  };
}

function payloadFromForm(form: FormState): AdminPlaceMutation {
  const optional = (value: string) => value.trim() || null;
  return {
    name: form.name.trim(), primaryType: form.primaryType || null,
    categories: form.categories.split(",").map((value) => value.trim()).filter(Boolean),
    location: { lat: Number(form.lat), lng: Number(form.lng) }, address: form.address.trim(),
    oldAddress: optional(form.oldAddress), city: form.city.trim(), district: optional(form.district),
    phone: optional(form.phone), website: optional(form.website),
    socials: form.socials.split(",").map((value) => value.trim()).filter(Boolean),
    openingHours: optional(form.openingHours), businessStatus: optional(form.businessStatus),
    description: optional(form.description),
  };
}

function selectedLocation(form: FormState): { lat: number; lng: number } | null {
  if (!form.lat.trim() || !form.lng.trim()) return null;
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng } : null;
}

export function AdminPlacesView() {
  const { t, locale } = useTranslation();
  const [items, setItems] = React.useState<AdminPlaceSummary[]>([]);
  const [query, setQuery] = React.useState("");
  const [lifecycle, setLifecycle] = React.useState("ACTIVE");
  const [source, setSource] = React.useState("ALL");
  const [category, setCategory] = React.useState("");
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminPlaceDetail | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [lookupState, setLookupState] = React.useState<"idle" | "loading" | "filled" | "suggestion" | "noMatch" | "error">("idle");
  const [suggestedAddress, setSuggestedAddress] = React.useState<string | null>(null);
  const lookupSequence = React.useRef(0);
  const addressEditSequence = React.useRef(0);
  const lookupAbort = React.useRef<AbortController | null>(null);

  const resetLookup = () => {
    lookupSequence.current += 1;
    lookupAbort.current?.abort();
    lookupAbort.current = null;
    setLookupState("idle");
    setSuggestedAddress(null);
  };

  React.useEffect(() => () => lookupAbort.current?.abort(), []);

  const safeError = React.useCallback((reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 409) return t("admin.places.errors.conflict");
    if (reason instanceof ApiError && reason.status === 403) return t("admin.places.errors.forbidden");
    return t("admin.places.errors.generic");
  }, [t]);

  const load = React.useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await listAdminPlaces({ q: query.trim() || undefined, lifecycle, source,
        category: category || undefined, cursor });
      setItems((current) => append ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [category, lifecycle, query, safeError, source]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [lifecycle, source, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { resetLookup(); setEditing(null); setForm(EMPTY_FORM); setError(null); setDialogOpen(true); };
  const openEdit = async (id: string) => {
    setActionId(id); setError(null);
    try {
      const response = await getAdminPlace(id);
      resetLookup(); setEditing(response.data); setForm(formFromPlace(response.data)); setDialogOpen(true);
    } catch (reason) { setError(safeError(reason)); }
    finally { setActionId(null); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      if (!form.lat.trim() || !form.lng.trim()) {
        setError(t("admin.places.errors.locationRequired")); return;
      }
      const payload = payloadFromForm(form);
      if (!Number.isFinite(payload.location.lat) || !Number.isFinite(payload.location.lng)
        || Math.abs(payload.location.lat) > 90 || Math.abs(payload.location.lng) > 180) {
        setError(t("admin.places.errors.coordinates")); return;
      }
      if (editing) await updateAdminPlace(editing.id, editing.version, payload);
      else await createAdminPlace(payload);
      resetLookup(); setDialogOpen(false); await load();
    } catch (reason) { setError(safeError(reason)); }
    finally { setSaving(false); }
  };

  const changeLifecycle = async (place: AdminPlaceSummary) => {
    const verb = place.lifecycleStatus === "ACTIVE" ? t("admin.places.archive") : t("admin.places.restore");
    if (!window.confirm(t("admin.places.confirmAction", { action: verb, name: place.name }))) return;
    setActionId(place.id); setError(null);
    try {
      if (place.lifecycleStatus === "ACTIVE") await archiveAdminPlace(place.id, place.version);
      else await restoreAdminPlace(place.id, place.version);
      await load();
    } catch (reason) { setError(safeError(reason)); }
    finally { setActionId(null); }
  };

  const updateField = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (key === "address") {
      addressEditSequence.current += 1;
      if (lookupState === "filled") setLookupState("idle");
    }
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const selectMapLocation = async ({ lat, lng }: { lat: number; lng: number }) => {
    lookupAbort.current?.abort();
    const controller = new AbortController();
    lookupAbort.current = controller;
    const sequence = ++lookupSequence.current;
    const editSequence = addressEditSequence.current;
    setForm((current) => ({ ...current, lat: String(lat), lng: String(lng) }));
    setSuggestedAddress(null);
    setLookupState("loading");
    try {
      const response = await reverseGeocodeAdminPlace(lat, lng, controller.signal);
      if (sequence !== lookupSequence.current || controller.signal.aborted) return;
      const address = response.data.matched ? response.data.address?.trim() : null;
      if (!address) { setLookupState("noMatch"); return; }
      if (addressEditSequence.current !== editSequence) {
        setSuggestedAddress(address);
        setLookupState("suggestion");
        return;
      }
      setForm((current) => ({ ...current, address }));
      setLookupState("filled");
    } catch {
      if (sequence === lookupSequence.current && !controller.signal.aborted) setLookupState("error");
    }
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/10 text-primary"><MapPin className="mr-1 h-3.5 w-3.5" />{t("admin.places.catalog")}</Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("admin.places.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.places.serverSubtitle")}</p>
      </div>
      <Button onClick={openCreate} className="gap-2 self-start sm:self-auto"><Plus className="h-4 w-4" />{t("admin.places.addPlace")}</Button>
    </div>

    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs md:grid-cols-[1fr_auto_auto_auto]">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.places.searchPlaceholder")} className="pl-9" /></div>
      <select aria-label={t("admin.places.lifecycleLabel")} value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className={selectClass}>
        <option value="ACTIVE">{t("admin.places.lifecycle.active")}</option><option value="ARCHIVED">{t("admin.places.lifecycle.archived")}</option><option value="ALL">{t("admin.places.categories.all")}</option>
      </select>
      <select aria-label={t("admin.places.sourceLabel")} value={source} onChange={(event) => setSource(event.target.value)} className={selectClass}>
        <option value="ALL">{t("admin.places.categories.all")}</option><option value="MANUAL">{t("admin.places.sources.manual")}</option><option value="PROVIDER">{t("admin.places.sources.provider")}</option>
      </select>
      <Button type="submit" variant="outline">{t("admin.places.search")}</Button>
    </form>
    <div className="flex flex-wrap gap-2">{["", "ATTRACTION", "FOOD", "CAFE", "STAY"].map((value) => <Button key={value || "ALL"} size="sm" variant={category === value ? "default" : "outline"} onClick={() => setCategory(value)}>{t(`admin.places.categories.${value ? value.toLowerCase() : "all"}`)}</Button>)}</div>

    {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{t("admin.places.retry")}</Button></div>}
    {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}</div> : items.length === 0 ?
      <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{t("admin.places.empty")}</CardContent></Card> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((place) => <AdminPlaceCard
        key={place.id} place={place} locale={locale} busy={actionId === place.id}
        onEdit={() => void openEdit(place.id)} onChangeLifecycle={() => void changeLifecycle(place)}
      />)}</div>}
    {nextCursor && <div className="text-center"><Button variant="outline" disabled={loadingMore} onClick={() => void load(nextCursor, true)}>{loadingMore ? t("admin.places.loading") : t("admin.places.loadMore")}</Button></div>}

    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) { if (!open) resetLookup(); setDialogOpen(open); } }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border pb-4 pl-6 pr-14 pt-6">
          <DialogTitle>{editing ? t("admin.places.editTitle") : t("admin.places.createTitle")}</DialogTitle>
          <DialogDescription>{t("admin.places.formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.places.fields.name")}><Input required maxLength={200} value={form.name} onChange={updateField("name")} /></Field>
              <Field label={t("admin.places.fields.primaryType")}><select value={form.primaryType} onChange={updateField("primaryType")} className={selectClass}><option value="">—</option><option value="tourist_attraction">tourist_attraction</option><option value="restaurant">restaurant</option><option value="cafe">cafe</option><option value="hotel">hotel</option><option value="museum">museum</option><option value="park">park</option></select></Field>
              <Field label={t("admin.places.fields.categories")}><Input required value={form.categories} onChange={updateField("categories")} /></Field>
              <Field label={t("admin.places.fields.city")}><Input required maxLength={120} value={form.city} onChange={updateField("city")} /></Field>
              <Field label={t("admin.places.fields.address")} wide><Input required maxLength={500} value={form.address} onChange={updateField("address")} /></Field>
              <Field label={t("admin.places.fields.oldAddress")} wide><Input maxLength={500} value={form.oldAddress} onChange={updateField("oldAddress")} /></Field>
            </div>

            <section className="min-w-0 space-y-3">
              <div className="space-y-1">
                <Label>{t("admin.places.locationMapLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.places.locationMapHint")}</p>
              </div>
              <AdminPlaceLocationPicker
                value={selectedLocation(form)}
                onChange={(location) => void selectMapLocation(location)}
              />
              {selectedLocation(form) && <p role="status" className="text-xs text-muted-foreground">{t("admin.places.locationSelected", { lat: Number(form.lat).toFixed(5), lng: Number(form.lng).toFixed(5) })}</p>}
              {lookupState !== "idle" && <div role="status" className="text-xs text-muted-foreground">
                {lookupState === "loading" && t("admin.places.reverseGeocode.loading")}
                {lookupState === "filled" && t("admin.places.reverseGeocode.filled")}
                {lookupState === "noMatch" && t("admin.places.reverseGeocode.noMatch")}
                {lookupState === "error" && t("admin.places.reverseGeocode.error")}
                {lookupState === "suggestion" && suggestedAddress && <span className="flex flex-wrap items-center gap-2">
                  <span>{t("admin.places.reverseGeocode.suggestion", { address: suggestedAddress })}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => { addressEditSequence.current += 1; setForm((current) => ({ ...current, address: suggestedAddress })); setSuggestedAddress(null); setLookupState("filled"); }}>{t("admin.places.reverseGeocode.useSuggestion")}</Button>
                </span>}
              </div>}
              <details className="block rounded-xl border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">{t("admin.places.manualCoordinates")}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t("admin.places.fields.latitude")}><Input type="number" min="-90" max="90" step="any" value={form.lat} onChange={(event) => { resetLookup(); setForm((current) => ({ ...current, lat: event.target.value })); }} /></Field>
                  <Field label={t("admin.places.fields.longitude")}><Input type="number" min="-180" max="180" step="any" value={form.lng} onChange={(event) => { resetLookup(); setForm((current) => ({ ...current, lng: event.target.value })); }} /></Field>
                </div>
              </details>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.places.fields.district")}><Input value={form.district} onChange={updateField("district")} /></Field>
              <Field label={t("admin.places.fields.phone")}><Input value={form.phone} onChange={updateField("phone")} /></Field>
              <Field label={t("admin.places.fields.website")} wide><Input type="url" placeholder="https://" value={form.website} onChange={updateField("website")} /></Field>
              <Field label={t("admin.places.fields.socials")} wide><Input placeholder="https://..., https://..." value={form.socials} onChange={updateField("socials")} /></Field>
              <Field label={t("admin.places.fields.openingHours")}><Input value={form.openingHours} onChange={updateField("openingHours")} /></Field>
              <Field label={t("admin.places.fields.businessStatus")}><Input value={form.businessStatus} onChange={updateField("businessStatus")} /></Field>
              <Field label={t("admin.places.fields.description")} wide><Textarea maxLength={4000} rows={4} value={form.description} onChange={updateField("description")} /></Field>
            </div>
          </div>
          <div className="shrink-0 space-y-3 border-t border-border bg-background px-6 py-4">
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => { resetLookup(); setDialogOpen(false); }}>{t("admin.places.cancel")}</Button><Button type="submit" disabled={saving || lookupState === "loading"}>{saving ? t("admin.places.saving") : t("admin.places.save")}</Button></DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={`${fieldClass} min-w-0 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>;
}

function approvedCoverUrl(url: string | null): string | null {
  if (!url) return null;
  return approvedPhoto({ url, source: "cloudinary", attribution: [], fetchedAt: "", displayApproved: true })?.url ?? null;
}

function AdminPlaceCard({ place, locale, busy, onEdit, onChangeLifecycle }: {
  place: AdminPlaceSummary;
  locale: string;
  busy: boolean;
  onEdit: () => void;
  onChangeLifecycle: () => void;
}) {
  const { t } = useTranslation();
  const visibilityRef = React.useRef<HTMLDivElement>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = React.useState<string | null>(null);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = React.useState<string | null>(null);
  const coverUrl = approvedCoverUrl(place.coverPhotoUrl);
  const photoUrl = coverUrl && coverUrl !== failedPhotoUrl ? coverUrl :
    loadedPhotoUrl && loadedPhotoUrl !== failedPhotoUrl ? loadedPhotoUrl : null;
  const lifecycleLabel = t(`admin.places.lifecycle.${place.lifecycleStatus.toLowerCase()}`);
  const actionLabel = place.lifecycleStatus === "ACTIVE" ? t("admin.places.archive") : t("admin.places.restore");

  React.useEffect(() => {
    if (place.managementSource !== "PROVIDER" || process.env.NEXT_PUBLIC_PLACE_PHOTOS_ENABLED !== "true"
      || (coverUrl && failedPhotoUrl !== coverUrl)) return;
    const element = visibilityRef.current;
    if (!element) return;
    let active = true;
    let requested = false;
    const requestPhoto = () => {
      if (requested) return;
      requested = true;
      void loadPlacePhotoGallery({ id: place.id, name: place.name, photos: [] })
        .then((photos) => {
          if (active) setLoadedPhotoUrl(photos[0]?.url ?? null);
        });
    };
    if (typeof IntersectionObserver === "undefined") requestPhoto();
    else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestPhoto();
          observer.disconnect();
        }
      }, { rootMargin: "200px" });
      observer.observe(element);
      return () => { active = false; observer.disconnect(); };
    }
    return () => { active = false; };
  }, [coverUrl, failedPhotoUrl, place.id, place.name, place.managementSource]);

  return <Card ref={visibilityRef} className="flex h-full min-w-0 flex-col overflow-hidden border-border bg-card p-0 shadow-2xs">
    <div className="relative flex h-44 w-full shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground sm:h-48 xl:h-52">
      {photoUrl ? <Image src={photoUrl} alt={place.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" unoptimized className="object-cover" onError={() => setFailedPhotoUrl(photoUrl)} /> :
        <div className="flex h-full w-full flex-col items-center justify-center gap-2"><ImageOff className="h-7 w-7" /><span className="text-xs">{t("admin.places.noPhoto")}</span></div>}
    </div>
    <CardContent className="flex min-w-0 flex-1 flex-col gap-3 p-5">
      <Badge variant={place.lifecycleStatus === "ACTIVE" ? "default" : "secondary"} className="w-fit max-w-full shrink-0 whitespace-nowrap">{lifecycleLabel}</Badge>
      <div className="min-w-0">
        <h2 className="line-clamp-2 min-h-12 break-words font-semibold leading-6 text-foreground" title={place.name}>{place.name}</h2>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{place.city}</span></p>
      </div>
      <div className="flex min-w-0 flex-wrap gap-2 text-xs"><Badge variant="outline" className="max-w-full truncate">{place.primaryType}</Badge><Badge variant="outline">{place.managementSource}</Badge><Badge variant="outline">v{place.version}</Badge></div>
      <p className="text-xs text-muted-foreground">{place.updatedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(place.updatedAt)) : t("admin.places.notAvailable")}</p>
      <div className="mt-auto flex min-w-0 gap-2 border-t border-border pt-3"><Button variant="outline" size="sm" className="min-w-0 flex-1" disabled={busy} onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5 shrink-0" /><span className="truncate">{t("admin.places.edit")}</span></Button><Button variant="outline" size="sm" className="shrink-0" aria-label={actionLabel} disabled={busy} onClick={onChangeLifecycle}>{place.lifecycleStatus === "ACTIVE" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}</Button></div>
    </CardContent>
  </Card>;
}
