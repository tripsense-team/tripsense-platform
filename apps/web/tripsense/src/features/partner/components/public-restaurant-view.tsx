"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Compass,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { getPublicRestaurant } from "../services/partner-api";
import { RestaurantReservationDialog } from "./restaurant-reservation-dialog";
import type { PublicRestaurantListingDto } from "../types";

interface PublicRestaurantViewProps {
  businessId: string;
}

export function PublicRestaurantView({ businessId }: PublicRestaurantViewProps) {
  const { t } = useTranslation();
  const [data, setData] = React.useState<PublicRestaurantListingDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reservationOpen, setReservationOpen] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getPublicRestaurant(businessId);
        setData(res);
      } catch (err: unknown) {
        setError(getSafeErrorMessage(err, t("partner.restaurant.notFound", { defaultValue: "Không tìm thấy thông tin nhà hàng hoặc nhà hàng chưa công khai." })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [businessId, t]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
          <Store className="mx-auto h-12 w-12 mb-3 opacity-60" />
          <h2 className="text-lg font-bold mb-1">
            {t("partner.restaurant.unavailableTitle", { defaultValue: "Nhà hàng hiện chưa sẵn sàng" })}
          </h2>
          <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">
            {error || t("partner.restaurant.notFound", { defaultValue: "Không tìm thấy thông tin nhà hàng hoặc nhà hàng chưa công khai." })}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/explore">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("places.exploreThisArea", { defaultValue: "Khám phá địa điểm khác" })}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${data.displayName} ${data.address || data.destination || ""}`,
  )}`;

  // Group menu by category
  const categoriesMap = new Map<string, typeof data.menu>();
  const uncategorized: typeof data.menu = [];

  (data.menu || []).forEach((item) => {
    if (item.category && item.category.trim()) {
      const cat = item.category.trim();
      const list = categoriesMap.get(cat) || [];
      list.push(item);
      categoriesMap.set(cat, list);
    } else {
      uncategorized.push(item);
    }
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Link href="/explore">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            {t("places.exploreThisArea", { defaultValue: "Khám phá" })}
          </Link>
        </Button>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                <Utensils className="mr-1 h-3 w-3" /> Nhà hàng ẩm thực
              </Badge>
              {data.destination && (
                <Badge variant="secondary" className="text-xs">
                  {data.destination}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {data.displayName}
            </h1>

            {data.address && (
              <p className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span>{data.address}</span>
              </p>
            )}

            {data.openingHours && (
              <p className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{data.openingHours}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setReservationOpen(true)}
              className="h-9 shadow-xs gap-1.5 font-medium"
            >
              <Utensils className="h-4 w-4" />
              {t("restaurant.reserveTable", { defaultValue: "Đặt bàn & Giữ chỗ" })}
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9 shadow-xs gap-1.5 font-medium">
              <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
                <Compass className="h-4 w-4" />
                {t("places.getDirections", { defaultValue: "Chỉ đường" })}
              </a>
            </Button>
          </div>
        </div>

        {/* Cuisine Tags */}
        {data.cuisineTags && data.cuisineTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/50">
            {data.cuisineTags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Consented Contact Info */}
        {(data.publicPhone || data.publicEmail) && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            {data.publicPhone && (
              <a
                href={`tel:${data.publicPhone}`}
                className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>{data.publicPhone}</span>
              </a>
            )}
            {data.publicEmail && (
              <a
                href={`mailto:${data.publicEmail}`}
                className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span>{data.publicEmail}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Menu Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            {t("partner.restaurant.publicMenuTitle", { defaultValue: "Thực đơn món ăn" })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {data.menu.length} {t("partner.restaurant.dishesCount", { defaultValue: "món phục vụ" })}
          </span>
        </div>

        {data.menu.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40">
            <Utensils className="mx-auto h-10 w-10 text-muted-foreground/60 mb-2" />
            <p className="text-xs text-muted-foreground">
              {t("partner.restaurant.publicMenuEmpty", { defaultValue: "Nhà hàng hiện chưa cập nhật thực đơn chi tiết trực tuyến." })}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(categoriesMap.entries()).map(([category, itemsList]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-base font-bold text-foreground border-l-2 border-primary pl-2.5">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {itemsList.map((dish, dIdx) => (
                    <Card key={dIdx} className="shadow-2xs border-border/70 hover:border-primary/40 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {dish.name}
                          </CardTitle>
                          <span className="font-bold font-mono text-sm text-primary shrink-0">
                            {new Intl.NumberFormat("vi-VN", {
                              style: "currency",
                              currency: dish.currency || "VND",
                            }).format(dish.price)}
                          </span>
                        </div>
                        {dish.description && (
                          <CardDescription className="text-xs line-clamp-2">
                            {dish.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      {dish.tags && dish.tags.length > 0 && (
                        <CardContent className="pt-0 pb-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {dish.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="rounded-md bg-muted px-1.5 py-0.5 text-micro text-muted-foreground"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {uncategorized.length > 0 && (
              <div className="space-y-3">
                {categoriesMap.size > 0 && (
                  <h3 className="text-base font-bold text-foreground border-l-2 border-primary pl-2.5">
                    {t("partner.restaurant.otherDishes", { defaultValue: "Món ăn khác" })}
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uncategorized.map((dish, dIdx) => (
                    <Card key={dIdx} className="shadow-2xs border-border/70 hover:border-primary/40 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {dish.name}
                          </CardTitle>
                          <span className="font-bold font-mono text-sm text-primary shrink-0">
                            {new Intl.NumberFormat("vi-VN", {
                              style: "currency",
                              currency: dish.currency || "VND",
                            }).format(dish.price)}
                          </span>
                        </div>
                        {dish.description && (
                          <CardDescription className="text-xs line-clamp-2">
                            {dish.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <RestaurantReservationDialog
        businessId={businessId}
        restaurantName={data.displayName}
        open={reservationOpen}
        onOpenChange={setReservationOpen}
      />
    </div>
  );
}
