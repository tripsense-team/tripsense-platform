"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage, PlaceSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Shimmer } from "../ai-elements/shimmer";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { Weather } from "./weather";
import { PlaceCards } from "./place-cards";
import { ItineraryPreview } from "./itinerary-preview";
import { TripIntakeCard } from "./trip-intake-card";
import { Loader2, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/features/auth";

import {
  decorateItineraryMarkdown,
  richMarkdownComponents,
} from "./rich-itinerary-decorator";

function WaitingText({ text = "Đang suy nghĩ..." }: { text?: string }) {
  return (
    <div className="flex min-h-[calc(15px*1.6)] min-w-0 items-center text-[15px] leading-[1.6]">
      <Shimmer
        as="span"
        className="font-medium whitespace-normal break-words"
        duration={1}
      >
        {text}
      </Shimmer>
    </div>
  );
}

function ActiveAgentStatus({ message }: { message: ChatMessage }) {
  const activeToolPart = message.parts?.find((p: any) => {
    return (
      p.state === "call" ||
      p.state === "input-available" ||
      p.toolInvocation?.state === "call"
    );
  }) as any;

  let statusText = "Đang suy nghĩ và chuẩn bị nội dung...";
  if (activeToolPart) {
    const toolName =
      activeToolPart.type?.replace("tool-", "") ||
      activeToolPart.toolInvocation?.toolName;
    if (toolName === "createTripProposal") {
      const dest =
        activeToolPart.input?.destination ||
        activeToolPart.toolInvocation?.args?.destination;
      const days =
        activeToolPart.input?.durationDays ||
        activeToolPart.toolInvocation?.args?.durationDays;
      statusText = `Đang thiết kế lịch trình chi tiết và phân bổ từng ngày${dest ? ` cho ${dest}` : ""}${days ? ` (${days} ngày)` : ""}...`;
    } else if (toolName === "searchPlaces") {
      const q =
        activeToolPart.input?.query ||
        activeToolPart.toolInvocation?.args?.query;
      statusText = q
        ? `Đang tìm kiếm các địa điểm cho "${q}"...`
        : "Đang tìm kiếm các địa điểm nổi bật...";
    } else if (toolName === "updateTripPlanningBrief") {
      statusText = "Đang kiểm tra và cập nhật thông tin chuyến đi...";
    } else if (toolName === "getWeather") {
      const city =
        activeToolPart.input?.city ||
        activeToolPart.toolInvocation?.args?.city;
      statusText = city
        ? `Đang tra cứu dự báo thời tiết tại ${city}...`
        : "Đang tra cứu dự báo thời tiết...";
    }
  } else {
    const hasProposal = message.parts?.some(
      (p: any) =>
        p.type === "tool-createTripProposal" ||
        p.toolInvocation?.toolName === "createTripProposal"
    );
    const hasSearch = message.parts?.some(
      (p: any) =>
        p.type === "tool-searchPlaces" ||
        p.toolInvocation?.toolName === "searchPlaces"
    );
    if (hasProposal) {
      statusText =
        "Đang tối ưu hóa các chặng di chuyển và hoàn thiện lịch trình...";
    } else if (hasSearch) {
      statusText =
        "Đang tổng hợp các điểm đến và lên kế hoạch chi tiết...";
    } else {
      statusText = "Đang suy nghĩ và chuẩn bị câu trả lời...";
    }
  }

  return (
    <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl px-3.5 py-2 my-1.5 w-fit">
      <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
      <Shimmer
        as="span"
        duration={1.2}
        className="font-medium whitespace-normal break-words"
      >
        {statusText}
      </Shimmer>
    </div>
  );
}

export const PreviewMessage = ({
  chatId,
  message,
  isLoading,
  onEdit,
}: {
  chatId?: string;
  message: ChatMessage;
  isLoading?: boolean;
  setMessages?: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate?: UseChatHelpers<ChatMessage>["regenerate"];
  onEdit?: (message: ChatMessage) => void;
}) => {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      part.type.startsWith("tool-") ||
      part.type === "tool-invocation" ||
      (part as any).type === "data-tripBrief"
  );
  const isThinking = isAssistant && !hasAnyContent;

  const authUser = useAuthStore((state) => state.user);
  const displayAvatar = authUser?.avatar;
  const displayName = authUser?.name || authUser?.email || "User";
  const initials = authUser?.name
    ? authUser.name.slice(0, 2).toUpperCase()
    : authUser?.email
    ? authUser.email.slice(0, 2).toUpperCase()
    : "TS";

  // Hoist parts into groups so suggested places render at the very end
  const weatherParts: React.ReactNode[] = [];
  const textAndProposalParts: React.ReactNode[] = [];
  const intakeCardParts: React.ReactNode[] = [];
  const placeCardsParts: React.ReactNode[] = [];

  const suggestedPlaces: PlaceSearchResult[] = [];
  const seenPlaceIds = new Set<string>();
  let activeSearchQuery: string | undefined;
  let isSearchingPlaces = false;

  message.parts?.forEach((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "text") {
      const textContent = isAssistant
        ? decorateItineraryMarkdown(part.text)
        : part.text;

      textAndProposalParts.push(
        <MessageContent
          className={cn("text-[15px] leading-[1.6]", {
            "w-fit max-w-full overflow-hidden break-words rounded-2xl rounded-tr-xs border border-border/30 bg-gradient-to-br from-secondary to-muted px-4 py-2.5 shadow-[var(--shadow-card)]":
              isUser,
          })}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse
            components={isAssistant ? richMarkdownComponents : undefined}
          >
            {textContent}
          </MessageResponse>
        </MessageContent>
      );
      return;
    }

    // 1. Weather Tool
    if (
      type === "tool-getWeather" ||
      (type === "tool-invocation" &&
        (part as any).toolInvocation?.toolName === "getWeather")
    ) {
      const toolPart = part as any;
      const weatherData =
        toolPart.output || toolPart.result || toolPart.toolInvocation?.result;
      const city =
        toolPart.input?.city || toolPart.toolInvocation?.args?.city;
      const isCall =
        toolPart.state === "call" ||
        toolPart.state === "input-available" ||
        toolPart.toolInvocation?.state === "call";

      if (weatherData && !weatherData.error) {
        weatherParts.push(
          <div className="w-[min(100%,460px)] my-1.5" key={key}>
            <Weather weatherAtLocation={weatherData} />
          </div>
        );
      } else if (isCall && !isLoading) {
        weatherParts.push(
          <div
            key={key}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2 my-1.5 w-fit"
          >
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>
              Đang tra cứu dữ liệu thời tiết {city ? `cho ${city}...` : "..."}
            </span>
          </div>
        );
      }
      return;
    }

    // 2. Search Places Tool (Aggregated into a single unified carousel)
    if (
      type === "tool-searchPlaces" ||
      (type === "tool-invocation" &&
        (part as any).toolInvocation?.toolName === "searchPlaces")
    ) {
      const toolPart = part as any;
      const placeData =
        toolPart.output || toolPart.result || toolPart.toolInvocation?.result;
      const query =
        toolPart.input?.query || toolPart.toolInvocation?.args?.query;
      const isCall =
        toolPart.state === "call" ||
        toolPart.state === "input-available" ||
        toolPart.toolInvocation?.state === "call";

      if (isCall) {
        isSearchingPlaces = true;
        if (query) activeSearchQuery = query;
      }

      if (placeData && Array.isArray(placeData.places)) {
        for (const place of placeData.places) {
          if (place && place.id && !seenPlaceIds.has(place.id)) {
            seenPlaceIds.add(place.id);
            suggestedPlaces.push(place);
          }
        }
      }
      return;
    }

    // 3. Create Trip Proposal Tool
    if (
      type === "tool-createTripProposal" ||
      (type === "tool-invocation" &&
        (part as any).toolInvocation?.toolName === "createTripProposal")
    ) {
      const toolPart = part as any;
      const proposal =
        toolPart.output || toolPart.result || toolPart.toolInvocation?.result;
      const destination =
        toolPart.input?.destination ||
        toolPart.toolInvocation?.args?.destination;
      const durationDays =
        toolPart.input?.durationDays ||
        toolPart.toolInvocation?.args?.durationDays;
      const isCall =
        toolPart.state === "call" ||
        toolPart.state === "input-available" ||
        toolPart.toolInvocation?.state === "call";

      if (proposal && proposal.proposalId) {
        textAndProposalParts.push(
          <div className="w-full my-1.5" key={key}>
            <ItineraryPreview
              proposal={proposal}
              chatId={chatId}
              variant="chat"
            />
          </div>
        );
      } else if (isCall && !isLoading) {
        textAndProposalParts.push(
          <div
            key={key}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2 my-1.5 w-fit"
          >
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>
              Đang thiết kế kế hoạch lịch trình{" "}
              {destination ? `cho ${destination}` : ""}
              {durationDays ? ` (${durationDays} ngày)...` : "..."}
            </span>
          </div>
        );
      }
      return;
    }

    // 4. Update Trip Planning Brief Tool or data-tripBrief
    if (
      type === "tool-updateTripPlanningBrief" ||
      (type === "tool-invocation" &&
        (part as any).toolInvocation?.toolName === "updateTripPlanningBrief") ||
      (type as any) === "data-tripBrief"
    ) {
      const toolPart = part as any;
      const state =
        toolPart.output?.state ||
        toolPart.result?.state ||
        toolPart.toolInvocation?.result?.state ||
        ((type as any) === "data-tripBrief" ? toolPart : undefined);

      if (state) {
        intakeCardParts.push(
          <div className="w-full my-2" key={key}>
            <TripIntakeCard
              chatId={chatId}
              initialState={state}
              isLatestMessage={!isLoading}
            />
          </div>
        );
      }
      return;
    }
  });

  // Render single deduplicated carousel of suggested places (if any)
  if (suggestedPlaces.length > 0) {
    placeCardsParts.push(
      <div className="w-full my-2" key={`places-${message.id}`}>
        <PlaceCards
          places={suggestedPlaces}
          total={suggestedPlaces.length}
        />
      </div>
    );
  } else if (isSearchingPlaces && !isLoading) {
    placeCardsParts.push(
      <div
        key={`places-loading-${message.id}`}
        className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2 my-1.5 w-fit"
      >
        <Loader2 className="size-3.5 animate-spin text-primary" />
        <span>
          Đang tìm kiếm địa điểm {activeSearchQuery ? `cho "${activeSearchQuery}"...` : "..."}
        </span>
      </div>
    );
  }

  const actions = (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
    />
  );

  const content = isThinking ? (
    <WaitingText />
  ) : (
    <>
      {weatherParts}
      {textAndProposalParts}
      {intakeCardParts}
      {isLoading && isAssistant && <ActiveAgentStatus message={message} />}
      {placeCardsParts}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser
            ? "flex items-start justify-end gap-3 w-full"
            : "flex items-start gap-3 w-full"
        )}
      >
        {isAssistant && (
          <div className="flex h-8 shrink-0 items-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-border/50 shadow-2xs">
              <SparklesIcon size={15} />
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex min-w-0 flex-col gap-2",
            isAssistant ? "flex-1" : "items-end max-w-[min(85%,60ch)]"
          )}
        >
          {content}
        </div>

        {isUser && (
          <div className="flex h-8 shrink-0 items-center">
            <Avatar className="size-8 rounded-full border border-border/60 shadow-2xs overflow-hidden shrink-0">
              <AvatarImage
                src={displayAvatar}
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs rounded-full">
                {initials || <UserIcon className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  );
};

export const ThinkingMessage = () => (
  <div
    className="group/message w-full"
    data-role="assistant"
    data-testid="message-assistant-loading"
  >
    <div className="flex items-start gap-3 w-full">
      <div className="flex h-8 shrink-0 items-center">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-border/50 shadow-2xs">
          <SparklesIcon size={15} />
        </div>
      </div>

      <WaitingText />
    </div>
  </div>
);
