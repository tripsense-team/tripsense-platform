"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/shared/page-container";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { MindtripPlaceCard } from "@/features/places/components/mindtrip-place-card";
import { PlaceDetailModal } from "@/features/places/components/place-detail-modal";
import type { Place } from "@/features/places/types";
import {
  listCollections,
  listSavedPlaces,
  placeActionKeys,
  SaveToCollectionDialog,
} from "@/features/place-actions";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";

export function SavedPlacesView({ lockedCollectionId }: { lockedCollectionId?: string }) {
  const { t } = useTranslation();
  const [collectionId, setCollectionId] = React.useState<string | undefined>(lockedCollectionId);
  const [page, setPage] = React.useState(0);
  const [selectedPlace, setSelectedPlace] = React.useState<Place | null>(null);
  const [savePlace, setSavePlace] = React.useState<Place | null>(null);
  const collections = useQuery({ queryKey: placeActionKeys.collections, queryFn: listCollections });
  const saved = useQuery({
    queryKey: placeActionKeys.saved(collectionId, page),
    queryFn: () => listSavedPlaces({ collectionId, page, size: 20 }),
  });

  return (
    <PageContainer className="space-y-6 py-6">
      {!lockedCollectionId && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("places.savedPlaces")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("places.savedPlacesDescription")}</p>
        </div>
      )}

      {!lockedCollectionId && (collections.data?.length ?? 0) > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={!collectionId ? "default" : "outline"} onClick={() => { setCollectionId(undefined); setPage(0); }}>{t("common.all")}</Button>
          {collections.data?.map((collection) => (
            <Button key={collection.id} size="sm" variant={collectionId === collection.id ? "default" : "outline"} onClick={() => { setCollectionId(collection.id); setPage(0); }}>
              {collection.name} ({collection.placeCount})
            </Button>
          ))}
        </div>
      )}

      {saved.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : saved.isError ? (
        <EmptyState
          icon={Bookmark}
          title={getSafeErrorMessage(saved.error, t("errors.generic"))}
          action={<Button variant="outline" onClick={() => void saved.refetch()}>{t("common.retry")}</Button>}
        />
      ) : (saved.data?.content.length ?? 0) === 0 ? (
        <EmptyState icon={Bookmark} title={t("places.noSavedPlaces")} description={t("places.noSavedPlacesDescription")} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {saved.data?.content.map((item) => item.place && (
              <MindtripPlaceCard
                key={item.placeRef}
                place={item.place}
                isFavorite
                onClick={() => setSelectedPlace(item.place)}
                onViewDetails={() => setSelectedPlace(item.place)}
                onToggleFavorite={() => setSavePlace(item.place)}
              />
            ))}
          </div>
          {(saved.data?.totalPages ?? 0) > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: saved.data?.totalPages ?? 0 }, (_, index) => (
                <Button key={index} size="sm" variant={page === index ? "default" : "outline"} onClick={() => setPage(index)}>{index + 1}</Button>
              ))}
            </div>
          )}
        </>
      )}

      <PlaceDetailModal place={selectedPlace} isOpen={selectedPlace !== null} onClose={() => setSelectedPlace(null)} />
      <SaveToCollectionDialog
        key={
          savePlace
            ? `${savePlace.id}:${[...(saved.data?.content.find((item) => item.placeRef === savePlace.id)?.collectionIds ?? [])].sort().join(",")}`
            : "closed-save-dialog"
        }
        place={savePlace}
        open={savePlace !== null}
        selectedCollectionIds={
          savePlace
            ? saved.data?.content.find((item) => item.placeRef === savePlace.id)?.collectionIds ?? []
            : []
        }
        onOpenChange={(open) => !open && setSavePlace(null)}
      />
    </PageContainer>
  );
}
