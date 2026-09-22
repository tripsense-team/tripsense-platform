"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { profileService } from "@/features/profile";
import { useAuth, useAuthStore } from "@/features/auth";
import { cn } from "@/lib/utils";
import { onboardingApi } from "../services/onboarding-api";
import type { OnboardingProfile, PlaceIntent } from "../types";

type PreferenceStepDefinition = {
  dimension: string;
  single?: boolean;
  options: readonly string[];
};

const PREFERENCE_STEPS: readonly PreferenceStepDefinition[] = [
  {
    dimension: "TRAVEL_PARTY",
    single: true,
    options: ["SOLO", "COUPLE", "FRIENDS", "FAMILY"],
  },
  {
    dimension: "BUDGET_TIER",
    single: true,
    options: ["BUDGET", "MID_RANGE", "PREMIUM"],
  },
  {
    dimension: "STAY_STYLE",
    options: ["HOTEL", "HOMESTAY", "RESORT", "HOSTEL"],
  },
  {
    dimension: "FOOD_STYLE",
    options: ["LOCAL_FOOD", "STREET_FOOD", "FINE_DINING", "CAFE"],
  },
  {
    dimension: "ACTIVITY_INTEREST",
    options: ["NATURE", "HIKING", "CULTURE", "BEACH", "NIGHTLIFE"],
  },
];

interface CuratedDestination {
  id: string;
  name: string;
  flag?: string;
  region?: string;
}

const POPULAR_DESTINATIONS: readonly CuratedDestination[] = [
  // Vietnam destinations
  { id: "da-nang", name: "Đà Nẵng", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-lat", name: "Đà Lạt", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-noi", name: "Hà Nội", flag: "🇻🇳", region: "Vietnam" },
  { id: "ho-chi-minh", name: "TP. Hồ Chí Minh", flag: "🇻🇳", region: "Vietnam" },
  { id: "phu-quoc", name: "Phú Quốc", flag: "🇻🇳", region: "Vietnam" },
  { id: "hoi-an", name: "Hội An", flag: "🇻🇳", region: "Vietnam" },
  { id: "nha-trang", name: "Nha Trang", flag: "🇻🇳", region: "Vietnam" },
  { id: "sapa", name: "Sa Pa", flag: "🇻🇳", region: "Vietnam" },
  { id: "ninh-binh", name: "Ninh Bình", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-giang", name: "Hà Giang", flag: "🇻🇳", region: "Vietnam" },
  { id: "hue", name: "Huế", flag: "🇻🇳", region: "Vietnam" },
  { id: "quy-nhon", name: "Quy Nhơn", flag: "🇻🇳", region: "Vietnam" },
  { id: "vung-tau", name: "Vũng Tàu", flag: "🇻🇳", region: "Vietnam" },
  { id: "phong-nha", name: "Phong Nha", flag: "🇻🇳", region: "Vietnam" },
  { id: "can-tho", name: "Cần Thơ", flag: "🇻🇳", region: "Vietnam" },
  // International / Regional favorites
  { id: "bangkok", name: "Bangkok", flag: "🇹🇭", region: "Asia" },
  { id: "tokyo", name: "Tokyo", flag: "🇯🇵", region: "Asia" },
  { id: "singapore", name: "Singapore", flag: "🇸🇬", region: "Asia" },
  { id: "seoul", name: "Seoul", flag: "🇰🇷", region: "Asia" },
  { id: "bali", name: "Bali", flag: "🇮🇩", region: "Asia" },
  { id: "taipei", name: "Taipei", flag: "🇹🇼", region: "Asia" },
];

const POPULAR_HOME_CITIES: readonly CuratedDestination[] = [
  { id: "ho-chi-minh", name: "TP. Hồ Chí Minh", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-noi", name: "Hà Nội", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-nang", name: "Đà Nẵng", flag: "🇻🇳", region: "Vietnam" },
  { id: "can-tho", name: "Cần Thơ", flag: "🇻🇳", region: "Vietnam" },
  { id: "hai-phong", name: "Hải Phòng", flag: "🇻🇳", region: "Vietnam" },
  { id: "nha-trang", name: "Nha Trang", flag: "🇻🇳", region: "Vietnam" },
  { id: "hue", name: "Huế", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-lat", name: "Đà Lạt", flag: "🇻🇳", region: "Vietnam" },
  { id: "quy-nhon", name: "Quy Nhơn", flag: "🇻🇳", region: "Vietnam" },
  { id: "vung-tau", name: "Vũng Tàu", flag: "🇻🇳", region: "Vietnam" },
];

const QUICK_FREE_TEXT_TAGS = [
  { key: "quickTagPhoto", icon: "📸" },
  { key: "quickTagCafe", icon: "☕" },
  { key: "quickTagNature", icon: "🌲" },
  { key: "quickTagBeach", icon: "🏖️" },
  { key: "quickTagTrek", icon: "🥾" },
  { key: "quickTagVegetarian", icon: "🥗" },
];

export function toPlaceRef(name: string): string {
  return name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Step indices:
// 0: Name (displayName)
// 1: Home City (HOME_CITY)
// 2: Places Visited (VISITED)
// 3: Places Bucket List (WANT_TO_VISIT)
// 4: TRAVEL_PARTY
// 5: BUDGET_TIER
// 6: STAY_STYLE
// 7: FOOD_STYLE
// 8: ACTIVITY_INTEREST
// 9: Free text note (freeText)
const TOTAL_STEPS = 1 + 1 + 2 + PREFERENCE_STEPS.length + 1; // 10 steps total

export function OnboardingWizard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<OnboardingProfile | null>(null);
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [homeCity, setHomeCity] = React.useState("");
  const [freeText, setFreeText] = React.useState("");
  const [places, setPlaces] = React.useState<{
    VISITED: string[];
    WANT_TO_VISIT: string[];
  }>({
    VISITED: [],
    WANT_TO_VISIT: [],
  });
  const [customLabels, setCustomLabels] = React.useState<
    Record<string, string>
  >({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [homeCitySearchQuery, setHomeCitySearchQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    onboardingApi
      .get()
      .catch((err) =>
        err?.status === 404 ? onboardingApi.start() : Promise.reject(err),
      )
      .then((loadedProfile) => {
        if (!active) return;
        if (loadedProfile.status === "COMPLETED") {
          useAuthStore.getState().setOnboardingCompleted(true);
          router.replace("/explore");
          return;
        }
        setProfile(loadedProfile);
        if (loadedProfile.places) {
          setPlaces({
            VISITED: loadedProfile.places.VISITED ?? [],
            WANT_TO_VISIT: loadedProfile.places.WANT_TO_VISIT ?? [],
          });
        }
        if (loadedProfile.attributes?.HOME_CITY) {
          try {
            const parsed = JSON.parse(loadedProfile.attributes.HOME_CITY);
            setHomeCity(parsed.name || "");
          } catch {
            setHomeCity(loadedProfile.attributes.HOME_CITY);
          }
        }
        if (loadedProfile.freeText) {
          setFreeText(loadedProfile.freeText);
        }
      })
      .catch((err) => {
        if (active) setError(getSafeErrorMessage(err, t("errors.generic")));
      });

    return () => {
      active = false;
    };
  }, [router, t]);

  React.useEffect(() => {
    if (user?.name && !name) {
      setName(user.name);
    }
  }, [user, name]);

  const selection = profile?.selections ?? {};

  // For preference steps (step >= 4 && step <= 8)
  const currentPreferenceDef =
    step >= 4 && step <= 8 ? PREFERENCE_STEPS[step - 4] : null;

  const currentPlaceIntent: PlaceIntent | null =
    step === 2 ? "VISITED" : step === 3 ? "WANT_TO_VISIT" : null;

  const toggleOption = (dimension: string, value: string, single?: boolean) => {
    if (!profile) return;
    const currentValues = selection[dimension] ?? [];
    let nextValues: string[];
    if (single) {
      nextValues = [value];
    } else {
      nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
    }
    setProfile({
      ...profile,
      selections: { ...selection, [dimension]: nextValues },
    });
    setError("");
  };

  const togglePlace = (intent: PlaceIntent, ref: string) => {
    setPlaces((prev) => {
      const current = prev[intent] ?? [];
      const isAlreadySelected = current.includes(ref);
      let updated: string[];
      if (isAlreadySelected) {
        updated = current.filter((item) => item !== ref);
      } else {
        if (current.length >= 20) {
          setError(t("onboarding.placesMaxLimit"));
          return prev;
        }
        updated = [...current, ref];
      }
      return { ...prev, [intent]: updated };
    });
    setError("");
  };

  const handleAddCustomDestination = (intent: PlaceIntent) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const ref = toPlaceRef(trimmed);
    if (!ref) return;

    setCustomLabels((prev) => ({ ...prev, [ref]: trimmed }));
    togglePlace(intent, ref);
    setSearchQuery("");
  };

  const handleSelectHomeCity = (cityName: string) => {
    setHomeCity((prev) => (prev === cityName ? "" : cityName));
    setError("");
  };

  const handleAddCustomHomeCity = () => {
    const trimmed = homeCitySearchQuery.trim();
    if (!trimmed) return;
    setHomeCity(trimmed);
    setHomeCitySearchQuery("");
    setError("");
  };

  const handleAddQuickTag = (tagText: string) => {
    setFreeText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      if (trimmed.includes(tagText)) return trimmed;
      const combined = `${trimmed}, ${tagText}`;
      return combined.slice(0, 2000);
    });
  };

  const isCurrentStepValid = React.useMemo(() => {
    if (step === 0) {
      return name.trim().length > 0;
    }
    if (step === 1) {
      // Home city is optional/skippable
      return true;
    }
    if (step === 2 || step === 3) {
      // Destination selection is optional/skippable
      return true;
    }
    if (step >= 4 && step <= 8) {
      if (!currentPreferenceDef) return false;
      const currentValues = selection[currentPreferenceDef.dimension] ?? [];
      return currentValues.length > 0;
    }
    if (step === 9) {
      // Free text note is optional/skippable
      return freeText.length <= 2000;
    }
    return false;
  }, [step, name, currentPreferenceDef, selection, freeText]);

  const next = async () => {
    if (!isCurrentStepValid || saving) return;

    // Steps 0 to 8: Advance locally without calling any APIs
    if (step < TOTAL_STEPS - 1) {
      setError("");
      setSearchQuery("");
      setHomeCitySearchQuery("");
      setStep((prev) => prev + 1);
      return;
    }

    // Final step (Step 9: Free text): Batch save everything once!
    setSaving(true);
    setError("");

    try {
      if (name.trim() && user) {
        try {
          await profileService.updateProfile({ displayName: name.trim() });
        } catch {
          // Non-blocking if displayName update has issues
        }
      }

      // Filter out dimensions with empty arrays to satisfy backend validation
      const cleanSelections: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(selection)) {
        if (Array.isArray(values) && values.length > 0) {
          cleanSelections[key] = values;
        }
      }

      const cleanPlaces: Partial<Record<PlaceIntent, string[]>> = {
        VISITED: places.VISITED,
        WANT_TO_VISIT: places.WANT_TO_VISIT,
      };

      const cleanAttributes: Record<string, string> = {};
      if (homeCity.trim()) {
        cleanAttributes["HOME_CITY"] = JSON.stringify({
          name: homeCity.trim(),
          placeRef: toPlaceRef(homeCity.trim()),
          country: "Vietnam",
        });
      }

      const cleanFreeText = freeText.trim()
        ? freeText.trim().slice(0, 2000)
        : undefined;

      const saved = await onboardingApi.save({
        version: profile.version,
        selections: cleanSelections,
        places: cleanPlaces,
        attributes: cleanAttributes,
        freeText: cleanFreeText,
      });

      const completed = await onboardingApi.complete(saved.version);
      setProfile(completed);
      await onboardingApi.markProfileComplete();
      useAuthStore.getState().setOnboardingCompleted(true);
      router.replace("/explore");
    } catch (err) {
      setError(getSafeErrorMessage(err, t("errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  const prev = () => {
    if (step > 0 && !saving) {
      setError("");
      setSearchQuery("");
      setHomeCitySearchQuery("");
      setStep((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    router.push("/explore");
  };

  // Filtered popular destinations based on search query
  const filteredDestinations = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return POPULAR_DESTINATIONS;
    return POPULAR_DESTINATIONS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.region && d.region.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  // Combined list of popular + custom destinations selected
  const allCurrentDestinations = React.useMemo(() => {
    if (!currentPlaceIntent) return [];
    const selectedList = places[currentPlaceIntent] ?? [];
    const result: CuratedDestination[] = [...filteredDestinations];

    // Append any selected custom destinations not in the curated list
    selectedList.forEach((ref) => {
      if (!result.some((d) => d.id === ref)) {
        result.unshift({
          id: ref,
          name: customLabels[ref] || ref,
          flag: "📍",
          region: "Custom",
        });
      }
    });

    return result;
  }, [currentPlaceIntent, places, filteredDestinations, customLabels]);

  // Filtered home cities based on query
  const filteredHomeCities = React.useMemo(() => {
    const q = homeCitySearchQuery.trim().toLowerCase();
    if (!q) return POPULAR_HOME_CITIES;
    return POPULAR_HOME_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [homeCitySearchQuery]);

  if (!profile) {
    return (
      <main className="min-h-screen w-full grid place-items-center bg-background text-muted-foreground p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-md animate-pulse">
            <Sparkles className="size-7" />
          </div>
          <p className="text-sm font-medium">{error || t("common.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row bg-background text-foreground overflow-hidden">
      {/* Left Column: Form & Interaction */}
      <div className="flex w-full lg:w-[48%] xl:w-[45%] flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 h-screen overflow-y-auto">
        {/* Header: Close button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Center: Interactive Step Content */}
        <div className="mx-auto my-auto w-full max-w-lg py-8">
          {/* AI Badge */}
          <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-xs">
            <Sparkles className="size-6" />
          </div>

          {/* Heading & Subtitle */}
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {step === 0 && t("onboarding.name")}
              {step === 1 && t("onboarding.homeCity.title")}
              {step === 2 && t("onboarding.placesVisited.title")}
              {step === 3 && t("onboarding.placesBucketList.title")}
              {step >= 4 &&
                step <= 8 &&
                currentPreferenceDef &&
                t(`onboarding.${currentPreferenceDef.dimension}.title`)}
              {step === 9 && t("onboarding.freeTextNote.title")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {step === 0 && t("onboarding.eyebrow")}
              {step === 1 && t("onboarding.homeCity.subtitle")}
              {step === 2 && t("onboarding.placesVisited.subtitle")}
              {step === 3 && t("onboarding.placesBucketList.subtitle")}
              {step >= 4 &&
                step <= 8 &&
                currentPreferenceDef &&
                t(`onboarding.${currentPreferenceDef.dimension}.subtitle`)}
              {step === 9 && t("onboarding.freeTextNote.subtitle")}
            </p>
          </div>

          {/* Step 0: Display Name Input */}
          {step === 0 && (
            <div className="space-y-4">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isCurrentStepValid && !saving) {
                    e.preventDefault();
                    next();
                  }
                }}
                placeholder={t("onboarding.namePlaceholder")}
                className="h-14 rounded-full border-border/80 bg-background px-6 text-base shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            </div>
          )}

          {/* Step 1: Home City (Attributes) */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Search or Custom input */}
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={homeCitySearchQuery}
                  onChange={(e) => setHomeCitySearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomHomeCity();
                    }
                  }}
                  placeholder={t("onboarding.homeCity.placeholder")}
                  className="h-12 rounded-full border-border/80 bg-background pl-10 pr-24 text-sm shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-ring"
                />
                {homeCitySearchQuery.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCustomHomeCity}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 rounded-full px-3 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium"
                  >
                    <Plus className="mr-1 size-3.5" />
                    {t("onboarding.placesCustomAdd", {
                      name: homeCitySearchQuery.trim(),
                    })}
                  </Button>
                )}
              </div>

              {/* Selected Home City Display (if custom) */}
              {homeCity &&
                !POPULAR_HOME_CITIES.some((c) => c.name === homeCity) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">
                      {t("common.selected")}:
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground text-background px-3 py-1 text-xs font-semibold">
                      📍 {homeCity}
                      <button
                        type="button"
                        onClick={() => setHomeCity("")}
                        className="ml-1 hover:opacity-75 cursor-pointer"
                        aria-label="Remove"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  </div>
                )}

              {/* Popular Home Cities Chips */}
              <div className="flex flex-wrap gap-2.5 max-h-[280px] overflow-y-auto pr-1 py-1">
                {filteredHomeCities.map((city) => {
                  const isSelected = homeCity === city.name;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => handleSelectHomeCity(city.name)}
                      className={cn(
                        "group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-foreground bg-foreground text-background shadow-xs"
                          : "border-border/80 bg-background hover:border-foreground/40 hover:bg-accent text-foreground",
                      )}
                    >
                      {city.flag && (
                        <span className="text-base leading-none">
                          {city.flag}
                        </span>
                      )}
                      <span>{city.name}</span>
                      <div
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full transition-all ml-1",
                          isSelected
                            ? "bg-background text-foreground"
                            : "border border-border/70 group-hover:border-foreground/50",
                        )}
                      >
                        {isSelected && (
                          <Check className="size-2.5 stroke-[3]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Steps 2 & 3: Places Selection (VISITED & WANT_TO_VISIT) */}
          {(step === 2 || step === 3) && currentPlaceIntent && (
            <div className="space-y-4">
              {/* Search / Add Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomDestination(currentPlaceIntent);
                    }
                  }}
                  placeholder={t("onboarding.placesSearchPlaceholder")}
                  className="h-12 rounded-full border-border/80 bg-background pl-10 pr-24 text-sm shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-ring"
                />
                {searchQuery.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleAddCustomDestination(currentPlaceIntent)
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 rounded-full px-3 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium"
                  >
                    <Plus className="mr-1 size-3.5" />
                    {t("onboarding.placesCustomAdd", {
                      name: searchQuery.trim(),
                    })}
                  </Button>
                )}
              </div>

              {/* Destination Chips Container */}
              <div className="flex flex-wrap gap-2.5 max-h-[300px] overflow-y-auto pr-1 py-1">
                {allCurrentDestinations.map((dest) => {
                  const isSelected = (
                    places[currentPlaceIntent] ?? []
                  ).includes(dest.id);
                  return (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => togglePlace(currentPlaceIntent, dest.id)}
                      className={cn(
                        "group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-foreground bg-foreground text-background shadow-xs"
                          : "border-border/80 bg-background hover:border-foreground/40 hover:bg-accent text-foreground",
                      )}
                    >
                      {dest.flag && (
                        <span className="text-base leading-none">
                          {dest.flag}
                        </span>
                      )}
                      <span>{dest.name}</span>
                      <div
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full transition-all ml-1",
                          isSelected
                            ? "bg-background text-foreground"
                            : "border border-border/70 group-hover:border-foreground/50",
                        )}
                      >
                        {isSelected && (
                          <Check className="size-2.5 stroke-[3]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Counter & Clear All */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  {t("onboarding.placesSelectedCount", {
                    count: (places[currentPlaceIntent] ?? []).length,
                  })}
                </span>
                {(places[currentPlaceIntent] ?? []).length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPlaces((prev) => ({
                        ...prev,
                        [currentPlaceIntent]: [],
                      }))
                    }
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    {t("common.clear")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Steps 4..8: Preference Options */}
          {step >= 4 && step <= 8 && currentPreferenceDef && (
            <div className="space-y-3">
              {currentPreferenceDef.options.map((optionValue) => {
                const isSelected = (
                  selection[currentPreferenceDef.dimension] ?? []
                ).includes(optionValue);
                return (
                  <button
                    key={optionValue}
                    type="button"
                    onClick={() =>
                      toggleOption(
                        currentPreferenceDef.dimension,
                        optionValue,
                        currentPreferenceDef.single,
                      )
                    }
                    className={cn(
                      "group flex w-full h-14 items-center justify-between rounded-full border px-6 text-left font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-foreground bg-foreground text-background shadow-xs"
                        : "border-border/80 bg-background hover:border-foreground/40 hover:bg-accent text-foreground",
                    )}
                  >
                    <span className="text-sm sm:text-base">
                      {t(`onboarding.option.${optionValue}`)}
                    </span>
                    <div
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full transition-all",
                        isSelected
                          ? "bg-background text-foreground"
                          : "border border-border/80 group-hover:border-foreground/40",
                      )}
                    >
                      {isSelected && (
                        <Check className="size-3.5 stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 9: Free Text Note (onboarding_free_text) */}
          {step === 9 && (
            <div className="space-y-4">
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value.slice(0, 2000))}
                placeholder={t("onboarding.freeTextNote.placeholder")}
                rows={5}
                className="w-full resize-none rounded-2xl border border-border/80 bg-background p-4 text-sm leading-relaxed shadow-2xs transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("onboarding.freeTextNote.charCount", {
                    current: freeText.length,
                    max: 2000,
                  })}
                </span>
                {freeText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFreeText("")}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    {t("common.clear")}
                  </button>
                )}
              </div>

              {/* Quick Idea Chips */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("common.suggestions")}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_FREE_TEXT_TAGS.map((tag) => {
                    const tagLabel = t(`onboarding.freeTextNote.${tag.key}`);
                    return (
                      <button
                        key={tag.key}
                        type="button"
                        onClick={() => handleAddQuickTag(tagLabel)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-accent/30 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-accent hover:border-foreground/30 cursor-pointer select-none"
                      >
                        <span>{tag.icon}</span>
                        <span>{tagLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer: Progress & Navigation */}
        <div className="w-full space-y-4 pt-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {t("onboarding.progress", {
                  current: step + 1,
                  total: TOTAL_STEPS,
                })}
              </span>
              <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-foreground transition-all duration-300 ease-out"
                style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {/* Back & Next Actions */}
          <div className="flex items-center justify-between gap-4 pt-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={prev}
                disabled={saving}
                className="h-12 rounded-full border-border/80 px-6 font-medium text-foreground hover:bg-accent"
              >
                <ChevronLeft className="mr-1 size-4" />
                {t("common.back")}
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="button"
              size="lg"
              onClick={next}
              disabled={!isCurrentStepValid || saving}
              loading={saving}
              loadingText={t("onboarding.saving")}
              className="ml-auto h-12 rounded-full bg-foreground px-8 font-medium text-background hover:bg-foreground/90 disabled:opacity-40"
            >
              <span>
                {step === TOTAL_STEPS - 1
                  ? t("onboarding.finish")
                  : t("auth.continue")}
              </span>
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Visual Mindtrip Style */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] h-screen p-4 lg:p-6 items-center justify-center bg-background">
        <div className="relative h-full w-full overflow-hidden rounded-3xl xl:rounded-[36px] bg-[#0094FF] shadow-2xl">
          <Image
            src="/onboarding-hero.png"
            alt="TripSense AI Travel"
            fill
            priority
            className="object-cover object-center"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
        </div>
      </div>
    </div>
  );
}
