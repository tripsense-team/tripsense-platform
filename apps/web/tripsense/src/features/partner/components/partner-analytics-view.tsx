"use client";

import * as React from "react";
import { BarChart3, CalendarDays, CircleAlert, Eye, Users, Wallet } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { getPartnerAnalyticsDashboard, getPartnerContext } from "../services/partner-api";
import type { BusinessDetailDto, PartnerAnalyticsDashboardDto } from "../types";

type PeriodDays = 7 | 30 | 90;
type AnalyticsBusiness = PartnerAnalyticsDashboardDto["businesses"][number];

function TrendChart({ title, series, format, color, emptyLabel }: {
  title: string;
  series: Array<{ date: string; value: number }>;
  format: (value: number) => string;
  color: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...series.map((point) => point.value));
  const width = 720;
  const height = 190;
  const points = series.map((point, index) => ({
    ...point,
    x: series.length <= 1 ? width / 2 : (index / (series.length - 1)) * width,
    y: height - (point.value / max) * (height - 20) - 10,
  }));
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{format(series.reduce((sum, item) => sum + item.value, 0))}</span>
      </div>
      {series.every((point) => point.value === 0) ? (
        <p className="grid h-48 place-items-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-hidden" role="img" aria-label={title}>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" preserveAspectRatio="none">
            {[0, 1, 2, 3].map((line) => <line key={line} x1="0" x2={width} y1={(height / 3) * line} y2={(height / 3) * line} stroke="currentColor" className="text-border/60" strokeDasharray="3 5" />)}
            <polygon points={`0,${height} ${points.map((point) => `${point.x},${point.y}`).join(" ")} ${width},${height}`} fill={color} opacity="0.10" />
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill={color}><title>{point.date}: {format(point.value)}</title></circle>)}
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{series[0]?.date}</span><span>{series.at(-1)?.date}</span></div>
        </div>
      )}
    </section>
  );
}

export function PartnerAnalyticsView() {
  const { t, locale } = useTranslation();
  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [businessId, setBusinessId] = React.useState("all");
  const [periodDays, setPeriodDays] = React.useState<PeriodDays>(30);
  const [dashboard, setDashboard] = React.useState<PartnerAnalyticsDashboardDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getPartnerContext().then((context) => {
      if (!active) return;
      const eligible = (context.businesses || []).filter((business) =>
        (business.kind === "RESTAURANT" || business.kind === "HOTEL") &&
        (business.myRole === "OWNER" || business.myRole === "MANAGER") && business.operationState === "ACTIVE",
      );
      setBusinesses(eligible);
    }).catch((cause: unknown) => {
      if (active) setError(getSafeErrorMessage(cause, t("partner.analytics.loadError")));
    });
    return () => { active = false; };
  }, [t]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPartnerAnalyticsDashboard(periodDays, businessId === "all" ? undefined : businessId).then((result) => {
      if (active) setDashboard(result);
    }).catch((cause: unknown) => {
      if (active) {
        setDashboard(null);
        setError(getSafeErrorMessage(cause, t("partner.analytics.loadError")));
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, periodDays, t]);

  const selected = dashboard?.businesses ?? [];
  const restaurantMetrics = selected.filter((business) => business.kind === "RESTAURANT");
  const totals = React.useMemo(() => selected.reduce((acc, business) => ({
    views: acc.views + business.views,
    bookings: acc.bookings + business.bookings,
    expectedGuests: acc.expectedGuests + business.expectedGuests,
    earnings: acc.earnings + business.settledPartnerEarnings,
    viewsAvailable: acc.viewsAvailable || business.viewsAvailable,
    revenueAvailable: acc.revenueAvailable || business.revenueAvailable,
    revenueSources: acc.revenueSources + Number(business.revenueAvailable),
  }), { views: 0, bookings: 0, expectedGuests: 0, earnings: 0, viewsAvailable: false, revenueAvailable: false, revenueSources: 0 }), [selected]);
  const dates = selected[0]?.daily.map((item) => item.date) ?? [];
  const daily = dates.map((date) => selected.reduce((acc, business) => {
    const point = business.daily.find((entry) => entry.date === date);
    return { date, views: acc.views + (point?.views ?? 0), bookings: acc.bookings + (point?.bookings ?? 0), earnings: acc.earnings + (point?.settledPartnerEarnings ?? 0) };
  }, { date, views: 0, bookings: 0, earnings: 0 }));
  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const integer = (value: number) => new Intl.NumberFormat(localeTag).format(value);
  const percent = (numerator: number, denominator: number) => new Intl.NumberFormat(localeTag, { style: "percent", maximumFractionDigits: 1 }).format(denominator ? numerator / denominator : 0);
  const money = (value: number) => new Intl.NumberFormat(localeTag, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  const heading = businessId === "all" ? t("partner.analytics.allBusinesses") : businesses.find((item) => item.id === businessId)?.displayName ?? selected[0]?.displayName ?? "";

  const cards = [
    { title: t("partner.analytics.views"), value: totals.viewsAvailable ? integer(totals.views) : t("partner.analytics.unavailable"), Icon: Eye },
    { title: t("partner.analytics.requests"), value: integer(totals.bookings), Icon: CalendarDays },
    { title: t("partner.analytics.confirmationRate"), value: restaurantMetrics.length ? percent(restaurantMetrics.reduce((sum, item) => sum + item.confirmedBookings, 0), restaurantMetrics.reduce((sum, item) => sum + item.bookings, 0)) : t("partner.analytics.unavailable"), Icon: BarChart3 },
    { title: t("partner.analytics.cancellationRate"), value: restaurantMetrics.length ? percent(restaurantMetrics.reduce((sum, item) => sum + item.cancelledBookings, 0), restaurantMetrics.reduce((sum, item) => sum + item.confirmedBookings + item.cancelledBookings, 0)) : t("partner.analytics.unavailable"), Icon: CircleAlert },
  ];

  return (
    <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("partner.analytics.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("partner.analytics.description")}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{t("partner.analytics.business")}
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} className="h-10 min-w-52 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
              <option value="all">{t("partner.analytics.allBusinesses")}</option>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.displayName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{t("partner.analytics.period")}
            <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value) as PeriodDays)} className="h-10 min-w-40 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
              <option value={7}>{t("partner.analytics.days7")}</option><option value={30}>{t("partner.analytics.days30")}</option><option value={90}>{t("partner.analytics.days90")}</option>
            </select>
          </label>
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {!loading && businesses.length === 0 && !error && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t("partner.analytics.noBusinesses")}</div>}
      {loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border bg-muted/40" />)}</div>}
      {!loading && dashboard && selected.length > 0 && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{heading}</span><span>{dashboard.from} – {dashboard.toExclusive}</span></div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("partner.analytics.title")}>
          {cards.map(({ title, value, Icon }) => <article key={title} className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"><div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{title}</span><Icon className="h-4 w-4" aria-hidden="true" /></div><p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p></article>)}
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <TrendChart title={t("partner.analytics.viewsTrend")} series={daily.map((item) => ({ date: item.date, value: item.views }))} format={integer} color="#f59e0b" emptyLabel={totals.viewsAvailable ? t("partner.analytics.empty") : t("partner.analytics.unavailable")} />
          <TrendChart title={t("partner.analytics.bookingsTrend")} series={daily.map((item) => ({ date: item.date, value: item.bookings }))} format={integer} color="#2563eb" emptyLabel={t("partner.analytics.empty")} />
        </section>
        {totals.revenueAvailable && <TrendChart title={t("partner.analytics.earningsTrend")} series={daily.map((item) => ({ date: item.date, value: item.earnings }))} format={money} color="#059669" emptyLabel={t("partner.analytics.empty")} />}
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div><h2 className="font-semibold">{t("partner.analytics.expectedGuests")}</h2><p className="text-xs text-muted-foreground">{t("partner.analytics.expectedGuestsHint")}</p></div></div><p className="mt-4 text-3xl font-semibold">{integer(totals.expectedGuests)}</p></article>
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></div><div><h2 className="font-semibold">{t("partner.analytics.settledEarnings")}</h2><p className="text-xs text-muted-foreground">{t("partner.analytics.revenueCoverage", { supported: totals.revenueSources, total: selected.length })}</p></div></div><p className="mt-4 text-3xl font-semibold">{totals.revenueAvailable ? money(totals.earnings) : t("partner.analytics.unavailable")}</p></article>
        </section>
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"><h2 className="mb-4 font-semibold">{t("partner.analytics.businessBreakdown")}</h2><div className="space-y-3">{selected.map((business: AnalyticsBusiness) => <div key={business.businessId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4"><div><p className="font-medium">{business.displayName}</p><p className="text-xs text-muted-foreground">{t(business.kind === "HOTEL" ? "partner.analytics.hotel" : "partner.analytics.restaurant")}</p></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-sm"><span>{t("partner.analytics.requests")}: {integer(business.bookings)}</span><span>{t("partner.analytics.views")}: {business.viewsAvailable ? integer(business.views) : t("partner.analytics.unavailable")}</span><span>{t("partner.analytics.settledEarnings")}: {business.revenueAvailable ? money(business.settledPartnerEarnings) : t("partner.analytics.unavailable")}</span></div></div>)}</div></section>
      </>}
    </main>
  );
}
