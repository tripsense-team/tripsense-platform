"use client";

import * as React from "react";
import { ConfirmationDialog } from "@/components/shared";

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
  const handleConfirm = async () => {
    if (loading) return;
    await onConfirm();
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Xóa bài viết?"
      description="Hành động này không thể hoàn tác. Bài viết sẽ bị xóa vĩnh viễn khỏi hệ thống."
      confirmText="Xóa"
      cancelText="Hủy"
      variant="destructive"
      loading={loading}
      loadingText="Đang xóa..."
      onConfirm={handleConfirm}
    />
  );
}
