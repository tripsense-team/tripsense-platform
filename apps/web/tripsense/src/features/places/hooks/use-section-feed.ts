"use client";

import * as React from "react";
import { getExploreSections, type DiscoverySection, type SectionFeed } from "../services/recommendations-api";

/** Per-mounted-session, bounded cache. No Context, history or response goes into localStorage. */
export function useSectionFeed(userId: string | null, destinationId: string, sessionId: string) {
  const scope = `${userId ?? "guest"}:${destinationId}`;
  const scopeRef = React.useRef(scope);
  const cache = React.useRef(new Map<string, SectionFeed>());
  const controller = React.useRef<AbortController | null>(null);
  const generation = React.useRef(0);
  const [state, setState] = React.useState<{ scope: string; response: SectionFeed | null; error: boolean; loading: boolean }>({ scope, response: null, error: false, loading: false });

  const cancel = React.useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  // Invalidate before paint; render only state belonging to the current identity/destination.
  React.useLayoutEffect(() => {
    scopeRef.current = scope;
    cache.current.clear();
    cancel();
  }, [scope, cancel]);
  React.useEffect(() => cancel, [cancel]);

  const load = React.useCallback(async (section: DiscoverySection | null, refresh = false) => {
    cancel();
    const capturedScope = scope;
    const key = section ?? "preview";
    const saved = cache.current.get(key);
    if (!refresh && saved && Date.parse(saved.expiresAt) > Date.now()) {
      setState({ scope: capturedScope, response: saved, error: false, loading: false });
      return saved;
    }
    const request = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setState({ scope: capturedScope, response: null, error: false, loading: true });
    const preview = cache.current.get("preview");
    const seedId = preview && Date.parse(preview.expiresAt) > Date.now()
      ? preview.seedId
      : [...cache.current.values()].find((r) => Date.parse(r.expiresAt) > Date.now())?.seedId;
    try {
      const next = await getExploreSections({ destinationId, sessionId, section, seedId, signal: abort.signal });
      if (request !== generation.current || scopeRef.current !== capturedScope || abort.signal.aborted) return null;
      // Partial errors are not a complete cache hit: retry must be able to recover them.
      if (!next.stale && next.sections.every((s) => s.status !== "ERROR" && s.degradations.length === 0)) {
        if (cache.current.size >= 6) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, next);
      }
      setState({ scope: capturedScope, response: next, error: false, loading: false });
      return next;
    } catch {
      if (request === generation.current && scopeRef.current === capturedScope && !abort.signal.aborted) setState({ scope: capturedScope, response: null, error: true, loading: false });
      return null;
    } finally {
      if (request === generation.current && scopeRef.current === capturedScope) setState((current) => ({ ...current, loading: false }));
    }
  }, [cancel, destinationId, sessionId, scope]);

  return { response: state.scope === scope ? state.response : null, error: state.scope === scope && state.error, loading: state.scope === scope && state.loading, load, cancel };
}
