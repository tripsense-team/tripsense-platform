"use client";

import * as React from "react";
import {
  CloudSun,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Sparkles,
  MapPin,
  Loader2,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import type { DestinationWeather, WeatherConditionType } from "../types";

interface DestinationWeatherWidgetProps {
  weather: DestinationWeather | null;
  selectedCity: string;
  onCityChange: (cityId: string) => void;
  loading?: boolean;
}

const CITY_OPTIONS = [
  { id: "dalat", nameVi: "Đà Lạt", nameEn: "Da Lat" },
  { id: "phuquoc", nameVi: "Phú Quốc", nameEn: "Phu Quoc" },
  { id: "danang", nameVi: "Đà Nẵng", nameEn: "Da Nang" },
  { id: "hanoi", nameVi: "Hà Nội", nameEn: "Ha Noi" },
  { id: "sapa", nameVi: "Sa Pa", nameEn: "Sa Pa" },
  { id: "ninhbinh", nameVi: "Ninh Bình", nameEn: "Ninh Binh" },
];

function WeatherIcon({
  type,
  className = "h-8 w-8",
}: {
  type: WeatherConditionType;
  className?: string;
}) {
  switch (type) {
    case "sunny":
      return <Sun className={`${className} text-amber-500 animate-pulse`} />;
    case "partlyCloudy":
      return <CloudSun className={`${className} text-sky-500`} />;
    case "rainy":
      return <CloudRain className={`${className} text-blue-500`} />;
    case "cool":
    case "cloudy":
    default:
      return <Wind className={`${className} text-teal-500`} />;
  }
}

export function DestinationWeatherWidget({
  weather,
  selectedCity,
  onCityChange,
  loading = false,
}: DestinationWeatherWidgetProps) {
  const { t, locale } = useTranslation();

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
      {/* Header with Title & City Selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
            <CloudSun className="h-5 w-5" />
          </div>
          <h2 className="font-bold text-sm sm:text-base text-foreground">
            {t("social.weatherByDestination")}
          </h2>
        </div>

        {/* City Select Dropdown */}
        <div className="relative">
          <select
            value={selectedCity}
            onChange={(e) => onCityChange(e.target.value)}
            aria-label={t("social.selectDestination")}
            className="h-8 rounded-full border border-border/80 bg-muted/60 px-3 pr-7 text-xs font-semibold text-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer appearance-none"
          >
            {CITY_OPTIONS.map((city) => (
              <option key={city.id} value={city.id}>
                {locale === "en" ? city.nameEn : city.nameVi}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-micro text-muted-foreground">
            ▼
          </div>
        </div>
      </div>

      {/* Weather Content */}
      {loading ? (
        <div className="mt-4 flex flex-col items-center justify-center p-8 text-muted-foreground gap-2 rounded-2xl bg-muted/30 border border-border/40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-medium">
            {t("social.loadingWeather")}
          </span>
        </div>
      ) : weather ? (
        <div className="mt-4">
          <div className="flex items-center justify-between rounded-2xl bg-linear-to-br from-sky-500/10 via-background to-primary/5 p-4 border border-sky-500/20">
            <div className="flex items-center gap-3.5">
              <WeatherIcon
                type={weather.iconType}
                className="h-10 w-10 shrink-0"
              />
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-foreground">
                    {weather.temperature}°
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    C
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground/80 mt-0.5">
                  {weather.conditionKey
                    ? t(`social.${weather.conditionKey}`)
                    : weather.condition}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block rounded-full bg-background/80 px-2.5 py-0.5 text-micro font-semibold text-muted-foreground border border-border/60">
                {weather.tempRange}
              </span>
              <div className="flex items-center justify-end gap-1 mt-1 text-micro text-muted-foreground">
                <Droplets className="h-3 w-3 text-sky-500" />
                <span>{weather.humidity}%</span>
              </div>
            </div>
          </div>

          {/* Travel suitability tip */}
          {weather.travelTip && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-snug">
                {weather.travelTipKey
                  ? t(`social.${weather.travelTipKey}`)
                  : weather.travelTip}
              </p>
            </div>
          )}

          {/* Footnote */}
          <div className="mt-3 flex items-center justify-between text-micro text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>
                {weather.cityKey
                  ? t(`social.${weather.cityKey}`)
                  : weather.cityName}
              </span>
            </span>
            <span>
              {weather.updatedAt === "Vừa cập nhật"
                ? t("social.justUpdated")
                : weather.updatedAt}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
