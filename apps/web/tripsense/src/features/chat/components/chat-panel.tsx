import { Sparkles, Bot } from "lucide-react";
import { ChatMessage, type ChatMessageProps } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatSuggestionChips } from "./chat-suggestion-chips";
import { cn } from "@/lib/utils";

export interface ChatPanelProps {
  messages?: ChatMessageProps[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  title?: string;
  className?: string;
}

export function ChatPanel({
  messages = [],
  onSendMessage,
  isLoading = false,
  title = "TripSense AI Assistant",
  className,
}: ChatPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-2.5 p-4 border-b border-border bg-card/80 backdrop-blur">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">Ask anything about trips & places</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 my-auto">
            <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-base text-foreground mb-1">
              Where would you like to go?
            </h4>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Ask me to build itineraries, discover restaurants, or give travel tips.
            </p>
            <ChatSuggestionChips onSelect={onSendMessage} />
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage key={msg.id || index} {...msg} />
          ))
        )}
      </div>

      <div className="p-4 border-t border-border bg-card">
        <ChatInput onSend={onSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
