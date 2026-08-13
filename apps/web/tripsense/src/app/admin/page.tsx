import * as React from "react";
import {
  Users,
  Route,
  Activity,
  Server,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const metricCards = [
  {
    title: "Total Registered Users",
    value: "2,845",
    change: "+14.2%",
    description: "vs. last month",
    icon: Users,
  },
  {
    title: "Active Trips Planned",
    value: "1,420",
    change: "+28.4%",
    description: "vs. last month",
    icon: Route,
  },
  {
    title: "Gateway Traffic (24h)",
    value: "184,290",
    change: "+9.1%",
    description: "reqs processed",
    icon: Activity,
  },
  {
    title: "System Microservices",
    value: "3 / 3 Live",
    change: "100%",
    description: "Eureka Status UP",
    icon: Server,
  },
];

const microservicesStatus = [
  {
    name: "API Gateway",
    port: "8080",
    status: "UP",
    uptime: "99.98%",
    latency: "12ms",
  },
  {
    name: "User Service",
    port: "8081",
    status: "UP",
    uptime: "99.95%",
    latency: "24ms",
  },
  {
    name: "Mail Service",
    port: "8082",
    status: "UP",
    uptime: "100.0%",
    latency: "45ms",
  },
];

const recentActivities = [
  {
    id: "act-1",
    user: "giabaoworking362004@gmail.com",
    action: "Verified Email & Activated Account",
    timestamp: "2 mins ago",
    status: "Success",
  },
  {
    id: "act-2",
    user: "alex.traveler@mindtrip.ai",
    action: "Generated 5-day Tokyo AI Itinerary",
    timestamp: "15 mins ago",
    status: "Success",
  },
  {
    id: "act-3",
    user: "sarah.m@gmail.com",
    action: "Saved Place: Da Nang Dragon Bridge",
    timestamp: "32 mins ago",
    status: "Success",
  },
  {
    id: "act-4",
    user: "system.gateway",
    action: "Eureka Discovery Heartbeat Sync",
    timestamp: "1 hour ago",
    status: "System",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Admin Dashboard
            </Badge>
            <span className="text-xs text-muted-foreground">TripSense Control Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">
            Monitor real-time system performance, user activity, and microservice status.
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-card border-border shadow-2xs hover:shadow-xs transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="text-emerald-500 font-semibold flex items-center">
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    {card.change}
                  </span>
                  <span>{card.description}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Microservice Health Monitor */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">Microservices System Health</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Spring Cloud Netflix Eureka Service Discovery & API Gateway routes status.
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Eureka Discovery Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {microservicesStatus.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{service.name}</span>
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      :{service.port}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Uptime: {service.uptime}</span>
                    <span>•</span>
                    <span>Latency: {service.latency}</span>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-2xs">
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Platform Activities */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">Recent Activity Logs</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Real-time user authentication and platform events.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 sm:p-4 text-xs bg-card hover:bg-muted/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="font-mono text-foreground font-medium">{activity.user}</span>
                  <span className="text-muted-foreground">{activity.action}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-2xs text-muted-foreground">{activity.timestamp}</span>
                  <Badge variant="outline" className="text-2xs bg-muted">
                    {activity.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
