"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  ChevronDown,
  Plus,
  Square,
  ArrowUp,
  Sparkles,
  Check,
  Mic,
  AudioLines,
  Info,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { chatModels } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";

type MultimodalInputProps = {
  chatId?: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  messages: ChatMessage[];
  sendMessage: (message: { parts: { text: string; type: "text" }[]; role: "user" }) => void;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  onRequireAuth?: () => void;
  className?: string;
};

export function MultimodalInput({
  input,
  setInput,
  status,
  stop,
  sendMessage,
  selectedModelId,
  onModelChange,
  onRequireAuth,
  className,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { locale } = useTranslation();

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || status === "streaming" || status === "submitted") {
      return;
    }

    if (!isAuthenticated) {
      toast.error(
        locale === "vi"
          ? "Vui lòng đăng nhập để sử dụng AI Planner."
          : "Please sign in to use AI Planner."
      );
      onRequireAuth?.();
      return;
    }

    sendMessage({
      parts: [{ text: trimmed, type: "text" }],
      role: "user",
    });
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, status, sendMessage, setInput, isAuthenticated, locale, onRequireAuth]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isStreaming = status === "streaming" || status === "submitted";
  const currentModel =
    chatModels.find((m) => m.id === selectedModelId) || chatModels[0];

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div className="relative flex flex-col w-full rounded-3xl border border-border/80 bg-background shadow-xs hover:border-border focus-within:border-border/90 focus-within:shadow-sm transition-all duration-200 p-3 sm:p-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mindtrip"
          rows={1}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm md:text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[44px] max-h-48 overflow-y-auto"
        />

        <div className="flex items-center justify-between pt-2 mt-1">
          {/* Left: Plus attachment / Model selector */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full bg-muted/60 hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Đính kèm nội dung"
            >
              <Plus className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1 rounded-full border border-border/40 transition-colors flex items-center cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary" />
                  <span className="truncate max-w-[100px] sm:max-w-none">
                    {currentModel.name}
                  </span>
                  <ChevronDown className="size-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-1.5">
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  Google Gemini Models
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {chatModels.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                    className="flex items-start justify-between gap-2 p-2 rounded-lg cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-foreground">
                          {model.name}
                        </span>
                        {model.badge && (
                          <Badge
                            variant="outline"
                            className="text-micro py-0 px-1 border-primary/30 text-primary bg-primary/5"
                          >
                            {model.badge}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {model.description}
                      </span>
                    </div>
                    {selectedModelId === model.id && (
                      <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: Mic & Audio Waveform / Send Button matching Mindtrip screenshot */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="size-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Nhập bằng giọng nói"
            >
              <Mic className="size-4" />
            </button>

            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                onClick={stop}
                className="size-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs cursor-pointer"
                title="Dừng sinh phản hồi"
              >
                <Square className="size-3 fill-current" />
              </Button>
            ) : input.trim() ? (
              <Button
                type="button"
                size="icon"
                onClick={handleSubmit}
                className="size-8 rounded-full bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all shadow-xs cursor-pointer"
                title="Gửi tin nhắn (Enter)"
              >
                <ArrowUp className="size-4" />
              </Button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="size-8 rounded-full bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 flex items-center justify-center shadow-xs transition-transform hover:scale-105 cursor-pointer"
                title="Voice / Waveform mode"
              >
                <AudioLines className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer text matching Mindtrip screenshot */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60 select-none py-0.5">
        <Info className="size-3 shrink-0" />
        <span>Mindtrip can make mistakes. Check important info.</span>
      </div>
    </div>
  );
}
