import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DestinationCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm flex flex-col h-full", className)}>
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-full mt-2" />
        </div>
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </Card>
  );
}
