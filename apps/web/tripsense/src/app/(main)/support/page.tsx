"use client";

import * as React from "react";
import Link from "next/link";
import {
  HelpCircle,
  MessageSquare,
  Mail,
  FileQuestion,
  Sparkles,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "How does the TripSense AI Planner generate itineraries?",
    a: "TripSense uses a ReAct autonomous AI agent connected to our geospatial Place Service, dense vector search (Qdrant), and real-time weather/routing tools to build day-by-day itineraries tailored to your pace and style.",
  },
  {
    q: "Can I collaborate on trips with friends or family?",
    a: "Yes! Every trip has a collaboration share link. You can invite friends to view or co-edit activities, notes, and dates in real time.",
  },
  {
    q: "How do partners verify and list their hotels or tours?",
    a: "Businesses can register via the Partner Portal (/partner), submit their business registration and tax documents, which are reviewed by our platform administrators before publishing.",
  },
  {
    q: "Is TripSense free to use?",
    a: "Yes! Generating travel plans, exploring places, and collaborating with companions is free. Bookings through verified partners are processed directly with transparent pricing.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <HelpCircle className="h-3.5 w-3.5 mr-1" /> Help Center
            </Badge>
            <span className="text-xs text-muted-foreground">Assistance & FAQs</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Help & Support</h1>
          <p className="text-sm text-muted-foreground">
            Frequently asked questions, platform documentation, and contact channels.
          </p>
        </div>

        <Button asChild className="gap-2 shadow-xs self-start sm:self-auto">
          <Link href="/chat">
            <MessageSquare className="h-4 w-4" /> Ask AI Travel Concierge
          </Link>
        </Button>
      </div>

      {/* Support Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-2xs p-5 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Email Support</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact our team directly for account or partnership inquiries.
            </p>
          </div>
          <a
            href="mailto:support@tripsense.app"
            className="inline-block text-xs font-semibold text-primary hover:underline"
          >
            support@tripsense.app
          </a>
        </Card>

        <Card className="bg-card border-border shadow-2xs p-5 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">24/7 AI Concierge</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instant travel planning, itinerary tweaks, and destination answers.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Open Chat</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      {/* FAQ Section */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Frequently Asked Questions</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Quick answers to common questions about trips, AI generation, and partners.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={faq.q}
                className="border border-border rounded-xl overflow-hidden bg-muted/20"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left font-semibold text-xs text-foreground flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
