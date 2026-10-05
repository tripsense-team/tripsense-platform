"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  MapPin,
  Cpu,
  RefreshCw,
  Zap,
  PowerOff,
  Power,
  Globe,
  Bot,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  fetchApiKeys,
  addApiKeys,
  deleteApiKey,
  activateApiKey,
  disableApiKey,
  enableApiKey,
  resetQuotaKeys,
  testApiKey,
} from "../services/settings-api";
import type { ApiKeyPoolItem, ApiKeyProvider } from "../types";

interface TokenPoolCardProps {
  onKeyUpdated?: (newMaskedKey: string) => void;
}

export function TokenPoolCard({ onKeyUpdated }: TokenPoolCardProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<ApiKeyProvider>("ZIOMAP");
  const [keys, setKeys] = useState<ApiKeyPoolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputKeys, setInputKeys] = useState("");
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [actionKeyId, setActionKeyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadKeys = useCallback(async (selectedProvider: ApiKeyProvider) => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await fetchApiKeys(selectedProvider);
      setKeys(data);
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to load token pool:", err instanceof Error ? err.message : String(err));
      }
      const msg = err instanceof Error ? err.message : "Failed to load keys";
      setFeedback({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys(provider);
  }, [provider, loadKeys]);

  const activeKeyItem = keys.find((k) => k.status === "ACTIVE");
  const standbyCount = keys.filter(
    (k) => k.status === "INACTIVE" || k.status === "AVAILABLE"
  ).length;
  const disabledCount = keys.filter((k) => k.status === "DISABLED").length;
  const exhaustedCount = keys.filter(
    (k) => k.status === "EXHAUSTED" || k.status === "INVALID"
  ).length;

  const handleAddKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawKeys = inputKeys
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (rawKeys.length === 0) {
      setFeedback({
        type: "error",
        message: t("settings.tokenPool.addKeysEmpty"),
      });
      return;
    }

    setAdding(true);
    setFeedback(null);

    try {
      const saved = await addApiKeys(provider, rawKeys);
      setKeys(saved);
      setInputKeys("");
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.addKeysSuccess", {
          count: rawKeys.length,
        }),
      });

      const newActive = saved.find((k) => k.status === "ACTIVE");
      if (newActive && provider === "ZIOMAP" && onKeyUpdated) {
        onKeyUpdated(newActive.maskedKey);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add API keys";
      setFeedback({ type: "error", message: msg });
    } finally {
      setAdding(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!window.confirm(t("settings.tokenPool.activateConfirm"))) {
      return;
    }

    setActionKeyId(id);
    setFeedback(null);
    try {
      await activateApiKey(id);
      const updatedKeys = await fetchApiKeys(provider);
      setKeys(updatedKeys);
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.activateSuccess"),
      });
      const activated = updatedKeys.find((k) => k.id === id);
      if (activated && provider === "ZIOMAP" && onKeyUpdated) {
        onKeyUpdated(activated.maskedKey);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to activate API key";
      setFeedback({ type: "error", message: msg });
      await loadKeys(provider);
    } finally {
      setActionKeyId(null);
    }
  };

  const handleDisable = async (id: string) => {
    if (!window.confirm(t("settings.tokenPool.disableConfirm"))) {
      return;
    }

    setActionKeyId(id);
    setFeedback(null);
    try {
      await disableApiKey(id);
      await loadKeys(provider);
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.disableSuccess"),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to disable API key";
      setFeedback({ type: "error", message: msg });
    } finally {
      setActionKeyId(null);
    }
  };

  const handleEnable = async (id: string) => {
    setActionKeyId(id);
    setFeedback(null);
    try {
      await enableApiKey(id);
      await loadKeys(provider);
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.enableSuccess"),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to enable API key";
      setFeedback({ type: "error", message: msg });
    } finally {
      setActionKeyId(null);
    }
  };

  const handleTest = async (id: string) => {
    setActionKeyId(id);
    setFeedback(null);
    try {
      const res = await testApiKey(id);
      await loadKeys(provider);
      if (res.valid) {
        setFeedback({
          type: "success",
          message: t("settings.tokenPool.testSuccess"),
        });
      } else {
        setFeedback({
          type: "error",
          message: res.failureReason || t("settings.tokenPool.testFailed"),
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to test API key";
      setFeedback({ type: "error", message: msg });
      await loadKeys(provider);
    } finally {
      setActionKeyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("settings.tokenPool.deleteConfirm"))) {
      return;
    }

    setActionKeyId(id);
    setFeedback(null);
    try {
      await deleteApiKey(id);
      await loadKeys(provider);
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.deleteSuccess"),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete API key";
      setFeedback({ type: "error", message: msg });
    } finally {
      setActionKeyId(null);
    }
  };

  const handleResetQuota = async () => {
    if (!window.confirm(t("settings.tokenPool.resetQuotaConfirm"))) {
      return;
    }

    setResetting(true);
    setFeedback(null);
    try {
      const res = await resetQuotaKeys(provider);
      await loadKeys(provider);
      setFeedback({
        type: "success",
        message: t("settings.tokenPool.resetQuotaSuccess", {
          count: res.resetCount,
        }),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset quota";
      setFeedback({ type: "error", message: msg });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md transition-all hover:border-border/80">
      {/* Header and Provider Tabs */}
      <div className="flex flex-col gap-4 border-b border-border/50 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {t("settings.tokenPool.title")}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-micro font-semibold text-emerald-600 dark:text-emerald-400">
                <Zap className="h-3 w-3" /> Auto-Rotation
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.tokenPool.subtitle")}
            </p>
          </div>
        </div>

        {/* Provider Switcher Tabs & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl border border-border/60 bg-background/80 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setProvider("ZIOMAP")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                provider === "ZIOMAP"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>{t("settings.tokenPool.tabZioMap")}</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider("GEMINI")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                provider === "GEMINI"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>{t("settings.tokenPool.tabGemini")}</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider("OPENAI")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                provider === "OPENAI"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{t("settings.tokenPool.tabOpenAi")}</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider("MAPVINA")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                provider === "MAPVINA"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{t("settings.tokenPool.tabMapVina")}</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider("GOOGLE_MAPS")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                provider === "GOOGLE_MAPS"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>{t("settings.tokenPool.tabGoogleMaps")}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadKeys(provider)}
            disabled={loading}
            title={t("settings.tokenPool.refresh")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground shadow-xs transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Active Key */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("settings.tokenPool.activeKey")}</span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
            {activeKeyItem ? activeKeyItem.maskedKey : t("settings.tokenPool.noActiveKey")}
          </div>
        </div>

        {/* Standby Keys (INACTIVE / AVAILABLE) */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 transition-all">
          <div className="text-xs text-muted-foreground">
            {t("settings.tokenPool.availableKeys")}
          </div>
          <div className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
            {standbyCount}
          </div>
        </div>

        {/* Disabled Keys */}
        <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 transition-all">
          <div className="text-xs text-muted-foreground">
            {t("settings.tokenPool.statusDisabled")}
          </div>
          <div className="mt-1 text-lg font-bold text-muted-foreground">
            {disabledCount}
          </div>
        </div>

        {/* Exhausted / Issue Keys */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("settings.tokenPool.exhaustedKeys")}</span>
            {exhaustedCount > 0 && (
              <button
                type="button"
                onClick={handleResetQuota}
                disabled={resetting}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                <RotateCcw className={`h-3 w-3 ${resetting ? "animate-spin" : ""}`} />
                <span>{t("settings.tokenPool.resetQuota")}</span>
              </button>
            )}
          </div>
          <div className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
            {exhaustedCount}
          </div>
        </div>
      </div>

      {/* Batch Add API Keys Form */}
      <form onSubmit={handleAddKeys} className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>{t("settings.tokenPool.addKeysTitle")}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({provider})
          </span>
        </div>
        <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-start">
          <textarea
            rows={2}
            value={inputKeys}
            onChange={(e) => setInputKeys(e.target.value)}
            placeholder={t("settings.tokenPool.addKeysPlaceholder")}
            disabled={adding}
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={adding || !inputKeys.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>{t("settings.tokenPool.addKeysButton")}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Keys Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-background/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/50 bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("settings.tokenPool.colKey")}</th>
                <th className="px-3 py-3">{t("settings.tokenPool.colStatus")}</th>
                <th className="px-3 py-3">{t("settings.tokenPool.colSuccess")}</th>
                <th className="px-3 py-3">{t("settings.tokenPool.colLastUsed")}</th>
                <th className="px-4 py-3 text-right">{t("settings.tokenPool.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading keys...</span>
                      </div>
                    ) : (
                      t("settings.tokenPool.emptyPool")
                    )}
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr
                    key={k.id}
                    className={`transition-colors hover:bg-muted/30 ${
                      k.status === "ACTIVE" ? "bg-emerald-500/[0.03]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{k.maskedKey}</span>
                        {k.status === "ACTIVE" && (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {k.status === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t("settings.tokenPool.statusActive")}
                        </span>
                      )}
                      {(k.status === "INACTIVE" || k.status === "AVAILABLE") && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {t("settings.tokenPool.statusInactive")}
                        </span>
                      )}
                      {k.status === "DISABLED" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <PowerOff className="h-2.5 w-2.5" />
                          {t("settings.tokenPool.statusDisabled")}
                        </span>
                      )}
                      {k.status === "EXHAUSTED" && (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {t("settings.tokenPool.statusExhausted")}
                          </span>
                          {k.failureReason && (
                            <p className="mt-0.5 text-micro text-rose-500 truncate max-w-[200px]" title={k.failureReason}>
                              {k.failureReason}
                            </p>
                          )}
                        </div>
                      )}
                      {k.status === "INVALID" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                          {t("settings.tokenPool.statusInvalid")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold text-foreground">
                      {k.successCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            month: "short",
                            day: "numeric",
                          })
                        : t("settings.tokenPool.neverUsed")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Activate Button */}
                        {k.status !== "ACTIVE" && k.status !== "DISABLED" && (
                          <button
                            type="button"
                            onClick={() => handleActivate(k.id)}
                            disabled={actionKeyId === k.id || k.status === "INVALID"}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary shadow-xs transition hover:bg-primary/20 disabled:opacity-50"
                          >
                            {actionKeyId === k.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            <span>{t("settings.tokenPool.activate")}</span>
                          </button>
                        )}

                        {/* Enable button for DISABLED key */}
                        {k.status === "DISABLED" && (
                          <button
                            type="button"
                            onClick={() => handleEnable(k.id)}
                            disabled={actionKeyId === k.id}
                            title={t("settings.tokenPool.enable")}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 shadow-xs transition hover:bg-emerald-500/20 dark:text-emerald-400 disabled:opacity-50"
                          >
                            {actionKeyId === k.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Power className="h-3 w-3" />
                            )}
                            <span>{t("settings.tokenPool.enable")}</span>
                          </button>
                        )}

                        {/* Disable button for non-disabled key */}
                        {k.status !== "DISABLED" && (
                          <button
                            type="button"
                            onClick={() => handleDisable(k.id)}
                            disabled={actionKeyId === k.id}
                            title={t("settings.tokenPool.disable")}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-xs transition hover:border-amber-500/40 hover:text-amber-600 disabled:opacity-50"
                          >
                            {actionKeyId === k.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PowerOff className="h-3 w-3" />
                            )}
                            <span>{t("settings.tokenPool.disable")}</span>
                          </button>
                        )}

                        {/* Test button */}
                        {k.status !== "INVALID" && (
                          <button
                            type="button"
                            onClick={() => handleTest(k.id)}
                            disabled={actionKeyId === k.id}
                            title={t("settings.tokenPool.testKey")}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-xs transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                          >
                            {actionKeyId === k.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            <span>{t("settings.tokenPool.testKey")}</span>
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(k.id)}
                          disabled={actionKeyId === k.id}
                          title={t("settings.tokenPool.delete")}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {actionKeyId === k.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
