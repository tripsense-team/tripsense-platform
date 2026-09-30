"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/shared/page-container";
import { ConfirmationDialog, EmptyState, ResponsiveDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCollection,
  deleteCollection,
  listCollections,
  placeActionKeys,
  renameCollection,
  type PlaceCollection,
} from "@/features/place-actions";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { SavedPlacesView } from "./saved-places-view";

export function CollectionsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<PlaceCollection | null>(null);
  const [deleting, setDeleting] = React.useState<PlaceCollection | null>(null);
  const [name, setName] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const query = useQuery({ queryKey: placeActionKeys.collections, queryFn: listCollections });

  const saveMutation = useMutation({
    mutationFn: () => editing ? renameCollection(editing.id, name) : createCollection(name),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
      setSelectedId(saved.id);
      setDialogOpen(false);
    },
    onError: (value) => setError(getSafeErrorMessage(value, t("errors.generic"))),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: async () => {
      setSelectedId(null);
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
    },
    onError: (value) => setError(getSafeErrorMessage(value, t("errors.generic"))),
  });

  const openEditor = (collection?: PlaceCollection) => {
    setEditing(collection ?? null);
    setName(collection?.name ?? "");
    setError(null);
    setDialogOpen(true);
  };

  return (
    <PageContainer className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("places.collections")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("places.collectionsDescription")}</p>
        </div>
        <Button onClick={() => openEditor()}><FolderPlus className="h-4 w-4" />{t("places.createCollection")}</Button>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : query.isError ? (
        <EmptyState
          icon={Folder}
          title={t("errors.generic")}
          action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
        />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Folder} title={t("places.noCollections")} description={t("places.noCollectionsDescription")} action={<Button onClick={() => openEditor()}>{t("places.createCollection")}</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data?.map((collection) => (
            <div key={collection.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:shadow-sm">
              <button type="button" onClick={() => setSelectedId(collection.id)} className="w-full text-left">
                <Folder className="mb-3 h-6 w-6 text-primary" />
                <h2 className="truncate font-semibold text-foreground">{collection.name}</h2>
                <p className="text-sm text-muted-foreground">{t("places.placesCount", { count: collection.placeCount })}</p>
              </button>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <Button size="xs" variant="ghost" onClick={() => openEditor(collection)}><Pencil className="h-3.5 w-3.5" />{t("common.edit")}</Button>
                <Button size="xs" variant="ghost" onClick={() => setDeleting(collection)}><Trash2 className="h-3.5 w-3.5" />{t("common.delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !dialogOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {selectedId && <div className="border-t border-border pt-2"><SavedPlacesView key={selectedId} lockedCollectionId={selectedId} /></div>}

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? t("places.renameCollection") : t("places.createCollection")}>
        <div className="space-y-4" aria-live="polite">
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={t("places.newCollectionName")} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button loading={saveMutation.isPending} disabled={!name.trim()} onClick={() => saveMutation.mutate()}>{t("common.save")}</Button>
          </div>
        </div>
      </ResponsiveDialog>

      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("places.deleteCollection")}
        description={t("places.deleteCollectionDescription")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting ? deleteMutation.mutateAsync(deleting.id) : Promise.resolve()}
      />
    </PageContainer>
  );
}
