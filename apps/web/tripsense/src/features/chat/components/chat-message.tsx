import { Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AiLoadingSpinner } from "@/components/shared";

export interface ChatMessageProps {
  id?: string;
  role: "user" | "assistant";
  content: string;
  contentNode?: React.ReactNode;
  timestamp?: string;
  richContent?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export function ChatMessage({
  role,
  content,
  contentNode,
  timestamp,
  richContent,
  actions,
  className,
  isLoading = false,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 text-sm my-4 max-w-full",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      <Avatar
        className={cn(
          "h-8 w-8 shrink-0 mt-0.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground border border-border",
        )}
      >
        <AvatarFallback className="text-xs">
          {isUser ? (
            <User className="h-4 w-4" />
          ) : isLoading ? (
            <AiLoadingSpinner size={18} className="text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex min-w-0 flex-col gap-2", isUser ? "max-w-[85%] items-end sm:max-w-[75%]" : "w-full max-w-full")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-2xs leading-relaxed text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-xs"
              : "bg-card border border-border text-card-foreground rounded-tl-xs",
          )}
        >
          {contentNode ?? (
            content ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : isLoading ? (
              <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                <AiLoadingSpinner size={16} className="text-primary" />
                <span className="animate-pulse">Đang chuẩn bị câu trả lời...</span>
              </div>
            ) : null
          )}
        </div>

        {richContent && <div className="w-full mt-1">{richContent}</div>}

        {actions && (
          <div className="flex items-center gap-2 mt-1">{actions}</div>
        )}

        {timestamp && (
          <span className="text-micro text-muted-foreground px-1">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
