"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BedDouble, Compass, MessageSquareText, RefreshCw, Store, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getPartnerContext } from "../services/partner-api";
import type { BusinessDetailDto } from "../types";
import { getPartnerServiceActions, type PartnerServiceAction } from "../utils/partner-service-actions";

function ServiceActionLink({ action }: { action: PartnerServiceAction }) {
  const { t } = useTranslation();
  const Icon = action.icon === "restaurant"
    ? Utensils
    : action.icon === "hotel"
      ? BedDouble
      : action.icon === "inquiries"
        ? MessageSquareText
        : Compass;

  return (
    <Button asChild variant="outline" className="h-auto min-h-11 w-full justify-between px-3 py-2 text-left sm:w-auto sm:min-w-56">
      <Link href={action.href}>
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{t(`partner.servicesHub.${action.key}`)}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </Button>
  );
}

function BusinessServiceCard({ business }: { business: BusinessDetailDto }) {
  const { t } = useTranslation();
  const kindMeta = {
    HOTEL: { label: "typeHotel", Icon: BedDouble },
    RESTAURANT: { label: "typeRestaurant", Icon: Utensils },
    TOUR_GUIDE: { label: "typeGuide", Icon: Compass },
  }[business.kind];
  const actions = getPartnerServiceActions(business);

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary">
              <kindMeta.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{business.displayName}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t(`partner.servicesHub.${kindMeta.label}`)}</p>
            </div>
          </div>
          {business.myRole && <Badge variant="outline" className="shrink-0">{business.myRole}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {actions.length ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions.map((action) => <ServiceActionLink key={action.key} action={action} />)}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            {t("partner.servicesHub.capabilitiesMissing")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PartnerServicesHubView() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isPartner = isUserPartner(user);
  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestVersion = React.useRef(0);

  const loadBusinesses = React.useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const context = await getPartnerContext();
      if (version === requestVersion.current) {
        setBusinesses(Array.isArray(context.businesses) ? context.businesses : []);
      }
    } catch (err: unknown) {
      if (version === requestVersion.current) {
        setError(getSafeErrorMessage(err, t("partner.servicesHub.loadError")));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!isPartner) {
      requestVersion.current += 1;
      router.replace("/partner");
      return;
    }
    void Promise.resolve().then(() => loadBusinesses());
    return () => { requestVersion.current += 1; };
  }, [isAuthLoading, isPartner, user?.id, loadBusinesses, router]);

  if (!isAuthLoading && !isPartner) return null;

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8 sm:space-y-8 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/partner"><ArrowLeft className="h-4 w-4" />{t("partner.servicesHub.backToCenter")}</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("partner.servicesHub.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("partner.servicesHub.description")}
          </p>
        </div>
        {isPartner && (
          <Button variant="outline" size="sm" onClick={() => void loadBusinesses()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-border bg-muted/40" />)}
          <span className="sr-only">{t("partner.servicesHub.loading")}</span>
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadBusinesses()}>
            <RefreshCw className="h-4 w-4" />{t("partner.servicesHub.retry")}
          </Button>
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-6 w-6" /></span>
            <h2 className="text-lg font-semibold text-foreground">{t("partner.servicesHub.businessesEmptyTitle")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">{t("partner.servicesHub.businessesEmptyDescription")}</p>
            <Button asChild variant="outline"><Link href="/partner">{t("partner.servicesHub.backToCenter")}</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <section aria-label={t("partner.servicesHub.title")} className="grid gap-4 md:grid-cols-2">
          {businesses.map((business) => <BusinessServiceCard key={business.id} business={business} />)}
        </section>
      )}
    </main>
  );
}
