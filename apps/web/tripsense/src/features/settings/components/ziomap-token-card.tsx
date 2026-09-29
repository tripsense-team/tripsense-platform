"use client";

import React, { useState } from "react";
import { KeyRound, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "@/i18n";
import { updateZioMapKey } from "../services/settings-api";

interface ZioMapTokenCardProps {
  isConfigured: boolean;
  maskedKey: string;
  onKeyUpdated: (newMaskedKey: string) => void;
}

export function ZioMapTokenCard({
  isConfigured,
  maskedKey,
  onKeyUpdated,
}: ZioMapTokenCardProps) {
  const { t } = useTranslation();
  const [inputKey, setInputKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await updateZioMapKey(inputKey.trim());
      setSuccessMsg(t("settings.tokenCard.successMessage"));
      onKeyUpdated(res.maskedKey);
      setInputKey("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("settings.tokenCard.errorMessage");
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md transition-all hover:border-border/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t("settings.tokenCard.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("settings.tokenCard.description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("settings.tokenCard.statusActive")}:</span>
              <span className="font-mono text-[11px] font-semibold tracking-wider">
                {maskedKey || "Configured"}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{t("settings.tokenCard.statusMissing")}</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder={t("settings.tokenCard.inputPlaceholder")}
            disabled={loading}
            className="w-full rounded-xl border border-input bg-background/80 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !inputKey.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("settings.tokenCard.validating")}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>{t("settings.tokenCard.testAndSave")}</span>
            </>
          )}
        </button>
      </form>

      {successMsg && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
