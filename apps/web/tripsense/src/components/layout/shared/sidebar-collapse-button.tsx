import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SidebarCollapseButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
  collapseTitle?: string;
  expandTitle?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export function SidebarCollapseIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="2.5"
        width="18"
        height="19"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <line
        x1="9"
        y1="2.5"
        x2="9"
        y2="21.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <line
        x1="5.25"
        y1="7.5"
        x2="6.75"
        y2="7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5.25"
        y1="12"
        x2="6.75"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5.25"
        y1="16.5"
        x2="6.75"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polygon points="16.5,8.5 12.5,12 16.5,15.5" fill="currentColor" />
    </svg>
  );
}

export function SidebarExpandIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="2.5"
        width="18"
        height="19"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <line
        x1="9"
        y1="2.5"
        x2="9"
        y2="21.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <line
        x1="5.25"
        y1="7.5"
        x2="6.75"
        y2="7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5.25"
        y1="12"
        x2="6.75"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5.25"
        y1="16.5"
        x2="6.75"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polygon points="12.5,8.5 16.5,12 12.5,15.5" fill="currentColor" />
    </svg>
  );
}

export const SidebarCollapseButton = React.forwardRef<
  HTMLButtonElement,
  SidebarCollapseButtonProps
>(
  (
    {
      collapsed,
      onToggleCollapse,
      className,
      collapseTitle = "Collapse Sidebar",
      expandTitle = "Expand Sidebar",
      tooltipSide = "right",
      ...props
    },
    ref,
  ) => {
    const title = collapsed ? expandTitle : collapseTitle;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            onClick={onToggleCollapse}
            title={title}
            aria-label={title}
            className={cn(
              "h-10 w-10 rounded-full bg-neutral-100 hover:bg-neutral-200/90 text-foreground inline-flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-95 dark:bg-neutral-800 dark:hover:bg-neutral-700",
              className,
            )}
            {...props}
          >
            {collapsed ? (
              <SidebarExpandIcon className="h-5 w-5" />
            ) : (
              <SidebarCollapseIcon className="h-5 w-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} sideOffset={8}>
          {title}
        </TooltipContent>
      </Tooltip>
    );
  },
);

SidebarCollapseButton.displayName = "SidebarCollapseButton";
