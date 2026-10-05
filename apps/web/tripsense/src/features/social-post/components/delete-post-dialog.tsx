"use client";

import * as React from "react";
import { ConfirmationDialog } from "@/components/shared";
import { useTranslation } from "@/i18n";

interface DeletePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function DeletePostDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: DeletePostDialogProps) {
  const { t } = useTranslation();

  const isDeletingRef = React.useRef(false);

  const handleConfirm = async () => {
    if (loading || isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      await onConfirm();
    } finally {
      isDeletingRef.current = false;
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("social.deletePostTitle")}
      description={t("social.deletePostConfirm")}
      confirmText={t("common.delete")}
      cancelText={t("common.cancel")}
      variant="destructive"
      loading={loading}
      loadingText={t("social.deleting")}
      onConfirm={handleConfirm}
    />
  );
}
