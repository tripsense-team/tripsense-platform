"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Compass,
  Sparkles,
  ArrowUpRight,
  Globe2,
  RefreshCw,
  Building2,
  Utensils,
  UserCheck,
  Car,
  Landmark,
  Crown,
  TicketPercent,
  MessageSquare,
  Star,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
  Share2,
  Heart,
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
import type {
  AdminDailyAnalyticsPoint,
  AdminPeriodDays,
  AdminUnifiedAnalyticsBundle,
} from "@/features/admin/types/admin-analytics.types";

type TimeRangeOption = {
  label: string;
  days: AdminPeriodDays;
};

const TIME_RANGES: TimeRangeOption[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

type ChartMode = "trips" | "revenue" | "users";

interface ChartBucket {
  label: string;
  tooltipLabel: string;
  primaryValue: number;
  secondaryValue: number;
}

export default function AdminAnalyticsPage() {
  const { t, locale } = useTranslation();
  const [periodDays, setPeriodDays] = React.useState<AdminPeriodDays>(30);
  const [chartMode, setChartMode] = React.useState<ChartMode>("trips");
  const [bundle, setBundle] = React.useState<AdminUnifiedAnalyticsBundle | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const loadAnalytics = React.useCallback(async (days: AdminPeriodDays) => {
    setRefreshing(true);
    try {
      const data = await fetchAdminUnifiedAnalytics(days);
      setBundle(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchAdminUnifiedAnalytics(periodDays)
      .then((data) => {
        if (!cancelled) {
          setBundle(data);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const handleSelectPeriod = (days: AdminPeriodDays) => {
    if (days === periodDays) return;
    setLoading(true);
    setPeriodDays(days);
  };

  const formatMoney = React.useCallback(
    (amount: number | undefined | null, currency = "VND") => {
      const safe = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
      return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(safe);
    },
    [locale],
  );

  const formatNumber = React.useCallback(
    (val: number | undefined | null) => {
      const safe = typeof val === "number" && !Number.isNaN(val) ? val : 0;
      return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(safe);
    },
    [locale],
  );

  const formatGrowth = (pct: number | undefined | null) => {
    const safe = typeof pct === "number" && !Number.isNaN(pct) ? pct : 0;
    const sign = safe >= 0 ? "+" : "";
    return `${sign}${safe.toFixed(1)}%`;
  };

  const tripStats = bundle?.tripAnalytics?.tripStats;
  const partnerStats = bundle?.tripAnalytics?.partnerAndBookingStats;
  const financeStats = bundle?.tripAnalytics?.financeAndSubscriptionStats;
  const userStats = bundle?.userStats;
  const socialStats = bundle?.socialStats;

  // Build up to 14 buckets for the main bar chart so 7d, 30d, 90d, 365d all render cleanly
  const chartBuckets = React.useMemo<ChartBucket[]>(() => {
    if (chartMode === "users") {
      const series = userStats?.dailyRegistrations || [];
      if (series.length === 0) return [];
      const maxBars = 14;
      const chunkSize = Math.max(1, Math.ceil(series.length / maxBars));
      const buckets: ChartBucket[] = [];
      for (let i = 0; i < series.length; i += chunkSize) {
        const slice = series.slice(i, i + chunkSize);
        const sumUsers = slice.reduce((acc, item) => acc + (item.newUsers || 0), 0);
        const firstDate = slice[0].date;
        const lastDate = slice[slice.length - 1].date;
        const shortLabel = firstDate.slice(5); // MM-DD
        buckets.push({
          label: shortLabel,
          tooltipLabel: chunkSize === 1 ? firstDate : `${firstDate} → ${lastDate}`,
          primaryValue: sumUsers,
          secondaryValue: 0,
        });
      }
      return buckets;
    }

    const series: AdminDailyAnalyticsPoint[] = bundle?.tripAnalytics?.dailySeries || [];
    if (series.length === 0) return [];
    const maxBars = 14;
    const chunkSize = Math.max(1, Math.ceil(series.length / maxBars));
    const buckets: ChartBucket[] = [];
    for (let i = 0; i < series.length; i += chunkSize) {
      const slice = series.slice(i, i + chunkSize);
      const firstDate = slice[0].date;
      const lastDate = slice[slice.length - 1].date;
      const shortLabel = firstDate.slice(5);
      if (chartMode === "trips") {
        const tripsSum = slice.reduce((acc, p) => acc + (p.tripsCreated || 0), 0);
        const aiSum = slice.reduce((acc, p) => acc + (p.aiCommits || 0), 0);
        buckets.push({
          label: shortLabel,
          tooltipLabel: chunkSize === 1 ? firstDate : `${firstDate} → ${lastDate}`,
          primaryValue: tripsSum,
          secondaryValue: aiSum,
        });
      } else {
        const gmvSum = slice.reduce((acc, p) => acc + Number(p.gmvAmount || 0), 0);
        const revSum = slice.reduce((acc, p) => acc + Number(p.platformRevenueAmount || 0), 0);
        buckets.push({
          label: shortLabel,
          tooltipLabel: chunkSize === 1 ? firstDate : `${firstDate} → ${lastDate}`,
          primaryValue: gmvSum,
          secondaryValue: revSum,
        });
      }
    }
    return buckets;
  }, [bundle?.tripAnalytics?.dailySeries, userStats?.dailyRegistrations, chartMode]);

  const maxChartValue = React.useMemo(() => {
    if (chartBuckets.length === 0) return 1;
    return Math.max(
      1,
      ...chartBuckets.map((b) => Math.max(b.primaryValue, b.secondaryValue)),
    );
  }, [chartBuckets]);

  const totalBookingsAcrossVerticals =
    (partnerStats?.hotelBookingFunnel.total || 0) +
    (partnerStats?.restaurantReservationFunnel.total || 0) +
    (partnerStats?.rentalBookingFunnel.total || 0) +
    (partnerStats?.guideInquiryFunnel.total || 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              {t("admin.analytics.telemetry")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("admin.analytics.dataIntelligence")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.analytics.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.analytics.subtitle")}
          </p>
        </div>

        {/* Time range selector & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.label}
                variant={periodDays === range.days ? "default" : "ghost"}
                size="sm"
                onClick={() => handleSelectPeriod(range.days)}
                className="text-xs font-semibold uppercase px-3 h-8 rounded-lg"
              >
                {range.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalytics(periodDays)}
            disabled={loading || refreshing}
            className="h-10 px-3 rounded-xl gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("admin.analytics.refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Partial service notice if any service is offline */}
      {bundle && bundle.partialErrors.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">{t("admin.analytics.partialNotice")}: </span>
            <span>{bundle.partialErrors.join(" • ")}</span>
          </div>
        </div>
      )}

      {/* Top 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Users */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("admin.analytics.kpi.monthlyTravelers")}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : formatNumber(userStats?.totalUsers)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span
                className={`font-semibold flex items-center ${
                  (userStats?.userGrowthPercent ?? 0) >= 0
                    ? "text-emerald-500"
                    : "text-destructive"
                }`}
              >
                {(userStats?.userGrowthPercent ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {formatGrowth(userStats?.userGrowthPercent)}
              </span>
              <span className="text-muted-foreground">
                +{formatNumber(userStats?.periodNewUsers)} {t("admin.analytics.inPeriod")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Trips & AI Adoption */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("admin.analytics.kpi.aiItineraries")}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : formatNumber(tripStats?.totalTrips)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-emerald-500 font-semibold flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                {formatGrowth(tripStats?.tripsGrowthPercent)}
              </span>
              <span className="text-muted-foreground">
                {t("admin.analytics.aiAdoption")}:{" "}
                <strong className="text-foreground">
                  {tripStats?.aiAdoptionRatePercent ?? 0}%
                </strong>{" "}
                ({formatNumber(tripStats?.totalAiCommits)} AI commits)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Total Platform Revenue (Commission + Partner Subscriptions) */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("admin.analytics.kpi.platformRevenue")}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Landmark className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : formatMoney(financeStats?.totalPlatformRevenue)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>
                GMV:{" "}
                <strong className="text-foreground">
                  {formatMoney(financeStats?.totalHotelGmv)}
                </strong>
              </span>
              <span>•</span>
              <span>
                {formatNumber(financeStats?.activeSubscriptionsCount)} Pro Partners
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Destinations & Community Rating */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("admin.analytics.kpi.destinationsExplored")}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Compass className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : formatNumber(tripStats?.distinctDestinationsCount)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-500" />
                {socialStats?.placeReviewStats.averageRating?.toFixed(2) || "0.00"} / 5.0
              </span>
              <span>
                ({formatNumber(socialStats?.placeReviewStats.totalPublishedReviews)}{" "}
                {t("admin.analytics.reviewsLabel")})
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PILLAR 1: Trips, AI Adoption & Top Destinations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Time-Series Chart */}
        <Card className="lg:col-span-2 bg-card border-border shadow-2xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>{t("admin.analytics.dailyActivityTitle")}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("admin.analytics.dailyActivityDesc")} ({periodDays}{" "}
                {t("admin.analytics.daysLabel")})
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl self-start">
              <Button
                variant={chartMode === "trips" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartMode("trips")}
                className="h-7 px-2.5 text-xs rounded-lg"
              >
                {t("admin.analytics.chartTabs.tripsAi")}
              </Button>
              <Button
                variant={chartMode === "revenue" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartMode("revenue")}
                className="h-7 px-2.5 text-xs rounded-lg"
              >
                {t("admin.analytics.chartTabs.revenueGmv")}
              </Button>
              <Button
                variant={chartMode === "users" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartMode("users")}
                className="h-7 px-2.5 text-xs rounded-lg"
              >
                {t("admin.analytics.chartTabs.newUsers")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-2 sm:gap-3 pt-8 px-2 border-b border-border pb-4">
              {chartBuckets.map((item) => {
                const primaryHeightPct = Math.max(
                  6,
                  Math.round((item.primaryValue / maxChartValue) * 100),
                );
                const secondaryHeightPct =
                  item.secondaryValue > 0
                    ? Math.max(4, Math.round((item.secondaryValue / maxChartValue) * 100))
                    : 0;
                return (
                  <div
                    key={item.tooltipLabel}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                  >
                    <div className="text-micro font-mono text-foreground bg-popover border border-border px-1.5 py-0.5 rounded shadow-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {chartMode === "revenue"
                        ? formatMoney(item.primaryValue)
                        : formatNumber(item.primaryValue)}
                      {chartMode !== "users" && item.secondaryValue > 0
                        ? ` / ${
                            chartMode === "revenue"
                              ? formatMoney(item.secondaryValue)
                              : formatNumber(item.secondaryValue)
                          }`
                        : ""}
                    </div>
                    <div className="w-full max-w-[38px] h-full flex items-end justify-center gap-1">
                      <div
                        style={{ height: `${primaryHeightPct}%` }}
                        className="flex-1 rounded-t-md bg-primary/85 group-hover:bg-primary transition-all duration-300"
                        title={item.tooltipLabel}
                      />
                      {chartMode !== "users" && (
                        <div
                          style={{ height: `${secondaryHeightPct}%` }}
                          className="flex-1 rounded-t-md bg-violet-500/80 group-hover:bg-violet-500 transition-all duration-300"
                          title={item.tooltipLabel}
                        />
                      )}
                    </div>
                    <span className="text-micro font-mono text-muted-foreground truncate max-w-[44px]">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chart Legend & Trip Breakdown Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.analytics.aiAssistedTrips")}
                </span>
                <span className="font-bold text-foreground">
                  {formatNumber(tripStats?.aiAssistedTripsCount)} /{" "}
                  {formatNumber(tripStats?.totalTrips)} ({tripStats?.aiAdoptionRatePercent ?? 0}%)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.analytics.avgCollaborators")}
                </span>
                <span className="font-bold text-foreground">
                  {tripStats?.avgCollaboratorsPerTrip ?? 1.0}{" "}
                  {t("admin.analytics.membersPerTrip")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.analytics.tripVisibility")}
                </span>
                <span className="font-mono text-micro font-semibold text-foreground">
                  P:{formatNumber(tripStats?.visibilityBreakdown.publicCount)} • S:
                  {formatNumber(tripStats?.visibilityBreakdown.sharedCount)} • Pr:
                  {formatNumber(tripStats?.visibilityBreakdown.privateCount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Planned Destinations */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">
                {t("admin.analytics.topDestinations")}
              </CardTitle>
              <Globe2 className="h-4 w-4 text-primary" />
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {t("admin.analytics.topDestinationsSub")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!tripStats?.topDestinations || tripStats.topDestinations.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                {t("admin.analytics.noDestinationData")}
              </div>
            ) : (
              tripStats.topDestinations.map((dest, idx) => (
                <div key={dest.destinationName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-micro font-bold">
                        {idx + 1}
                      </span>
                      <span className="truncate max-w-[150px]">{dest.destinationName}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono">
                        {formatNumber(dest.tripsCount)} trips
                      </span>
                      <Badge
                        variant="outline"
                        className="text-micro font-mono text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      >
                        {formatGrowth(dest.growthPercent)}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(4, dest.sharePercent))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* PILLAR 2: Partner Ecosystem & Multi-Vertical Booking Funnel */}
      <Card className="bg-card border-border shadow-2xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span>{t("admin.analytics.partnerEcosystemTitle")}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("admin.analytics.partnerEcosystemDesc")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {formatNumber(partnerStats?.publishedPartnerBusinesses)} /{" "}
                {formatNumber(partnerStats?.totalPartnerBusinesses)}{" "}
                {t("admin.analytics.publishedPartners")}
              </Badge>
              <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-mono">
                {formatNumber(totalBookingsAcrossVerticals)}{" "}
                {t("admin.analytics.totalServiceOrders")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 4 Partner Business Verticals + Onboarding Funnel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-micro text-muted-foreground uppercase font-semibold">
                  {t("admin.analytics.verticals.hotel")}
                </div>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(partnerStats?.partnerByKind.hotelCount)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <div className="text-micro text-muted-foreground uppercase font-semibold">
                  {t("admin.analytics.verticals.restaurant")}
                </div>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(partnerStats?.partnerByKind.restaurantCount)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-micro text-muted-foreground uppercase font-semibold">
                  {t("admin.analytics.verticals.tourGuide")}
                </div>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(partnerStats?.partnerByKind.tourGuideCount)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <div className="text-micro text-muted-foreground uppercase font-semibold">
                  {t("admin.analytics.verticals.rental")}
                </div>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(partnerStats?.partnerByKind.rentalCount)}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Multi-Vertical Booking Funnel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hotel Booking Funnel */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  {t("admin.analytics.funnel.hotelBookings")}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatNumber(partnerStats?.hotelBookingFunnel.total)}
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.confirmedActive")}</span>
                  <span className="font-mono text-foreground font-medium">
                    {formatNumber(
                      (partnerStats?.hotelBookingFunnel.confirmed || 0) +
                        (partnerStats?.hotelBookingFunnel.checkedIn || 0),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.checkedOut")}</span>
                  <span className="font-mono text-emerald-500 font-semibold">
                    {formatNumber(partnerStats?.hotelBookingFunnel.checkedOut)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.cancelledOrHeld")}</span>
                  <span className="font-mono text-destructive">
                    {formatNumber(
                      (partnerStats?.hotelBookingFunnel.cancelled || 0) +
                        (partnerStats?.hotelBookingFunnel.held || 0),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Restaurant Reservation Funnel */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Utensils className="h-4 w-4 text-orange-500" />
                  {t("admin.analytics.funnel.restaurantReservations")}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatNumber(partnerStats?.restaurantReservationFunnel.total)}
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.confirmed")}</span>
                  <span className="font-mono text-emerald-500 font-semibold">
                    {formatNumber(partnerStats?.restaurantReservationFunnel.confirmed)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.requestedPending")}</span>
                  <span className="font-mono text-amber-500 font-medium">
                    {formatNumber(partnerStats?.restaurantReservationFunnel.requested)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.cancelledOrRejected")}</span>
                  <span className="font-mono text-destructive">
                    {formatNumber(
                      (partnerStats?.restaurantReservationFunnel.cancelled || 0) +
                        (partnerStats?.restaurantReservationFunnel.rejected || 0),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Rental Booking Funnel */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-violet-500" />
                  {t("admin.analytics.funnel.rentalOrders")}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatNumber(partnerStats?.rentalBookingFunnel.total)}
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.confirmedInUse")}</span>
                  <span className="font-mono text-foreground font-medium">
                    {formatNumber(
                      (partnerStats?.rentalBookingFunnel.confirmed || 0) +
                        (partnerStats?.rentalBookingFunnel.inUse || 0),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.returnedCompleted")}</span>
                  <span className="font-mono text-emerald-500 font-semibold">
                    {formatNumber(partnerStats?.rentalBookingFunnel.returned)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.cancelled")}</span>
                  <span className="font-mono text-destructive">
                    {formatNumber(partnerStats?.rentalBookingFunnel.cancelled)}
                  </span>
                </div>
              </div>
            </div>

            {/* Guide Inquiry Funnel */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  {t("admin.analytics.funnel.guideInquiries")}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatNumber(partnerStats?.guideInquiryFunnel.total)}
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.activeDiscussion")}</span>
                  <span className="font-mono text-amber-500 font-medium">
                    {formatNumber(partnerStats?.guideInquiryFunnel.active)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.contactAgreed")}</span>
                  <span className="font-mono text-emerald-500 font-semibold">
                    {formatNumber(partnerStats?.guideInquiryFunnel.contactAgreed)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("admin.analytics.funnel.closedOrDeclined")}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatNumber(partnerStats?.guideInquiryFunnel.closedOrDeclined)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Partner Onboarding Queue & Hotel Vouchers Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-foreground">
                  {t("admin.analytics.onboardingFunnelTitle")}
                </div>
                <div className="text-muted-foreground">
                  {t("admin.analytics.onboardingFunnelSub")}
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {t("admin.analytics.pending")}:{" "}
                  {formatNumber(partnerStats?.applicationFunnel.submittedCount)}
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  {t("admin.analytics.approved")}:{" "}
                  {formatNumber(partnerStats?.applicationFunnel.approvedCount)}
                </Badge>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {t("admin.analytics.rejected")}:{" "}
                  {formatNumber(partnerStats?.applicationFunnel.rejectedCount)}
                </Badge>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <TicketPercent className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-foreground">
                    {t("admin.analytics.voucherPerformanceTitle")}
                  </div>
                  <div className="text-muted-foreground">
                    {formatNumber(partnerStats?.voucherStats.totalActiveVouchers)}{" "}
                    {t("admin.analytics.activeVouchers")} •{" "}
                    {formatNumber(partnerStats?.voucherStats.redemptionsCount)}{" "}
                    {t("admin.analytics.redemptions")}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.totalDiscountSaved")}
                </div>
                <div className="text-sm font-bold text-primary font-mono">
                  {formatMoney(partnerStats?.voucherStats.totalDiscountAmount)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PILLAR 3: Dual-Stream Monetization (Escrow Commission + Partner Pro Subscriptions) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-500" />
                  <span>{t("admin.analytics.escrowStreamTitle")}</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t("admin.analytics.escrowStreamDesc")}
                </CardDescription>
              </div>
              <Link href="/admin/finance">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  {t("admin.analytics.manageFinance")}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.totalPaidGmv")}
                </div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {formatMoney(financeStats?.totalHotelGmv)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.inPeriod")}: {formatMoney(financeStats?.periodHotelGmv)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.escrowHolding")}
                </div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {formatMoney(financeStats?.escrowHoldingAmount)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.settledGmv")}: {formatMoney(financeStats?.completedHotelGmv)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.commissionRevenue10")}
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatMoney(financeStats?.hotelCommissionRevenue)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  10% take-rate
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.partnerWalletPayable")}
                </div>
                <div className="text-lg font-bold text-primary mt-1">
                  {formatMoney(financeStats?.partnerPayableBalance)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {formatNumber(financeStats?.pendingWithdrawalsCount)} {t("admin.analytics.pendingWithdrawals")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stream 2: Partner Subscription Plans */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span>{t("admin.analytics.subscriptionStreamTitle")}</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t("admin.analytics.subscriptionStreamDesc")}
                </CardDescription>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono text-xs">
                {formatNumber(financeStats?.paidSubscriptionOrdersCount)} Paid Orders
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.totalSubscriptionRevenue")}
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatMoney(financeStats?.subscriptionRevenue)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.inPeriod")}:{" "}
                  {formatMoney(financeStats?.periodSubscriptionRevenue)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.combinedPlatformRevenue")}
                </div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {formatMoney(financeStats?.totalPlatformRevenue)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  Commission + Subscriptions
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 text-center">
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <div className="text-lg font-bold text-emerald-500">
                  {formatNumber(financeStats?.activeSubscriptionsCount)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.subStatus.active")}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <div className="text-lg font-bold text-amber-500">
                  {formatNumber(financeStats?.trialSubscriptionsCount)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.subStatus.trial")}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <div className="text-lg font-bold text-muted-foreground">
                  {formatNumber(financeStats?.expiredSubscriptionsCount)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.subStatus.expired")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PILLAR 4 & PILLAR 5: User Demographics & Community / Place Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar 4: User Roles, Status & Auth Providers */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>{t("admin.analytics.userDemographicsTitle")}</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("admin.analytics.userDemographicsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(userStats?.roleBreakdown.travelersCount)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.roles.travelers")}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="text-xl font-bold text-primary">
                  {formatNumber(userStats?.roleBreakdown.partnersCount)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.roles.partners")}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="text-xl font-bold text-amber-500">
                  {formatNumber(userStats?.roleBreakdown.adminsCount)}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {t("admin.analytics.roles.admins")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-2">
                <div className="font-semibold text-foreground">
                  {t("admin.analytics.authProviderTitle")}
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Email / Password (LOCAL)</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatNumber(userStats?.authProviderBreakdown.localCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Google OAuth 2.0</span>
                  <span className="font-mono font-bold text-primary">
                    {formatNumber(userStats?.authProviderBreakdown.googleCount)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-2">
                <div className="font-semibold text-foreground">
                  {t("admin.analytics.accountStatusTitle")}
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Active
                  </span>
                  <span className="font-mono font-bold text-emerald-500">
                    {formatNumber(userStats?.activeUsers)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Unverified / Inactive</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatNumber(
                      (userStats?.unverifiedUsers || 0) + (userStats?.inactiveUsers || 0),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pillar 5: Community Engagement, Place Reviews (1-5 Stars) & Moderation */}
        <Card className="bg-card border-border shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>{t("admin.analytics.communityReviewsTitle")}</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("admin.analytics.communityReviewsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Community Engagement Counters */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                <div className="text-base font-bold text-foreground">
                  {formatNumber(socialStats?.totalPosts)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.community.posts")}
                </div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                <div className="text-base font-bold text-foreground">
                  {formatNumber(socialStats?.totalComments)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.community.comments")}
                </div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                <div className="text-base font-bold text-rose-500 flex items-center justify-center gap-1">
                  <Heart className="h-3.5 w-3.5 fill-rose-500" />
                  {formatNumber(socialStats?.totalReactions)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.community.reactions")}
                </div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                <div className="text-base font-bold text-primary flex items-center justify-center gap-1">
                  <Share2 className="h-3.5 w-3.5" />
                  {formatNumber(socialStats?.totalSharedTrips)}
                </div>
                <div className="text-micro text-muted-foreground">
                  {t("admin.analytics.community.tripShares")}
                </div>
              </div>
            </div>

            {/* Place Review Star Distribution & Moderation Queue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="font-semibold text-foreground flex items-center justify-between mb-2">
                  <span>{t("admin.analytics.starDistribution")}</span>
                  <span className="text-amber-500 font-mono font-bold">
                    ★ {socialStats?.placeReviewStats.averageRating?.toFixed(2) || "0.00"}
                  </span>
                </div>
                {[
                  { stars: 5, count: socialStats?.placeReviewStats.fiveStarCount || 0 },
                  { stars: 4, count: socialStats?.placeReviewStats.fourStarCount || 0 },
                  { stars: 3, count: socialStats?.placeReviewStats.threeStarCount || 0 },
                  { stars: 2, count: socialStats?.placeReviewStats.twoStarCount || 0 },
                  { stars: 1, count: socialStats?.placeReviewStats.oneStarCount || 0 },
                ].map((row) => {
                  const totalRev = Math.max(
                    1,
                    socialStats?.placeReviewStats.totalPublishedReviews || 0,
                  );
                  const pct = Math.round((row.count / totalRev) * 100);
                  return (
                    <div key={row.stars} className="flex items-center gap-2">
                      <span className="w-8 font-mono text-micro text-muted-foreground">
                        {row.stars} ★
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-micro text-foreground">
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/15 flex flex-col justify-between space-y-2">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    <span>{t("admin.analytics.moderationHealthTitle")}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("admin.analytics.moderation.pending")}</span>
                      <span className="font-mono font-bold text-amber-500">
                        {formatNumber(socialStats?.moderationStats.pendingReportsCount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("admin.analytics.moderation.actioned")}</span>
                      <span className="font-mono font-bold text-emerald-500">
                        {formatNumber(socialStats?.moderationStats.actionedReportsCount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("admin.analytics.moderation.dismissed")}</span>
                      <span className="font-mono text-foreground">
                        {formatNumber(socialStats?.moderationStats.dismissedReportsCount)}
                      </span>
                    </div>
                  </div>
                </div>
                <Link href="/admin/reports">
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                    {t("admin.analytics.openModerationQueue")}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
