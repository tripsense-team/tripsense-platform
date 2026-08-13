import { Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface ChatMessageProps {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  richContent?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  richContent,
  actions,
  className,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 text-sm my-4 max-w-full",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      <Avatar className={cn("h-8 w-8 shrink-0 mt-0.5", isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground border border-border")}>
        <AvatarFallback className="text-xs">
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-primary" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-2xs leading-relaxed text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-xs"
              : "bg-card border border-border text-card-foreground rounded-tl-xs"
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {richContent && <div className="w-full mt-1">{richContent}</div>}

        {actions && <div className="flex items-center gap-2 mt-1">{actions}</div>}

        {timestamp && (
          <span className="text-[10px] text-muted-foreground px-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
}
