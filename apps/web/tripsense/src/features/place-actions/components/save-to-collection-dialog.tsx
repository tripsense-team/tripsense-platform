"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader2 } from "lucide-react";
import { ResponsiveDialog, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import type { Place } from "@/features/places/types";
import {
  addPlaceToCollection,
  createCollection,
  listCollections,
  removePlaceFromCollection,
} from "../services/place-actions-api";
import { placeActionKeys } from "../hooks/use-place-actions";

interface Props {
  place: Place | null;
  open: boolean;
  selectedCollectionIds: string[];
  onOpenChange: (open: boolean) => void;
  onSaved?: (saved: boolean) => void;
}

export function SaveToCollectionDialog({
  place,
  open,
  selectedCollectionIds,
  onOpenChange,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(selectedCollectionIds),
  );
  const [newName, setNewName] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const collections = useQuery({
    queryKey: placeActionKeys.collections,
    queryFn: listCollections,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => createCollection(newName),
    onSuccess: (created) => {
      queryClient.setQueryData(placeActionKeys.collections, [
        created,
        ...(collections.data ?? []),
      ]);
      setSelected((current) => new Set(current).add(created.id));
      setNewName("");
    },
    onError: (error) => setMessage(getSafeErrorMessage(error, t("errors.generic"))),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!place) return;
      const before = new Set(selectedCollectionIds);
      const additions = [...selected].filter((id) => !before.has(id));
      const removals = [...before].filter((id) => !selected.has(id));
      await Promise.all([
        ...additions.map((id) => addPlaceToCollection(id, place.id)),
        ...removals.map((id) => removePlaceFromCollection(id, place.id)),
      ]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
      onSaved?.(selected.size > 0);
      onOpenChange(false);
    },
    onError: (error) => setMessage(getSafeErrorMessage(error, t("errors.generic"))),
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("places.saveToCollection")}
      description={place?.name}
    >
      <div className="space-y-4" aria-live="polite">
        <div className="flex gap-2">
          <Input
            value={newName}
            maxLength={80}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t("places.newCollectionName")}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            {t("common.create")}
          </Button>
        </div>

        {collections.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (collections.data?.length ?? 0) === 0 ? (
          <EmptyState title={t("places.noCollections")} description={t("places.noCollectionsDescription")} />
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {collections.data?.map((collection) => (
              <label key={collection.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(collection.id)}
                  onChange={() => setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(collection.id)) next.delete(collection.id); else next.add(collection.id);
                    return next;
                  })}
                  className="h-4 w-4 accent-primary"
                />
                <span className="flex-1 text-sm font-medium text-foreground">{collection.name}</span>
                <span className="text-xs text-muted-foreground">{collection.placeCount}</span>
              </label>
            ))}
          </div>
        )}

        {message && <p className="text-sm text-destructive">{message}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="button" disabled={!place || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
