"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, History, LoaderCircle, Plus, Sparkles, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/features/chat";
import {
  aiApi,
  ArtifactRenderer,
  AgentActivityPanel,
  streamRun,
  TripCreationHandoffModal,
  type AiArtifact,
  type AgentActivity,
  type AiConversation,
  type AiMessage,
  type AiStreamEvent,
} from "@/features/ai-chat";
import { RichItineraryWorkspace } from "@/features/ai-chat/rich-itinerary-workspace";
import { RichAnswer } from "@/features/ai-chat/rich-answer";
import type { AiItineraryPreview } from "@/features/ai-chat/types";
import { upsertArtifact } from "@/features/ai-chat/upsert-artifact";
import { upsertAgentActivity } from "@/features/ai-chat/agent-activity";
import { listTrips } from "@/features/trip-management/services/trip-management-api";
import type { TripResponse } from "@/features/trip-management/types";
import { PlaceDetailModal } from "@/features/places/components/place-detail-modal";
import { getPlaceDetails } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";

export default function AiPlannerPage() {
  const router = useRouter();
  const [conversations, setConversations] = React.useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = React.useState<string>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [activeRunId, setActiveRunId] = React.useState<string>();
  const [runStatus, setRunStatus] = React.useState<string>();
  const [agentActivity, setAgentActivity] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [trips, setTrips] = React.useState<TripResponse[]>([]);
  const [selectedTripId, setSelectedTripId] = React.useState("");
  const [isHandoffModalOpen, setIsHandoffModalOpen] = React.useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [detailPlace, setDetailPlace] = React.useState<Place | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const controller = React.useRef<AbortController | null>(null);
  const lastSequenceByRun = React.useRef<Record<string, number>>({});
  const sawActivityByRun = React.useRef<Record<string, boolean>>({});

  const handleOpenDetails = React.useCallback(async (place: Place) => {
    setDetailPlace(place);
    setIsDetailOpen(true);
    setIsLoadingDetails(true);

    try {
      const lookupId = place.providerPlaceId || place.id;
      const res = await getPlaceDetails(
        lookupId,
        place.name,
        place.location?.lat,
        place.location?.lng,
        undefined,
        true
      );
      if (res?.success && res.data) {
        setDetailPlace((curr) => {
          if (!curr || (curr.id !== place.id && curr.providerPlaceId !== place.id)) return curr;
          return {
            ...curr,
            ...res.data,
            primaryPhoto: res.data.primaryPhoto || curr.primaryPhoto,
            photoGallery: res.data.photoGallery || curr.photoGallery,
          };
        });
      }
    } catch (err) {
      console.warn("Could not enrich details for modal:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const loadConversation = React.useCallback(async (id: string) => {
    controller.current?.abort();
    const result = await aiApi.listMessages(id);
    setConversationId(id); setMessages(result.items); setError(undefined); setActiveRunId(result.activeRunId);
    setAgentActivity(undefined);
    if (result.activeRunId) {
      const restoredRunId = result.activeRunId;
      const streamId = `stream-${restoredRunId}`;
      setMessages((items) => [...items, { id: streamId, role: "assistant", content: "" }]);
      controller.current = new AbortController();
      try {
        const lastSequence = await streamRun(`/api/ai/v1/runs/${restoredRunId}/stream`, (event) => {
          if (event.type.startsWith("run.")) setRunStatus(event.type.slice(4).toUpperCase());
          if (event.type === "agent.activity") {
            sawActivityByRun.current[restoredRunId] = true;
            const activity = event.payload as unknown as AgentActivity;
            setAgentActivity(activity.status === "RUNNING" ? activity.label : undefined);
            setMessages((items) => items.map((item) => item.id === streamId ? { ...item, activities: upsertAgentActivity(item.activities, activity) } : item));
          }
          if (event.type === "agent.status" && !sawActivityByRun.current[restoredRunId]) setAgentActivity(String(event.payload.displayText || ""));
          if (event.type === "assistant.delta") {
            const delta = String(event.payload.textDelta || "");
            setMessages((items) => items.map((item) => item.id === streamId ? { ...item, content: item.content + delta } : item));
          }
          if (event.type === "artifact.upsert") {
            const artifact = event.payload as unknown as AiArtifact;
            setMessages((items) => items.map((item) => item.id === streamId ? { ...item, artifacts: upsertArtifact(item.artifacts, artifact) } : item));
          }
        }, controller.current.signal, lastSequenceByRun.current[restoredRunId] || 0);
        lastSequenceByRun.current[restoredRunId] = lastSequence;
        const restored = await aiApi.listMessages(id); setMessages(restored.items); setActiveRunId(undefined); setRunStatus(undefined); setAgentActivity(undefined);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError("Could not reconnect to the active AI response.");
      }
    }
  }, []);

  React.useEffect(() => {
    aiApi.listConversations().then(({ items }) => {
      setConversations(items); if (items[0]) void loadConversation(items[0].id);
    }).catch(() => setError("Could not restore your AI conversations."));
    return () => controller.current?.abort();
  }, [loadConversation]);

  React.useEffect(() => {
    listTrips({ size: 50 }).then((result) => setTrips(result.content)).catch(() => setTrips([]));
  }, []);

  const preview = React.useMemo(() => {
    for (const message of [...messages].reverse()) {
      const artifact = [...(message.artifacts || [])].reverse().find((item) => item.type === "ITINERARY_PREVIEW");
      if (artifact) return artifact.data as AiItineraryPreview;
    }
    return undefined;
  }, [messages]);

  const latestPlaces: Place[] = (() => {
    for (const message of [...messages].reverse()) {
      const artifact = [...(message.artifacts || [])].reverse().find((item) => item.type === "PLACE_LIST" || item.type === "PLACE_CARD");
      if (artifact) {
        if (Array.isArray((artifact.data as { places?: Place[] })?.places)) {
          return (artifact.data as { places: Place[] }).places;
        }
        if ((artifact.data as { place?: Place })?.place) {
          return [(artifact.data as { place: Place }).place];
        }
      }
    }
    return [];
  })();

  const activeSelectedPlaceId = selectedPlaceId || null;

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const created = await aiApi.createConversation("New AI chat");
    setConversations((items) => [created, ...items]); setConversationId(created.id); return created.id;
  }

  async function handleSend(content: string) {
    setError(undefined);
    setAgentActivity(undefined);
    try {
      const id = await ensureConversation();
      const clientId = crypto.randomUUID();
      const streamId = `stream-${clientId}`;
      setMessages((items) => [...items, { id: clientId, role: "user", content }, { id: streamId, role: "assistant", content: "" }]);
      const accepted = await aiApi.sendMessage(id, content, clientId, selectedTripId || undefined);
      setActiveRunId(accepted.runId); setRunStatus(accepted.status); controller.current = new AbortController();
      const lastSequence = await streamRun(accepted.streamUrl, (event: AiStreamEvent) => {
        if (event.type.startsWith("run.")) setRunStatus(event.type.slice(4).toUpperCase());
        if (event.type === "agent.activity") {
          sawActivityByRun.current[accepted.runId] = true;
          const activity = event.payload as unknown as AgentActivity;
          setAgentActivity(activity.status === "RUNNING" ? activity.label : undefined);
          setMessages((items) => items.map((item) => item.id === streamId ? { ...item, activities: upsertAgentActivity(item.activities, activity) } : item));
        }
        if (event.type === "agent.status" && !sawActivityByRun.current[accepted.runId]) setAgentActivity(String(event.payload.displayText || ""));
        if (event.type === "assistant.delta") {
          const delta = String(event.payload.textDelta || "");
          setMessages((items) => items.map((item) => item.id === streamId ? { ...item, content: item.content + delta } : item));
        }
        if (event.type === "artifact.upsert") {
          const artifact = event.payload as unknown as AiArtifact;
          setMessages((items) => items.map((item) => item.id === streamId ? { ...item, artifacts: upsertArtifact(item.artifacts, artifact) } : item));
        }
        if (event.type === "run.failed") setError((event.payload.error as { message?: string })?.message || "AI run failed.");
      }, controller.current.signal, lastSequenceByRun.current[accepted.runId] || 0);
      lastSequenceByRun.current[accepted.runId] = lastSequence;
      setMessages((await aiApi.listMessages(id)).items); setActiveRunId(undefined); setRunStatus(undefined); setAgentActivity(undefined);
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setError((cause as Error).message || "AI request failed.");
      setActiveRunId(undefined);
      setAgentActivity(undefined);
    }
  }

  async function cancel() {
    if (!activeRunId) return; await aiApi.cancelRun(activeRunId); controller.current?.abort(); setRunStatus("CANCEL_REQUESTED");
  }

  async function confirmProposal(id: string) {
    setError(undefined);
    try {
      const result = await aiApi.confirmProposal(id);
      if (result.businessState === "APPLIED" && result.targetTripId) router.push(`/trips/${result.targetTripId}`);
      else if (conversationId) setMessages((await aiApi.listMessages(conversationId)).items);
    }
    catch (cause) { setError((cause as Error).message || "Could not apply the proposal."); }
  }

  async function rejectProposal(id: string) {
    setError(undefined);
    try { await aiApi.rejectProposal(id); if (conversationId) setMessages((await aiApi.listMessages(conversationId)).items); }
    catch (cause) { setError((cause as Error).message || "Could not reject the proposal."); }
  }

  function sendFeedback(artifactId: string, candidateId: string, action: "SAVE" | "REJECT" | "MORE_LIKE_THIS") {
    void aiApi.sendFeedback(artifactId, candidateId, action).catch((cause) => setError((cause as Error).message || "Could not save feedback."));
  }

  function newConversation() {
    controller.current?.abort(); setConversationId(undefined); setMessages([]); setActiveRunId(undefined); setError(undefined);
  }

  return <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-[1600px] gap-4 p-4 sm:p-6 lg:h-[calc(100vh-7rem)]">
    <aside className="hidden w-64 shrink-0 rounded-2xl border border-border bg-card p-3 md:block">
      <Button onClick={newConversation} variant="outline" className="mb-3 w-full justify-start gap-2"><Plus className="h-4 w-4" />New chat</Button>
      <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground"><History className="h-3.5 w-3.5" />Previous conversations</div>
      <div className="space-y-1">{conversations.map((item) => <button key={item.id} onClick={() => void loadConversation(item.id)}
        className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${conversationId === item.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
        {item.title || "AI conversation"}</button>)}</div>
    </aside>
    <main className="grid min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
      <section className="flex min-h-[38rem] min-w-0 flex-col gap-2 lg:min-h-0">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" />Real AI chat · grounded by TripSense data</span>
        {activeRunId && <Button size="sm" variant="outline" onClick={() => void cancel()} className="gap-1"><StopCircle className="h-3.5 w-3.5" />Cancel</Button>}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
        <label htmlFor="ai-trip-select" className="shrink-0 text-muted-foreground">Chuyến đi:</label>
        <select id="ai-trip-select" value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <option value="">Chưa chọn · xem trước thôi</option>
          {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name} · {trip.destinationName}</option>)}
        </select>
        {preview && (preview.days || []).length > 0 ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsHandoffModalOpen(true)}
            className="shrink-0 h-7 text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tạo chuyến đi từ gợi ý
          </Button>
        ) : (
          <Link href="/trips/new" className="shrink-0 text-primary underline-offset-2 hover:underline">Tạo chuyến đi</Link>
        )}
      </div>

      {runStatus && <div role="status" aria-live="polite" className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{agentActivity || runStatus}</div>}
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      <ChatPanel messages={messages.map((message, msgIndex) => {
        const answerPreview = message.artifacts?.find((artifact) => artifact.type === "ITINERARY_PREVIEW")?.data as AiItineraryPreview | undefined;
        const answerPlaceList = (message.artifacts?.find((artifact) => artifact.type === "PLACE_LIST")?.data as { places?: Place[] } | undefined)?.places;
        const answerPlaces = (answerPreview?.days?.flatMap((day) => day.items) || []).length > 0
          ? (answerPreview?.days?.flatMap((day) => day.items) || [])
          : (answerPlaceList || []).map((p) => ({
              canonicalPlaceId: p.id,
              title: p.name,
              address: p.address,
              location: p.location,
              primaryPhoto: p.primaryPhoto,
              ratingSummary: p.rating != null ? { value: p.rating, count: p.userRatingCount, source: p.provider || "place-service" } : undefined,
            }));
        return {
          ...message,
          id: message.id ? `ai-msg-${message.id}` : `ai-msg-idx-${msgIndex}`,
          contentNode: message.role === "assistant" ? <RichAnswer content={message.content} places={answerPlaces} onSelectPlace={setSelectedPlaceId} /> : undefined,
          richContent: (
            <>
              <AgentActivityPanel activities={message.activities} />
              <ArtifactRenderer
                artifacts={message.artifacts}
                onFeedback={sendFeedback}
                onConfirm={(id) => void confirmProposal(id)}
                onReject={(id) => void rejectProposal(id)}
                onSelectPlace={setSelectedPlaceId}
                selectedPlaceId={activeSelectedPlaceId}
                onViewDetails={handleOpenDetails}
                onCreateTripFromPlan={() => setIsHandoffModalOpen(true)}
              />
            </>
          ),
        };
      })}
        onSendMessage={(value) => void handleSend(value)} isLoading={Boolean(activeRunId)} className="min-h-0 flex-1" />
      </section>
      <div className="flex flex-col min-h-[34rem] h-full lg:min-h-0">
        <RichItineraryWorkspace
          preview={preview}
          places={latestPlaces}
          selectedPlaceId={activeSelectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          onViewDetails={handleOpenDetails}
          onCreateTripFromPlan={() => setIsHandoffModalOpen(true)}
        />
      </div>
    </main>

    <PlaceDetailModal
      place={detailPlace}
      isOpen={isDetailOpen}
      isLoadingDetails={isLoadingDetails}
      onClose={() => {
        setIsDetailOpen(false);
        setIsLoadingDetails(false);
      }}
    />

    <TripCreationHandoffModal
      isOpen={isHandoffModalOpen}
      onClose={() => setIsHandoffModalOpen(false)}
      preview={preview}
      existingTrips={trips}
      selectedTripId={selectedTripId}
      onSuccess={(newTripId) => {
        setIsHandoffModalOpen(false);
        router.push(`/trips/${newTripId}`);
      }}
    />
  </div>;
}
