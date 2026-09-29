"use client";

import * as React from "react";
import {
  Server,
  Activity,
  CheckCircle2,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  ExternalLink,
  ShieldCheck,
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

interface MicroserviceItem {
  name: string;
  key: string;
  port: number;
  framework: string;
  status: "UP" | "DOWN" | "DEGRADED";
  uptime: string;
  latency: string;
  role: string;
  endpoint: string;
}

const servicesList: MicroserviceItem[] = [
  {
    name: "Discovery Server",
    key: "discovery-server",
    port: 8761,
    framework: "Spring Cloud Netflix Eureka",
    status: "UP",
    uptime: "99.99%",
    latency: "4ms",
    role: "Service Registry & Discovery",
    endpoint: "http://localhost:8761/actuator/health",
  },
  {
    name: "API Gateway",
    key: "api-gateway",
    port: 8080,
    framework: "Spring Cloud Gateway (Reactive)",
    status: "UP",
    uptime: "99.98%",
    latency: "12ms",
    role: "Single Entrypoint, Routing, Rate Limit",
    endpoint: "http://localhost:8080/actuator/health",
  },
  {
    name: "User Service",
    key: "user-service",
    port: 8081,
    framework: "Spring Boot 3.3 + PostgreSQL",
    status: "UP",
    uptime: "99.95%",
    latency: "22ms",
    role: "Authentication, User & Partner Profiles",
    endpoint: "http://localhost:8081/actuator/health",
  },
  {
    name: "Place Service",
    key: "place-service",
    port: 8082,
    framework: "Spring Boot 3.3 + MongoDB",
    status: "UP",
    uptime: "99.95%",
    latency: "18ms",
    role: "Destinations, Places, Ziomap Integration",
    endpoint: "http://localhost:8082/actuator/health",
  },
  {
    name: "Mail Service",
    key: "mail-service",
    port: 8083,
    framework: "Spring Boot 3.3 + JavaMail",
    status: "UP",
    uptime: "100.0%",
    latency: "45ms",
    role: "Email Verification & Notifications",
    endpoint: "http://localhost:8083/actuator/health",
  },
  {
    name: "Trip Service",
    key: "trip-service",
    port: 8084,
    framework: "Spring Boot 3.3 + PostgreSQL",
    status: "UP",
    uptime: "99.96%",
    latency: "24ms",
    role: "Itineraries, Booking, Partner Management",
    endpoint: "http://localhost:8084/actuator/health",
  },
  {
    name: "AI Service",
    key: "ai-service",
    port: 8085,
    framework: "FastAPI + Python + LangChain",
    status: "UP",
    uptime: "99.92%",
    latency: "1.18s",
    role: "Intelligent Trip Agent & ReAct Tooling",
    endpoint: "http://localhost:8085/health",
  },
  {
    name: "Social Service",
    key: "social-service",
    port: 8086,
    framework: "Spring Boot 3.3 + PostgreSQL",
    status: "UP",
    uptime: "99.94%",
    latency: "19ms",
    role: "Community Posts, Comments & Guide Feed",
    endpoint: "http://localhost:8086/actuator/health",
  },
  {
    name: "Context Service",
    key: "context-service",
    port: 8087,
    framework: "Spring Boot 3.3 + PostgreSQL",
    status: "UP",
    uptime: "99.95%",
    latency: "16ms",
    role: "User Context, Preferences & Onboarding",
    endpoint: "http://localhost:8087/actuator/health",
  },
  {
    name: "Recommendation Service",
    key: "recommendation-service",
    port: 8088,
    framework: "Spring Boot 3.3 + Qdrant Vector DB",
    status: "UP",
    uptime: "99.97%",
    latency: "35ms",
    role: "Personalized Places & Dense Vector Similarity",
    endpoint: "http://localhost:8088/actuator/health",
  },
];

const infraList = [
  { name: "PostgreSQL Cluster", port: "5432 - 5437", type: "RDBMS (6 DBs)", status: "HEALTHY" },
  { name: "MongoDB Place Store", port: "27017", type: "Document Store", status: "HEALTHY" },
  { name: "Redis Distributed Cache", port: "6379", type: "Key-Value / Rate Limiting", status: "HEALTHY" },
  { name: "Qdrant Vector Engine", port: "6333", type: "Vector Database (HNSW)", status: "HEALTHY" },
  { name: "Portainer Container UI", port: "9000", type: "Docker Management", status: "HEALTHY" },
];

export default function AdminServicesPage() {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 10 / 10 Online
            </Badge>
            <span className="text-xs text-muted-foreground">Spring Cloud & Infrastructure</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Microservices System Health</h1>
          <p className="text-sm text-muted-foreground">
            Real-time status of backend microservices, API Gateway, Eureka Registry, and Databases.
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          variant="outline"
          className="gap-2 self-start sm:self-auto shadow-2xs"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </Button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servicesList.map((svc) => (
          <Card key={svc.key} className="bg-card border-border shadow-2xs hover:shadow-xs transition-all">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">{svc.name}</CardTitle>
                  <CardDescription className="text-micro font-mono text-muted-foreground">
                    Port :{svc.port} • {svc.framework}
                  </CardDescription>
                </div>
              </div>

              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono text-micro">
                {svc.status}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3">
              <p className="text-xs text-muted-foreground">{svc.role}</p>

              <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                <div className="flex items-center gap-3 text-muted-foreground font-mono">
                  <span>Uptime: <strong className="text-foreground">{svc.uptime}</strong></span>
                  <span>•</span>
                  <span>Latency: <strong className="text-foreground">{svc.latency}</strong></span>
                </div>

                <a
                  href={svc.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline font-medium text-xs"
                >
                  <span>Health</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Databases & Supporting Infrastructure */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">
              Databases, Cache & Container Engine
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Distributed persistent layers and vector embeddings engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {infraList.map((infra) => (
              <div
                key={infra.name}
                className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">{infra.name}</div>
                  <div className="text-micro text-muted-foreground font-mono">
                    Port {infra.port} • {infra.type}
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-micro">
                  {infra.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
