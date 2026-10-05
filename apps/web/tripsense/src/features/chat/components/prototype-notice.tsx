"use client";

import * as React from "react";
import { WifiOff, AlertTriangle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/i18n";
import { mockChatService } from "../services/mock-chat-service";

export interface PrototypeNoticeProps {
  isOffline: boolean;
  simulateFailure: boolean;
  onRefresh: () => void;
}

export function PrototypeNotice({
  isOffline,
  simulateFailure,
  onRefresh,
}: PrototypeNoticeProps) {
  const { t } = useTranslation();

  const handleToggleOffline = () => {
    mockChatService.setIsOffline(!isOffline);
    onRefresh();
  };

  const handleToggleFailure = () => {
    mockChatService.setSimulateFailure(!simulateFailure);
    onRefresh();
  };

  const handleResetData = () => {
    mockChatService.reset();
    onRefresh();
  };

  return (
    <div className="bg-muted/30 border-b border-border/40 px-3.5 py-1.5 flex items-center justify-between text-xs select-none">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">
          {t("chat.prototype.badge")}
        </span>
        <span className="text-muted-foreground text-xs truncate hidden sm:inline font-medium">
          {t("chat.prototype.dataDisclaimer")}
        </span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 rounded-full hover:bg-muted"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{t("chat.prototype.tools")}</span>
            {(isOffline || simulateFailure) && (
              <span className="h-2 w-2 rounded-full bg-destructive" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3.5 space-y-3 rounded-2xl shadow-lg border-border">
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span>{t("chat.prototype.tools")}</span>
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("chat.prototype.dataDisclaimer")}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/60">
            <Button
              variant={isOffline ? "destructive" : "outline"}
              size="sm"
              onClick={handleToggleOffline}
              className="w-full justify-start text-xs font-semibold gap-2 rounded-xl h-9"
            >
              <WifiOff className="h-4 w-4" />
              <span>
                {isOffline
                  ? t("chat.prototype.onlineMode")
                  : t("chat.prototype.offlineMode")}
              </span>
            </Button>

            <Button
              variant={simulateFailure ? "destructive" : "outline"}
              size="sm"
              onClick={handleToggleFailure}
              className="w-full justify-start text-xs font-semibold gap-2 rounded-xl h-9"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>
                {simulateFailure
                  ? t("chat.prototype.simulateSuccess")
                  : t("chat.prototype.simulateError")}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetData}
              className="w-full justify-start text-xs font-semibold gap-2 text-muted-foreground hover:text-foreground rounded-xl h-9"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t("chat.prototype.resetData")}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
