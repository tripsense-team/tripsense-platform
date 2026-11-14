"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Route,
  Server,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Landmark,
  Store,
  RefreshCw,
  ArrowRight,
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
import { useTranslation } from "@/i18n";
import { fetchAdminUnifiedAnalytics } from "@/features/admin/api/admin-analytics-api";
import type { AdminUnifiedAnalyticsBundle } from "@/features/admin/types/admin-analytics.types";

const microservicesStatus = [
  { name: "API Gateway", port: "8080", status: "UP", role: "Edge Routing & Rate Limit" },
  { name: "User Service", port: "8081", status: "UP", role: "Auth, OAuth2 & Profiles" },
  { name: "Place Service", port: "8083", status: "UP", role: "MongoDB Place Catalog" },
  { name: "Trip Service", port: "8084", status: "UP", role: "Trips, Partners & Finance" },
  { name: "Social Service", port: "8086", status: "UP", role: "Community, Reviews & Chat" },
  { name: "AI Service", port: "8089", status: "UP", role: "Agentic Itinerary Planner" },
];

export default function AdminDashboardPage() {
  const { t, locale } = useTranslation();
  const [bundle, setBundle] = React.useState<AdminUnifiedAnalyticsBundle | null>(null);
  const [loading, setLoading] = React.useState(true);

  const handleRefresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminUnifiedAnalytics(30);
      setBundle(res);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchAdminUnifiedAnalytics(30)
      .then((res) => {
        if (!cancelled) {
          setBundle(res);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatNumber = (val: number | undefined | null) => {
    const safe = typeof val === "number" && !Number.isNaN(val) ? val : 0;
    return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(safe);
  };

  const formatMoney = (val: number | undefined | null) => {
    const safe = typeof val === "number" && !Number.isNaN(val) ? val : 0;
    return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(safe);
  };

  const userStats = bundle?.userStats;
  const tripStats = bundle?.tripAnalytics?.tripStats;
  const partnerStats = bundle?.tripAnalytics?.partnerAndBookingStats;
  const financeStats = bundle?.tripAnalytics?.financeAndSubscriptionStats;
  const socialStats = bundle?.socialStats;
  const recentEvents = bundle?.tripAnalytics?.recentEvents || [];

  const metricCards = [
    {
      title: t("admin.dashboard.metrics.totalUsers"),
      value: loading ? "..." : formatNumber(userStats?.totalUsers),
      change: `+${formatNumber(userStats?.periodNewUsers)} (30d)`,
      description: `${formatNumber(userStats?.roleBreakdown.partnersCount)} Partners`,
      icon: Users,
    },
    {
      title: t("admin.dashboard.metrics.activeTrips"),
      value: loading ? "..." : formatNumber(tripStats?.totalTrips),
      change: `${tripStats?.aiAdoptionRatePercent ?? 0}% AI`,
      description: `${formatNumber(tripStats?.totalAiCommits)} AI commits`,
      icon: Route,
    },
    {
      title: t("admin.analytics.kpi.platformRevenue"),
      value: loading ? "..." : formatMoney(financeStats?.totalPlatformRevenue),
      change: `GMV ${formatMoney(financeStats?.totalHotelGmv)}`,
      description: `${formatNumber(financeStats?.activeSubscriptionsCount)} Pro Subscriptions`,
      icon: Landmark,
    },
    {
      title: t("admin.analytics.partnerEcosystemTitle"),
      value: loading ? "..." : formatNumber(partnerStats?.totalPartnerBusinesses),
      change: `${formatNumber(partnerStats?.applicationFunnel.submittedCount)} pending`,
      description: `${formatNumber(socialStats?.moderationStats.pendingReportsCount)} reports queued`,
      icon: Store,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {t("admin.dashboard.badge")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("admin.dashboard.controlCenter")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.dashboard.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.dashboard.description")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-9 gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("admin.analytics.refresh")}</span>
          </Button>
          <Link href="/admin/analytics">
            <Button size="sm" className="h-9 gap-1.5 text-xs rounded-xl">
              <span>{t("admin.analytics.title")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="bg-card border-border shadow-2xs hover:shadow-xs transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <span className="text-emerald-500 font-semibold flex items-center">
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    {card.change}
                  </span>
                  <span>•</span>
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
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span>{t("admin.dashboard.servicesHealth.title")}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("admin.dashboard.servicesHealth.description")}
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {t("admin.dashboard.servicesHealth.eurekaActive")}
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
                    <span className="font-semibold text-sm text-foreground">
                      {service.name}
                    </span>
                    <span className="text-micro font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      :{service.port}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {service.role}
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-micro">
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Platform Activities (Real DB Events) */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {t("admin.dashboard.recentActivities.title")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("admin.dashboard.recentActivities.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
              {t("admin.analytics.noRecentEvents")}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 sm:p-4 text-xs bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className="font-mono text-foreground font-medium">
                      {event.actorLabel}
                    </span>
                    <span className="text-muted-foreground">
                      {event.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-micro text-muted-foreground font-mono">
                      {new Date(event.occurredAt).toLocaleString(
                        locale === "vi" ? "vi-VN" : "en-US",
                      )}
                    </span>
                    <Badge variant="outline" className="text-micro bg-muted font-mono">
                      {event.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
