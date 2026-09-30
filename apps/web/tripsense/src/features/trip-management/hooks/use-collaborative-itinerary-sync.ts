"use client";

import * as React from "react";
import { streamCollaborationEvents } from "../services/collaboration-events";
import type { CollaborationChangeEvent } from "../types";

export type CollaborationConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting";

interface CollaborativeItinerarySyncOptions {
  tripId: string | null;
  revision: number;
  onRefresh: () => Promise<number | void>;
  onMemberChange?: () => void;
}

const MEMBER_EVENT_TYPES = new Set([
  "MEMBER_JOINED",
  "MEMBER_LEFT",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
]);

export function useCollaborativeItinerarySync({
  tripId,
  revision,
  onRefresh,
  onMemberChange,
}: CollaborativeItinerarySyncOptions): CollaborationConnectionState {
  const [state, setState] = React.useState<CollaborationConnectionState>("connecting");
  const revisionRef = React.useRef(revision);
  const refreshRef = React.useRef(onRefresh);
  const memberChangeRef = React.useRef(onMemberChange);

  React.useEffect(() => {
    revisionRef.current = Math.max(revisionRef.current, revision);
  }, [revision]);
  React.useEffect(() => {
    refreshRef.current = onRefresh;
    memberChangeRef.current = onMemberChange;
  }, [onRefresh, onMemberChange]);

  React.useEffect(() => {
    if (!tripId) return;
    const controller = new AbortController();
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshQueue = Promise.resolve();

    async function refresh(event?: CollaborationChangeEvent) {
      if (event && event.revision <= revisionRef.current) return;
      try {
        const refreshedRevision = await refreshRef.current();
        if (event) revisionRef.current = Math.max(revisionRef.current, event.revision);
        if (typeof refreshedRevision === "number") {
          revisionRef.current = Math.max(revisionRef.current, refreshedRevision);
        }
        if (event && MEMBER_EVENT_TYPES.has(event.type)) memberChangeRef.current?.();
      } catch {
        setState("reconnecting");
      }
    }

    function enqueueRefresh(event?: CollaborationChangeEvent) {
      refreshQueue = refreshQueue.then(() => refresh(event));
      return refreshQueue;
    }

    async function connect() {
      if (controller.signal.aborted) return;
      setState(retryAttempt === 0 ? "connecting" : "reconnecting");
      try {
        await streamCollaborationEvents(
          tripId!,
          revisionRef.current,
          {
            onConnected: (connectedRevision) => {
              revisionRef.current = Math.max(revisionRef.current, connectedRevision);
              retryAttempt = 0;
              setState("connected");
            },
            onEvent: (event) => void enqueueRefresh(event),
            onResyncRequired: () => enqueueRefresh(),
          },
          controller.signal,
        );
      } catch {
        // Connection errors are represented by the localized reconnecting UI.
      }
      if (controller.signal.aborted) return;
      retryAttempt += 1;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryAttempt - 1, 5));
      retryTimer = setTimeout(() => void connect(), delay + Math.random() * 300);
    }

    void connect();
    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [tripId]);

  return state;
}
