import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "Solo Traveler",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    quote: "TripSense built a 4-day Tokyo itinerary in 30 seconds that felt like it was planned by a local friend. Truly game changing!",
    rating: 5,
  },
  {
    name: "Marcus Vance",
    role: "Digital Nomad",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    quote: "Importing photos from Instagram into actionable trip itineraries saved me hours of manual search.",
    rating: 5,
  },
  {
    name: "Elena Rostova",
    role: "Family Traveler",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    quote: "Planning our European family vacation was effortless. The map view and route optimizer kept our days perfectly paced.",
    rating: 5,
  },
];

export function LandingTestimonials() {
  return (
    <section className="py-16 md:py-24 bg-accent/30 border-t border-border/50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold rounded-full border-border">
            Testimonials
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Loved by travelers worldwide.
          </h2>
          <p className="text-base text-muted-foreground">
            See how thousands of adventurers plan smarter trips with TripSense.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="p-6 rounded-2xl border border-border bg-card shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-foreground/90 italic leading-relaxed">
                  &quot;{t.quote}&quot;
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                <Avatar className="h-10 w-10 border border-border shrink-0">
                  <AvatarImage src={t.avatar} alt={t.name} />
                  <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
