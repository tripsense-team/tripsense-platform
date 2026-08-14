import Image from "next/image";
import { Calendar, MapPin, Share2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface TripMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface TripHeaderProps {
  title: string;
  description?: string;
  destination: string;
  dateRange: string;
  coverImage?: string;
  members?: TripMember[];
  onShare?: () => void;
  className?: string;
}

export function TripHeader({
  title,
  description,
  destination,
  dateRange,
  coverImage,
  members = [],
  onShare,
  className,
}: TripHeaderProps) {
  return (
    <div className={cn("space-y-4 pb-6 border-b border-border", className)}>
      {coverImage && (
        <div className="relative h-48 sm:h-64 w-full rounded-2xl overflow-hidden bg-muted">
          <Image src={coverImage} alt={title} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 z-10 text-white">
            <Badge variant="secondary" className="bg-white/20 backdrop-blur text-white border-0 mb-2">
              <MapPin className="h-3 w-3 mr-1" />
              {destination}
            </Badge>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
          </div>
        </div>
      )}

      {!coverImage && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <MapPin className="h-3.5 w-3.5" />
            <span>{destination}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-md border border-border">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{dateRange}</span>
          </div>

          {members.length > 0 && (
            <div className="flex items-center -space-x-2">
              {members.slice(0, 4).map((member) => (
                <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback className="text-[10px]">
                    {member.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 4 && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold border-2 border-background">
                  +{members.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onShare} className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            <span>Share Trip</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
