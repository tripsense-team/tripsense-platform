"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  loadingText?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
  loadingText,
  onConfirm,
}: ConfirmationDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);

  const isPending = loading || internalLoading;

  const handleConfirm = async () => {
    if (isPending) return;
    try {
      setInternalLoading(true);
      const result = onConfirm();
      if (result instanceof Promise) {
        await result;
      }
      onOpenChange(false);
    } catch {
      // If error occurs, let caller handle error/toast and do not auto-close
    } finally {
      setInternalLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return; // Prevent closing while action is running
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isPending}
            loading={isPending}
            loadingText={loadingText || (confirmText === "Xóa" ? "Đang xóa..." : undefined)}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
