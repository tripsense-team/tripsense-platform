"use client";

import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { memo } from "react";
import { Streamdown } from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex min-w-0 max-w-full flex-col gap-2 overflow-hidden text-[15px] text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export type MessageResponseProps = ComponentProps<typeof Streamdown> & {
  isAnimating?: boolean;
};

const STREAMING_ANIMATE_OPTIONS: ComponentProps<typeof Streamdown>["animated"] = {
  animation: "fadeIn",
  sep: "word",
  duration: 150,
  stagger: 12,
  maxBacklogMs: 280,
};

export const MessageResponse = memo(
  ({
    className,
    isAnimating = false,
    mode,
    animated,
    ...props
  }: MessageResponseProps) => {
    const resolvedMode = mode ?? (isAnimating ? "streaming" : "static");
    const resolvedAnimated =
      animated ?? (isAnimating ? STREAMING_ANIMATE_OPTIONS : false);

    return (
      <Streamdown
        animated={resolvedAnimated}
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose dark:prose-invert max-w-none text-[15px] leading-relaxed prose-p:text-[15px] prose-li:text-[15px]",
          className
        )}
        isAnimating={isAnimating}
        mode={resolvedMode}
        {...props}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.mode === nextProps.mode &&
    prevProps.animated === nextProps.animated &&
    prevProps.className === nextProps.className &&
    prevProps.components === nextProps.components
);

MessageResponse.displayName = "MessageResponse";
