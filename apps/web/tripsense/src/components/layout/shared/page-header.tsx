import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 pb-6 md:flex-row md:items-center md:justify-between border-b border-border mb-6",
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-page-title text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-body text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 pt-2 md:pt-0">{actions}</div>
      )}
    </div>
  );
}
