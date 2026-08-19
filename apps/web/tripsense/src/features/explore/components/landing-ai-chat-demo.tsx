"use client";

import * as React from "react";
import { Sparkles, Bot, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlaceCardCompact } from "@/features/places";

export function LandingAiChatDemo() {
  const [messages] = React.useState([
    {
      id: "1",
      role: "user" as const,
      content: "Plan a 3-day itinerary for Rome focusing on local food and historic spots.",
    },
    {
      id: "2",
      role: "assistant" as const,
      content: "Here is a curated 3-day Rome itinerary for you! Day 1 covers the Colosseum & Trastevere food walk:",
      richContent: (
        <div className="space-y-2 mt-2">
          <PlaceCardCompact
            name="Colosseum & Roman Forum"
            category="Historic Landmark"
            rating={4.9}
            image="https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300"
          />
          <PlaceCardCompact
            name="Trastevere Food Tour"
            category="Culinary Experience"
            rating={4.95}
            image="https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=300"
          />
        </div>
      ),
    },
  ]);

  return (
    <section id="ai-assistant" className="py-16 md:py-24 bg-accent/30 border-y border-border/50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Text Column */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent border border-border px-3.5 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>AI Trip Planning</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Plan a trip by <br />
              talking to AI.
            </h2>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Describe your dream vacation in plain English. Our AI understands your preferences, recommends authentic local spots, and formats your schedule into a drag-and-drop itinerary.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
                <h4 className="font-bold text-lg text-primary">Instant Schedule</h4>
                <p className="text-xs text-muted-foreground">Generates day-by-day travel timelines in seconds.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
                <h4 className="font-bold text-lg text-primary">Rich Card Embeds</h4>
                <p className="text-xs text-muted-foreground">Places, restaurants & hotels render as interactive cards.</p>
              </div>
            </div>
          </div>

          {/* Right Column Chat Mockup Container */}
          <div className="relative">
            <Card className="rounded-3xl border border-border bg-card shadow-2xl overflow-hidden max-w-lg mx-auto">
              {/* Chat Window Header */}
              <div className="p-4 border-b border-border bg-muted/60 backdrop-blur flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">TripSense AI Assistant</h4>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse" />
                    <span>Online & Ready</span>
                  </p>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto bg-card/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      {msg.role === "user" ? (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="h-3.5 w-3.5" />
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className={`space-y-1 max-w-[80%] ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      <div
                        className={`rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : "bg-muted border border-border text-foreground rounded-tl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.richContent}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
