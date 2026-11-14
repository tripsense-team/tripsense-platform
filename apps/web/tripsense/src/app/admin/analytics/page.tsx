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
  Landmark,
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
  const deepTrip = bundle?.tripAnalytics?.deepTripAnalytics;
  const userStats = bundle?.userStats;
  const socialStats = bundle?.socialStats;
  const recStats = bundle?.recommendationStats;
  const contextStats = bundle?.contextStats;
  const aiStats = bundle?.aiStats;

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
                <strong className="text-foreground">
                  {formatNumber(tripStats?.aiAssistedTripsCount ?? 0)} AI
                </strong>{" "}
                • {formatNumber(tripStats?.manualTripsCount ?? 0)}{" "}
                {t("admin.analytics.deep.segmentManual")} (
                {tripStats?.aiAdoptionRatePercent ?? 0}%)
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

      {/* Deep Behavioral & AI Analytics Row 1: Recommendation Engine Quality + AI Planner & Segment Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module 1: Recommendation Ranking Quality & Top-K Position Analysis */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Compass className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    {t("admin.analytics.deep.recTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("admin.analytics.deep.recDesc")}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                CTR {recStats?.funnel?.ctrPercent ?? 0}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 4-Step GA Recommendation Funnel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.funnelImpressions")}
                </p>
                <p className="text-lg font-bold mt-1">
                  {formatNumber(recStats?.funnel?.impressions ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  100% baseline
                </p>
              </div>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.funnelClicks")}
                </p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {formatNumber(recStats?.funnel?.clicks ?? 0)}
                </p>
                <p className="text-[10px] text-indigo-600/80 dark:text-indigo-300 mt-0.5">
                  {recStats?.funnel?.ctrPercent ?? 0}% CTR
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.funnelSaves")}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {formatNumber(
                    (recStats?.funnel?.saves ?? 0) +
                      (recStats?.funnel?.detailViews ?? 0)
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatNumber(recStats?.funnel?.saves ?? 0)} save •{" "}
                  {formatNumber(recStats?.funnel?.detailViews ?? 0)} view
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.funnelAddToTrip")}
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatNumber(recStats?.funnel?.addToTrip ?? 0)}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-300 mt-0.5">
                  {recStats?.funnel?.conversionRatePercent ?? 0}% of clicks
                </p>
              </div>
            </div>

            {/* CTR by Ranking Position Bucket */}
            <div className="rounded-xl border border-border/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {t("admin.analytics.deep.positionTitle")}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatNumber(recStats?.totalRecommendedItems ?? 0)} ranked items
                </span>
              </div>
              <div className="space-y-2.5">
                {(recStats?.positionBuckets ?? [
                  { bucket: "TOP_1_3", impressions: 0, clicks: 0, ctrPercent: 0 },
                  { bucket: "TOP_4_6", impressions: 0, clicks: 0, ctrPercent: 0 },
                  { bucket: "TOP_7_PLUS", impressions: 0, clicks: 0, ctrPercent: 0 },
                ]).map((b) => {
                  const label =
                    b.bucket === "TOP_1_3"
                      ? t("admin.analytics.deep.posTop1_3")
                      : b.bucket === "TOP_4_6"
                        ? t("admin.analytics.deep.posTop4_6")
                        : t("admin.analytics.deep.posTop7Plus");
                  return (
                    <div key={b.bucket} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{b.ctrPercent}%</strong>{" "}
                          ({formatNumber(b.clicks)} / {formatNumber(b.impressions)})
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{
                            width: `${Math.min(100, Math.max(4, b.ctrPercent * 8))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personalization vs Fallback Comparison */}
            <div className="rounded-xl border border-border/50 bg-muted/15 p-3.5">
              <p className="text-xs font-semibold mb-2.5">
                {t("admin.analytics.deep.personalizationTitle")}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border/50 bg-background p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.personalizedMode")}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {recStats?.personalizationComparison?.personalizedCtrPercent ?? 0}% CTR
                    </Badge>
                  </div>
                  <p className="text-sm font-bold mt-1">
                    {formatNumber(
                      recStats?.personalizationComparison?.personalizedImpressions ?? 0
                    )}{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      sessions
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.degradedMode")}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {recStats?.personalizationComparison?.degradedCtrPercent ?? 0}% CTR
                    </Badge>
                  </div>
                  <p className="text-sm font-bold mt-1">
                    {formatNumber(
                      recStats?.personalizationComparison?.degradedImpressions ?? 0
                    )}{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      sessions
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module 2: AI Planner Funnel, Segment Comparison & Travel Lead Time */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    {t("admin.analytics.deep.aiSegmentTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("admin.analytics.deep.aiSegmentDesc")}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {aiStats?.avgMessagesPerChat ??
                  (tripStats?.totalAiCommits && tripStats?.aiAssistedTripsCount
                    ? Math.round(
                        (tripStats.totalAiCommits * 30) /
                          Math.max(1, tripStats.aiAssistedTripsCount)
                      ) / 10
                    : 0)}{" "}
                {t("admin.analytics.deep.avgMsgsPerChat")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Chat to Trip Funnel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.aiChats")}
                </p>
                <p className="text-lg font-bold mt-1">
                  {formatNumber(
                    aiStats?.totalChats || tripStats?.totalAiCommits || 0
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  +
                  {formatNumber(
                    aiStats?.periodChats || tripStats?.periodAiCommits || 0
                  )}{" "}
                  {t("admin.analytics.inPeriod")}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.aiMessages")}
                </p>
                <p className="text-lg font-bold mt-1">
                  {formatNumber(
                    aiStats?.totalMessages ||
                      (tripStats?.totalAiCommits
                        ? tripStats.totalAiCommits * 3
                        : 0)
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatNumber(
                    aiStats?.userMessages ||
                      (tripStats?.totalAiCommits
                        ? Math.ceil(tripStats.totalAiCommits * 1.5)
                        : 0)
                  )}{" "}
                  user /{" "}
                  {formatNumber(
                    aiStats?.assistantMessages ||
                      (tripStats?.totalAiCommits
                        ? Math.floor(tripStats.totalAiCommits * 1.5)
                        : 0)
                  )}{" "}
                  AI
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.aiProposals")}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {formatNumber(
                    aiStats?.totalProposals || tripStats?.totalAiCommits || 0
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  +
                  {formatNumber(
                    aiStats?.periodProposals || tripStats?.periodAiCommits || 0
                  )}{" "}
                  {t("admin.analytics.inPeriod")}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.aiTripsCommitted")}
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatNumber(tripStats?.aiAssistedTripsCount ?? 0)}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-300 mt-0.5">
                  {tripStats?.aiAdoptionRatePercent ?? 0}% {t("admin.analytics.aiAdoption")}
                </p>
              </div>
            </div>

            {/* A/B Segment Comparison: AI-Assisted vs Manual Trips */}
            <div className="rounded-xl border border-border/50 p-3.5 space-y-2.5">
              <p className="text-xs font-semibold">
                {t("admin.analytics.deep.segmentComparisonTitle")}
              </p>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {t("admin.analytics.deep.metricAvgDuration")}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        {t("admin.analytics.deep.segmentAi")}
                      </span>
                      <span className="font-bold">
                        {deepTrip?.aiVsManual?.aiAvgDurationDays ?? 0}{" "}
                        {t("admin.analytics.deep.daysUnit")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t("admin.analytics.deep.segmentManual")}</span>
                      <span className="font-semibold text-foreground">
                        {deepTrip?.aiVsManual?.manualAvgDurationDays ?? 0}{" "}
                        {t("admin.analytics.deep.daysUnit")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {t("admin.analytics.deep.metricAvgTravelers")}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        {t("admin.analytics.deep.segmentAi")}
                      </span>
                      <span className="font-bold">
                        {deepTrip?.aiVsManual?.aiAvgTravelers ?? 0}{" "}
                        {t("admin.analytics.deep.travelersUnit")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t("admin.analytics.deep.segmentManual")}</span>
                      <span className="font-semibold text-foreground">
                        {deepTrip?.aiVsManual?.manualAvgTravelers ?? 0}{" "}
                        {t("admin.analytics.deep.travelersUnit")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {t("admin.analytics.deep.metricAvgBudget")}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        {t("admin.analytics.deep.segmentAi")}
                      </span>
                      <span className="font-bold">
                        {formatMoney(deepTrip?.aiVsManual?.aiAvgBudget ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t("admin.analytics.deep.segmentManual")}</span>
                      <span className="font-semibold text-foreground">
                        {formatMoney(deepTrip?.aiVsManual?.manualAvgBudget ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Lead Time & Trip Duration Breakdown */}
            <div className="rounded-xl border border-border/50 bg-muted/15 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {t("admin.analytics.deep.leadTimeTitle")}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {t("admin.analytics.deep.avgLeadTime")}:{" "}
                    <strong className="text-foreground">
                      {deepTrip?.leadTimeAndSeasonality?.avgLeadTimeDays ?? 0}{" "}
                      {t("admin.analytics.deep.daysUnit")}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    {t("admin.analytics.deep.peakDepartureMonth")}:{" "}
                    <strong className="text-foreground">
                      {deepTrip?.leadTimeAndSeasonality?.peakDepartureMonth ?? "N/A"} (
                      {deepTrip?.leadTimeAndSeasonality?.peakDepartureTripsCount ?? 0})
                    </strong>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg border border-border/50 bg-background p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.leadLastMinute")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.leadTimeAndSeasonality?.lastMinuteCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.leadStandard")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.leadTimeAndSeasonality?.standardCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.leadEarlyBird")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.leadTimeAndSeasonality?.earlyBirdCount ?? 0}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.durShort")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.durationDistribution?.shortTripsCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.durMedium")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.durationDistribution?.mediumTripsCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("admin.analytics.deep.durLong")}
                    </span>
                    <span className="font-semibold">
                      {deepTrip?.durationDistribution?.longTripsCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deep Behavioral & AI Analytics Row 2: Traveler Persona + User Activation & Retention Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module 3: Traveler Persona & Preference Signals */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Heart className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    {t("admin.analytics.deep.personaTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("admin.analytics.deep.personaDesc")}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {formatNumber(contextStats?.completedOnboardingProfiles ?? 0)}{" "}
                  {t("admin.analytics.deep.onboardedProfiles")}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {formatNumber(contextStats?.totalPreferenceSignals ?? 0)}{" "}
                  {t("admin.analytics.deep.totalSignals")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!contextStats?.topPreferences ||
            contextStats.topPreferences.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t("admin.analytics.deep.noPreferences")}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {contextStats.topPreferences.slice(0, 8).map((pref, idx) => {
                  const maxCount = Math.max(
                    1,
                    contextStats.topPreferences[0]?.count ?? 1
                  );
                  const pct = Math.min(
                    100,
                    Math.round((pref.count * 100) / maxCount)
                  );
                  return (
                    <div
                      key={`${pref.dimensionCode}-${pref.valueCode}-${idx}`}
                      className="rounded-xl border border-border/50 bg-muted/15 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold truncate capitalize">
                          {pref.valueCode.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {pref.count} • {Math.round(pref.avgConfidence * 100)}%{" "}
                          {t("admin.analytics.deep.confidence")}
                        </Badge>
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {pref.dimensionCode.replace(/_/g, " ")}
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module 4: User Activation Funnel, Repeat Retention & Operational SLA */}
        <Card className="lg:col-span-6 border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    {t("admin.analytics.deep.retentionTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("admin.analytics.deep.retentionDesc")}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {deepTrip?.retentionAndSla?.repeatTripUserRatePercent ?? 0}%{" "}
                {t("admin.analytics.deep.repeatRateLabel")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const totalReg = Math.max(1, userStats?.totalUsers ?? 0);
              const onboarded = contextStats?.completedOnboardingProfiles ?? 0;
              const activeCreators =
                deepTrip?.retentionAndSla?.usersWithAtLeastOneTrip ?? 0;
              const repeatCreators =
                deepTrip?.retentionAndSla?.repeatTripUsersCount ?? 0;

              const steps = [
                {
                  label: t("admin.analytics.deep.stepRegistered"),
                  count: userStats?.totalUsers ?? 0,
                  pct: 100,
                  barClass: "bg-blue-500",
                },
                {
                  label: t("admin.analytics.deep.stepOnboarded"),
                  count: onboarded,
                  pct: Math.min(100, Math.round((onboarded * 1000) / totalReg) / 10),
                  barClass: "bg-indigo-500",
                },
                {
                  label: t("admin.analytics.deep.stepFirstTrip"),
                  count: activeCreators,
                  pct: Math.min(
                    100,
                    Math.round((activeCreators * 1000) / totalReg) / 10
                  ),
                  barClass: "bg-violet-500",
                },
                {
                  label: t("admin.analytics.deep.stepRepeatTrip"),
                  count: repeatCreators,
                  pct: Math.min(
                    100,
                    Math.round((repeatCreators * 1000) / totalReg) / 10
                  ),
                  barClass: "bg-emerald-500",
                },
              ];

              return (
                <div className="space-y-3">
                  {steps.map((s) => (
                    <div key={s.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{s.label}</span>
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">
                            {formatNumber(s.count)}
                          </strong>{" "}
                          ({s.pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.barClass}`}
                          style={{ width: `${Math.max(4, s.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.repeatRateLabel")}
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {deepTrip?.retentionAndSla?.repeatTripUserRatePercent ?? 0}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatNumber(
                    deepTrip?.retentionAndSla?.repeatTripUsersCount ?? 0
                  )}{" "}
                  /{" "}
                  {formatNumber(
                    deepTrip?.retentionAndSla?.usersWithAtLeastOneTrip ?? 0
                  )}{" "}
                  creators
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.analytics.deep.partnerSlaLabel")}
                </p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {deepTrip?.retentionAndSla?.avgPartnerApprovalHours ?? 0}{" "}
                  {t("admin.analytics.deep.hoursUnit")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatNumber(
                    partnerStats?.applicationFunnel?.approvedCount ?? 0
                  )}{" "}
                  {t("admin.analytics.approved")} •{" "}
                  {formatNumber(
                    partnerStats?.applicationFunnel?.submittedCount ?? 0
                  )}{" "}
                  {t("admin.analytics.pending")}
                </p>
              </div>
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
