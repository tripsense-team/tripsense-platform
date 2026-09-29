"use client";

import * as React from "react";
import {
  TrendingUp,
  Users,
  Compass,
  Sparkles,
  ArrowUpRight,
  Globe2,
  Clock,
  Zap,
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

const kpiStats = [
  {
    title: "Monthly Active Travelers",
    value: "42,890",
    change: "+18.4%",
    icon: Users,
    subtext: "vs. previous month",
  },
  {
    title: "AI Itineraries Generated",
    value: "15,240",
    change: "+32.1%",
    icon: Sparkles,
    subtext: "98.2% completion rate",
  },
  {
    title: "Destinations Explored",
    value: "1,892",
    change: "+12.7%",
    icon: Compass,
    subtext: "Across 48 countries",
  },
  {
    title: "Avg. AI Latency",
    value: "1.24s",
    change: "-14.5%",
    icon: Zap,
    subtext: "Faster than target SLA",
  },
];

const topDestinations = [
  { name: "Tokyo, Japan", visits: "14,820", share: 34, growth: "+24%" },
  { name: "Da Nang, Vietnam", visits: "11,340", share: 26, growth: "+38%" },
  { name: "Paris, France", visits: "7,850", share: 18, growth: "+9%" },
  { name: "Rome, Italy", visits: "5,230", share: 12, growth: "+15%" },
  { name: "Bangkok, Thailand", visits: "4,360", share: 10, growth: "+19%" },
];

const trafficTrend = [
  { day: "Mon", queries: 3200, height: "65%" },
  { day: "Tue", queries: 4100, height: "82%" },
  { day: "Wed", queries: 3800, height: "76%" },
  { day: "Thu", queries: 4600, height: "92%" },
  { day: "Fri", queries: 5200, height: "100%" },
  { day: "Sat", queries: 4800, height: "95%" },
  { day: "Sun", queries: 3900, height: "78%" },
];

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState<"7d" | "30d" | "90d" | "1y">("30d");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Analytics & Performance
            </Badge>
            <span className="text-xs text-muted-foreground">Platform Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">System Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Traveler engagement, itinerary generation trends, and platform reach.
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl self-start sm:self-auto">
          {(["7d", "30d", "90d", "1y"] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="text-xs font-semibold uppercase px-3 h-8 rounded-lg"
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiStats.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="bg-card border-border shadow-2xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-emerald-500 font-semibold flex items-center">
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    {kpi.change}
                  </span>
                  <span className="text-muted-foreground">{kpi.subtext}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Traffic Chart */}
        <Card className="lg:col-span-2 bg-card border-border shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">
              Daily AI Itinerary Generation Activity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Number of completed AI trip generation and recommendation sessions per day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-3 sm:gap-6 pt-6 px-2 border-b border-border pb-4">
              {trafficTrend.map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-micro font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.queries.toLocaleString()}
                  </div>
                  <div
                    style={{ height: item.height }}
                    className="w-full max-w-[48px] rounded-t-lg bg-primary/80 group-hover:bg-primary transition-all duration-300 relative shadow-xs"
                  />
                  <span className="text-xs font-medium text-muted-foreground">{item.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 px-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Generated Trips
              </span>
              <span className="font-mono">Peak: Friday (5,200 requests)</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Destinations */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">Top Destinations</CardTitle>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Most planned cities by travelers this month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topDestinations.map((dest) => (
              <div key={dest.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{dest.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono">{dest.visits}</span>
                    <Badge variant="outline" className="text-micro font-mono text-emerald-500 bg-emerald-500/10 border-emerald-500/20">
                      {dest.growth}
                    </Badge>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${dest.share}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Latency & Quality Metrics */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <CardTitle className="text-base font-bold text-foreground">Infrastructure Performance & SLA</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            End-to-end latency benchmarks across TripSense AI Agent and Gateway pipelines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AI Gateway Route Latency</span>
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">12.4ms</div>
              <p className="text-micro text-emerald-600 dark:text-emerald-400">99.99% within 50ms SLA</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Place Search Engine (Qdrant)</span>
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">34.8ms</div>
              <p className="text-micro text-emerald-600 dark:text-emerald-400">Dense vector cosine similarity</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>LLM Generation Pipeline</span>
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">1.18s</div>
              <p className="text-micro text-emerald-600 dark:text-emerald-400">Streaming response time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
