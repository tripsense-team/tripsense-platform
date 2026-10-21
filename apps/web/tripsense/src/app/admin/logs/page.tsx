"use client";

import * as React from "react";
import { AlertTriangle, FileText, RefreshCw, Search } from "lucide-react";
import { apiClient, ApiError } from "@/services/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";

type LogLevel = "INFO" | "WARN" | "ERROR";
type LogRange = "15m" | "1h" | "6h" | "24h";

interface LogEntry {
  timestamp: string;
  service: string;
  level: LogLevel;
  eventCode: string;
  safeMessage: string;
  correlationRef?: string;
}

interface LogsResponse {
  success: boolean;
  data: { entries: LogEntry[]; nextCursor: string | null; truncated: boolean };
}

const services = [
  "api-gateway",
  "discovery-server",
  "user-service",
  "place-service",
  "trip-service",
  "social-service",
  "context-service",
  "recommendation-service",
  "mail-service",
  "ai-service",
];

export default function AdminLogsPage() {
  const { t } = useTranslation();
  const [service, setService] = React.useState("api-gateway");
  const [level, setLevel] = React.useState<"all" | LogLevel>("all");
  const [range, setRange] = React.useState<LogRange>("1h");
  const [correlationRef, setCorrelationRef] = React.useState("");
  const [entries, setEntries] = React.useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);

  const loadLogs = React.useCallback(async (cursor?: string) => {
    setLoading(true);
    setUnavailable(false);
    const params = new URLSearchParams({ service, range, limit: "100" });
    if (level !== "all") params.set("level", level);
    if (correlationRef.trim()) params.set("correlationRef", correlationRef.trim());
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await apiClient<LogsResponse>(`/api/ops/logs?${params.toString()}`);
      setEntries((current) => (cursor ? [...current, ...response.data.entries] : response.data.entries));
      setNextCursor(response.data.nextCursor);
    } catch (error) {
      // A missing/disabled provider is an expected safe state until observability is enabled.
      if (error instanceof ApiError && [400, 401, 403, 404, 503].includes(error.status)) {
        setUnavailable(true);
        setEntries([]);
        setNextCursor(null);
      } else {
        setUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, [service, range, level, correlationRef]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle>{t("admin.logs.title")}</CardTitle>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("admin.logs.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={() => void loadLogs()} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            {t("admin.logs.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("admin.logs.service")}</span>
              <select className="h-10 w-full rounded-xl border border-input bg-background px-3" value={service} onChange={(event) => setService(event.target.value)}>
                {services.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("admin.logs.level")}</span>
              <select className="h-10 w-full rounded-xl border border-input bg-background px-3" value={level} onChange={(event) => setLevel(event.target.value as "all" | LogLevel)}>
                <option value="all">{t("admin.logs.allLevels")}</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("admin.logs.range")}</span>
              <select className="h-10 w-full rounded-xl border border-input bg-background px-3" value={range} onChange={(event) => setRange(event.target.value as LogRange)}>
                <option value="15m">15m</option><option value="1h">1h</option><option value="6h">6h</option><option value="24h">24h</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("admin.logs.correlation")}</span>
              <Input value={correlationRef} maxLength={128} pattern="[A-Za-z0-9._:-]+" onChange={(event) => setCorrelationRef(event.target.value)} placeholder="req_..." />
            </label>
          </div>

          {unavailable ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <h2 className="font-semibold">{t("admin.logs.unavailableTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("admin.logs.unavailableDescription")}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Search className="mx-auto mb-2 h-5 w-5" />{t("admin.logs.empty")}</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <div key={`${entry.timestamp}-${entry.eventCode}-${index}`} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{entry.level}</Badge><span className="font-medium">{entry.service}</span><span className="text-muted-foreground">{entry.eventCode}</span><time className="ml-auto text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</time></div>
                  <p className="mt-2 text-muted-foreground">{entry.safeMessage}</p>
                  {entry.correlationRef && <p className="mt-1 font-mono text-xs text-muted-foreground">{entry.correlationRef}</p>}
                </div>
              ))}
              {nextCursor && <Button variant="outline" onClick={() => void loadLogs(nextCursor)} loading={loading}>{t("admin.logs.loadMore")}</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
