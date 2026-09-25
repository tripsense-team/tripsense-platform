import { Check, ChevronDown, CircleAlert, Minus } from "lucide-react";
import { AiLoadingSpinner } from "@/components/shared";
import type { AgentActivity } from "./types";

export function AgentActivityPanel({ activities = [] }: { activities?: AgentActivity[] }) {
  if (!activities.length) return null;
  const current = [...activities].reverse().find((item) => item.status === "RUNNING");
  const history = activities.filter((item) => item.status !== "RUNNING");

  return (
    <div
      data-testid="agent-activity-panel"
      className="mb-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
      {current && (
        <div
          role="status"
          aria-live="polite"
          data-testid="agent-activity-current"
          className="flex items-start gap-2 break-words"
        >
          <AiLoadingSpinner size={15} className="mt-0.5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{current.label}</p>
            {current.summary && <p className="mt-0.5 text-muted-foreground">{current.summary}</p>}
            {current.progress && (
              <p className="mt-0.5 text-micro text-muted-foreground/80">
                Tìm thấy {current.progress.found ?? 0} · Giữ lại {current.progress.accepted ?? 0}
              </p>
            )}
          </div>
        </div>
      )}
      {history.length > 0 && (
        <details className={current ? "mt-2 border-t border-border pt-2" : ""}>
          <summary
            data-testid="agent-activity-history-toggle"
            aria-label="Toggle activity history"
            className="flex cursor-pointer list-none items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {history.length} step{history.length === 1 ? "" : "s"} completed
          </summary>
          <ol className="mt-2 space-y-1.5" data-testid="agent-activity-history-list">
            {history.map((item) => (
              <li
                key={item.activityId}
                data-testid="agent-activity-item"
                className="flex items-start gap-2 break-words"
              >
                {item.status === "FAILED" ? (
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                ) : item.status === "SKIPPED" ? (
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{item.label}</p>
                  {item.summary && <p className="text-muted-foreground">{item.summary}</p>}
                  {item.progress && (
                    <p className="mt-0.5 text-micro text-muted-foreground/80">
                      Tìm thấy {item.progress.found ?? 0} · Giữ lại {item.progress.accepted ?? 0}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
