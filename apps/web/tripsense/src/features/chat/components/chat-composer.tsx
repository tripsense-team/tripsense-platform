"use client";

import * as React from "react";
import { Send, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onShareTrip?: () => void;
  disabled?: boolean;
  disabledPlaceholder?: string;
  className?: string;
}

const MAX_CHAR_COUNT = 2000;
const CHAR_WARNING_THRESHOLD = 1800;

export function ChatComposer({
  onSendMessage,
  onShareTrip,
  disabled = false,
  disabledPlaceholder,
  className,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${Math.max(nextHeight, 38)}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    adjustHeight();
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_CHAR_COUNT || disabled) return;
    onSendMessage(trimmed);
    setText("");

    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "38px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charLength = text.length;
  const isOverLimit = charLength > MAX_CHAR_COUNT;
  const showCounter = charLength >= CHAR_WARNING_THRESHOLD;

  return (
    <div
      className={cn(
        "px-3 py-2 sm:px-4 sm:py-2.5 border-t border-border/50 bg-card/95 backdrop-blur-xs sticky bottom-0 z-10",
        className
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="max-w-4xl mx-auto w-full flex flex-col gap-1"
      >
        <div className="flex items-center gap-2.5 bg-muted/40 border border-border/70 focus-within:border-primary/60 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl px-3.5 py-2 transition-all">
          {onShareTrip && <Button type="button" variant="ghost" size="icon" disabled={disabled}
            onClick={onShareTrip} aria-label={t("chat.sharedTrip.shareAction")} title={t("chat.sharedTrip.shareAction")}
            className="h-10 w-10 shrink-0 rounded-full"><MapPinned className="h-5 w-5" /></Button>}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            title={t("chat.composer.keyboardHelp")}
            placeholder={
              disabled
                ? (disabledPlaceholder || t("chat.composer.requestLockedPlaceholder"))
                : t("chat.composer.placeholder")
            }
            aria-label={t("chat.composer.placeholder")}
            className="flex-1 bg-transparent px-2.5 py-2 text-[15px] sm:text-base font-normal text-foreground placeholder:text-muted-foreground resize-none focus:outline-hidden min-h-[44px] max-h-[140px] leading-relaxed disabled:cursor-not-allowed disabled:opacity-60"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || isOverLimit || disabled}
            aria-label={t("chat.composer.sendTooltip")}
            className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shadow-xs active:scale-95"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Character Counter: shown ONLY after 1800 characters per requirement */}
        {showCounter && (
          <div className="flex justify-end px-1 text-micro select-none">
            <span
              className={cn(
                "font-mono text-micro",
                isOverLimit ? "text-destructive font-bold" : "text-muted-foreground font-medium"
              )}
            >
              {t("chat.composer.charCount", {
                current: charLength,
                max: MAX_CHAR_COUNT,
              })}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
