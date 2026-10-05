"use client";

import * as React from "react";
import { UserCheck, UserX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared";
import { ChatUser } from "../types/chat.types";
import { useTranslation } from "@/i18n";

export interface MessageRequestBannerProps {
  user: ChatUser;
  onAccept: () => void;
  onDecline: () => void;
  onBlock: () => void;
}

export function MessageRequestBanner({
  user,
  onAccept,
  onDecline,
  onBlock,
}: MessageRequestBannerProps) {
  const { t } = useTranslation();
  const [showBlockConfirm, setShowBlockConfirm] = React.useState(false);

  return (
    <>
      <div className="p-4 bg-muted/60 border-b border-border text-center flex flex-col items-center gap-3 animate-in fade-in-50 duration-200">
        <div className="space-y-1">
          <h4 className="text-heading text-foreground">
            {t("chat.requestBanner.title", { name: user.name })}
          </h4>
          <p className="text-body text-muted-foreground max-w-md">
            {t("chat.requestBanner.description")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Button
            size="sm"
            onClick={onAccept}
            className="h-11 rounded-xl gap-1.5 bg-primary text-primary-foreground text-xs shadow-xs sm:h-9"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>{t("chat.requestBanner.accept")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onDecline}
            className="h-11 rounded-xl gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:h-9"
          >
            <UserX className="h-3.5 w-3.5" />
            <span>{t("chat.requestBanner.decline")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBlockConfirm(true)}
            className="h-11 rounded-xl gap-1.5 text-xs text-destructive hover:bg-destructive/10 sm:h-9"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{t("chat.requestBanner.block")}</span>
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={showBlockConfirm}
        onOpenChange={setShowBlockConfirm}
        title={t("chat.dialogs.blockConfirm.title")}
        description={t("chat.dialogs.blockConfirm.description", { name: user.name })}
        confirmText={t("chat.dialogs.blockConfirm.confirm")}
        cancelText={t("chat.dialogs.blockConfirm.cancel")}
        variant="destructive"
        onConfirm={onBlock}
      />
    </>
  );
}
