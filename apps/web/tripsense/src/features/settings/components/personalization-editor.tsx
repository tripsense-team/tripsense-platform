"use client";

import * as React from "react";
import {
  Sparkles,
  MapPin,
  Check,
  Plus,
  X,
  Loader2,
  RotateCcw,
  Save,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  onboardingApi,
  PREFERENCE_STEPS,
  POPULAR_DESTINATIONS,
  POPULAR_HOME_CITIES,
  QUICK_FREE_TEXT_TAGS,
  toPlaceRef,
  toOptionCode,
  type OnboardingProfile,
  type UpdateOnboardingRequest,
} from "@/features/onboarding";

export function PersonalizationEditor() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  // Data loading & saving state
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<OnboardingProfile | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Form states matching onboarding fields exactly
  const [homeCity, setHomeCity] = React.useState("");
  const [visitedPlaces, setVisitedPlaces] = React.useState<string[]>([]);
  const [wishlistPlaces, setWishlistPlaces] = React.useState<string[]>([]);
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});
  const [freeText, setFreeText] = React.useState("");
  const [customLabels, setCustomLabels] = React.useState<Record<string, string>>({});

  // Add place search modal/popover state
  const [addingTarget, setAddingTarget] = React.useState<"VISITED" | "WANT_TO_VISIT" | null>(null);
  const [placeSearch, setPlaceSearch] = React.useState("");

  // Custom preference option input state
  const [addingCustomDim, setAddingCustomDim] = React.useState<string | null>(null);
  const [customInputText, setCustomInputText] = React.useState("");

  // Load existing profile from backend
  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await onboardingApi.get();
      setProfile(data);

      // Home city parsing: handles JSON { name, placeRef } or raw string
      let cityName = "";
      if (data.attributes?.HOME_CITY) {
        try {
          const parsed = JSON.parse(data.attributes.HOME_CITY);
          cityName = parsed?.name || data.attributes.HOME_CITY;
        } catch {
          cityName = data.attributes.HOME_CITY;
        }
      }
      setHomeCity(cityName);
      setVisitedPlaces(data.places?.VISITED || []);
      setWishlistPlaces(data.places?.WANT_TO_VISIT || []);
      setSelections(data.selections || {});
      setFreeText(data.freeText || "");

      // Load custom option display labels if stored
      if (data.attributes?.CUSTOM_PREFERENCE_LABELS) {
        try {
          const customMap = JSON.parse(data.attributes.CUSTOM_PREFERENCE_LABELS);
          if (customMap && typeof customMap === "object") {
            setCustomLabels(customMap);
          }
        } catch {
          // ignore parsing error
        }
      }
    } catch {
      setErrorMessage(
        t("settings.personalization.loadError", {
          defaultValue: isEn
            ? "Unable to load personalization profile. Please try again."
            : "Không thể tải hồ sơ cá nhân hóa. Vui lòng thử lại.",
        })
      );
    } finally {
      setLoading(false);
    }
  }, [isEn, t]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Helpers to resolve human readable destination names
  const getDestinationLabel = (id: string) => {
    const found = POPULAR_DESTINATIONS.find((d) => d.id === id);
    if (found) return `${found.flag ? `${found.flag} ` : ""}${found.name}`;
    // Convert kebab case to Title Case if custom
    return id
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Tag removal
  const removeVisited = (id: string) => {
    setVisitedPlaces((prev) => prev.filter((p) => p !== id));
  };

  const removeWishlist = (id: string) => {
    setWishlistPlaces((prev) => prev.filter((p) => p !== id));
  };

  // Add destination
  const handleAddDestination = (destId: string) => {
    const cleaned = toPlaceRef(destId);
    if (!cleaned) return;

    if (addingTarget === "VISITED") {
      if (!visitedPlaces.includes(cleaned)) {
        setVisitedPlaces((prev) => [...prev, cleaned]);
      }
    } else if (addingTarget === "WANT_TO_VISIT") {
      if (!wishlistPlaces.includes(cleaned)) {
        setWishlistPlaces((prev) => [...prev, cleaned]);
      }
    }
    setPlaceSearch("");
    setAddingTarget(null);
  };

  // Preference option toggle
  const toggleOption = (dimension: string, option: string, single?: boolean) => {
    setSelections((prev) => {
      const current = prev[dimension] || [];
      if (single) {
        return { ...prev, [dimension]: [option] };
      }
      if (current.includes(option)) {
        const next = current.filter((o) => o !== option);
        return { ...prev, [dimension]: next };
      }
      return { ...prev, [dimension]: [...current, option] };
    });
  };

  // Add custom option to a dimension
  const handleAddCustomOption = (dimension: string, single?: boolean) => {
    if (!customInputText.trim()) return;
    const raw = customInputText.trim();
    const code = toOptionCode(raw);
    setCustomLabels((prev) => ({ ...prev, [code]: raw }));
    toggleOption(dimension, code, single);
    setCustomInputText("");
    setAddingCustomDim(null);
  };

  // Remove custom option completely
  const handleRemoveCustomOption = (dimension: string, optionCode: string) => {
    setSelections((prev) => {
      const current = prev[dimension] || [];
      return { ...prev, [dimension]: current.filter((o) => o !== optionCode) };
    });
    setCustomLabels((prev) => {
      const next = { ...prev };
      delete next[optionCode];
      return next;
    });
  };

  // Quick tag append for freeText
  const handleToggleQuickTag = (tagKey: string) => {
    const tagText = t(`onboarding.freeTextNote.${tagKey}`, { defaultValue: tagKey });
    setFreeText((prev) => {
      if (prev.includes(tagText)) {
        return prev.replace(tagText, "").replace(/,\s*,/g, ",").trim();
      }
      return prev ? `${prev}, ${tagText}` : tagText;
    });
  };

  // Save changes
  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      setSaveSuccess(false);

      // 1. Filter out dimensions with empty arrays to satisfy backend validation
      const cleanSelections: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(selections)) {
        if (Array.isArray(values) && values.length > 0) {
          cleanSelections[key] = values;
        }
      }

      // 2. Attributes MUST be valid JSON strings for PostgreSQL JSONB column
      const cleanAttributes: Record<string, string> = {};
      if (homeCity.trim()) {
        cleanAttributes["HOME_CITY"] = JSON.stringify({
          name: homeCity.trim(),
          placeRef: toPlaceRef(homeCity.trim()),
          country: "Vietnam",
        });
      }
      if (Object.keys(customLabels).length > 0) {
        cleanAttributes["CUSTOM_PREFERENCE_LABELS"] = JSON.stringify(customLabels);
      }

      const payload: UpdateOnboardingRequest = {
        version: profile.version,
        selections: cleanSelections,
        places: {
          VISITED: visitedPlaces,
          WANT_TO_VISIT: wishlistPlaces,
        },
        attributes: cleanAttributes,
        freeText: freeText.trim() ? freeText.trim().slice(0, 2000) : undefined,
      };

      const updatedProfile = await onboardingApi.save(payload);
      setProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      setErrorMessage(
        msg ||
          t("settings.personalization.saveError", {
            defaultValue: isEn
              ? "Failed to save preferences. Please check your network or try again."
              : "Lưu tùy chỉnh thất bại. Vui lòng kiểm tra kết nối mạng hoặc thử lại.",
          })
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-3">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground animate-pulse">
          {isEn
            ? "Loading your personalization preferences..."
            : "Đang tải hồ sơ cá nhân hóa của bạn..."}
        </p>
      </div>
    );
  }

  // Filter popular suggestions for quick search popover
  const filteredDestinations = POPULAR_DESTINATIONS.filter((d) =>
    d.name.toLowerCase().includes(placeSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("settings.personalization.title", { defaultValue: isEn ? "Personalization" : "Cá nhân hóa" })}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.personalization.subtitle", {
                defaultValue: isEn
                  ? "Fine-tune the travel profile and preferences you configured during onboarding."
                  : "Chỉnh sửa chính xác các sở thích du lịch và dữ liệu bạn đã thiết lập ở bước Onboarding.",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>
            {t("settings.personalization.successMessage", {
              defaultValue: isEn
                ? "Personalization preferences updated successfully!"
                : "Đã cập nhật tùy chọn cá nhân hóa thành công!",
            })}
          </span>
        </div>
      )}

      {/* SECTION 1: EXPERIENCES & DESTINATIONS (ONBOARDING PLACES) */}
      <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {t("settings.personalization.experiencesTitle", {
              defaultValue: isEn ? "Experiences & Destinations" : "Kinh nghiệm & Điểm đến",
            })}
          </h2>
          <p className="text-micro text-muted-foreground mt-0.5">
            {t("settings.personalization.experiencesSubtitle", {
              defaultValue: isEn
                ? "Places you have visited and bucket list destinations you dream of exploring"
                : "Các địa điểm bạn đã từng ghé thăm và danh sách điểm đến mong muốn",
            })}
          </p>
        </div>

        {/* Countries / Places Visited */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span className="text-amber-500">✨</span>
              <span>
                {t("settings.personalization.visitedTitle", {
                  defaultValue: isEn ? "Places Visited:" : "Địa điểm đã đến:",
                })}
              </span>
              <span className="text-micro text-muted-foreground font-normal">
                ({visitedPlaces.length})
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAddingTarget("VISITED");
                setPlaceSearch("");
              }}
              className="h-7 text-micro rounded-lg border-border/60 hover:border-primary hover:text-primary gap-1 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>
                {t("settings.personalization.addDestination", {
                  defaultValue: isEn ? "Add destination" : "Thêm địa điểm",
                })}
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border border-border/40 min-h-[46px] items-center">
            {visitedPlaces.length === 0 ? (
              <span className="text-micro text-muted-foreground italic">
                {t("settings.personalization.noVisited", {
                  defaultValue: isEn ? "No visited destinations added yet." : "Chưa có địa điểm nào được chọn.",
                })}
              </span>
            ) : (
              visitedPlaces.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-micro font-medium bg-background border border-border/70 text-foreground shadow-2xs group hover:border-destructive/40 transition-colors"
                >
                  <span>{getDestinationLabel(id)}</span>
                  <button
                    type="button"
                    onClick={() => removeVisited(id)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title={isEn ? "Remove destination" : "Xóa địa điểm"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Favorite / Bucket List Destinations */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span className="text-amber-500">✨</span>
              <span>
                {t("settings.personalization.wishlistTitle", {
                  defaultValue: isEn ? "Wishlist Destinations:" : "Điểm đến mơ ước:",
                })}
              </span>
              <span className="text-micro text-muted-foreground font-normal">
                ({wishlistPlaces.length})
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAddingTarget("WANT_TO_VISIT");
                setPlaceSearch("");
              }}
              className="h-7 text-micro rounded-lg border-border/60 hover:border-primary hover:text-primary gap-1 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>
                {t("settings.personalization.addWishlist", {
                  defaultValue: isEn ? "Add wishlist" : "Thêm điểm mơ ước",
                })}
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border border-border/40 min-h-[46px] items-center">
            {wishlistPlaces.length === 0 ? (
              <span className="text-micro text-muted-foreground italic">
                {t("settings.personalization.noWishlist", {
                  defaultValue: isEn ? "No bucket list destinations added yet." : "Chưa có điểm đến mong muốn nào.",
                })}
              </span>
            ) : (
              wishlistPlaces.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-micro font-medium bg-background border border-border/70 text-foreground shadow-2xs group hover:border-destructive/40 transition-colors"
                >
                  <span>{getDestinationLabel(id)}</span>
                  <button
                    type="button"
                    onClick={() => removeWishlist(id)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title={isEn ? "Remove destination" : "Xóa địa điểm"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Inline Add Destination Drawer/Box */}
        {addingTarget && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {addingTarget === "VISITED"
                  ? isEn
                    ? "Add Visited Destination"
                    : "Thêm địa điểm đã đi"
                  : isEn
                  ? "Add Wishlist Destination"
                  : "Thêm điểm đến mơ ước"}
              </span>
              <button
                type="button"
                onClick={() => setAddingTarget(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && placeSearch.trim()) {
                    e.preventDefault();
                    handleAddDestination(placeSearch);
                  }
                }}
                placeholder={isEn ? "Type destination name (e.g. Da Nang, Tokyo)..." : "Nhập tên điểm đến (ví dụ: Đà Nẵng, Tokyo)..."}
                className="pl-8 text-xs bg-background h-9 rounded-lg border-border"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-micro font-semibold text-muted-foreground uppercase tracking-wider block">
                {isEn ? "Popular Suggestions" : "Gợi ý phổ biến"}
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {filteredDestinations.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleAddDestination(d.id)}
                    className="px-2.5 py-1 rounded-md text-micro font-medium bg-background hover:bg-primary hover:text-primary-foreground border border-border/60 transition-colors cursor-pointer"
                  >
                    {d.flag ? `${d.flag} ` : ""}{d.name}
                  </button>
                ))}
                {placeSearch.trim() && !filteredDestinations.some((d) => d.name.toLowerCase() === placeSearch.toLowerCase().trim()) && (
                  <button
                    type="button"
                    onClick={() => handleAddDestination(placeSearch)}
                    className="px-2.5 py-1 rounded-md text-micro font-bold bg-primary text-primary-foreground transition-colors cursor-pointer"
                  >
                    + {isEn ? "Add" : "Thêm"} "{placeSearch.trim()}"
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: HOME CITY & IDENTITY */}
      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {t("settings.personalization.homeCityTitle", {
              defaultValue: isEn ? "Home City" : "Thành phố cư trú",
            })}
          </h2>
          <p className="text-micro text-muted-foreground mt-0.5">
            {t("settings.personalization.homeCitySubtitle", {
              defaultValue: isEn
                ? "Your home base helps TripSense provide nearby escape recommendations"
                : "Thành phố sinh sống giúp TripSense đề xuất các lộ trình và điểm đến phù hợp",
            })}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative max-w-md">
            <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <Input
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              placeholder={t("settings.personalization.homeCityPlaceholder", {
                defaultValue: isEn ? "Enter your home city..." : "Nhập thành phố bạn đang ở...",
              })}
              className="pl-9 text-xs bg-background h-9 rounded-xl border-border"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-micro text-muted-foreground mr-1">
              {t("settings.personalization.quickSelect", {
                defaultValue: isEn ? "Quick select:" : "Chọn nhanh:",
              })}
            </span>
            {POPULAR_HOME_CITIES.map((c) => {
              const isSelected =
                homeCity.toLowerCase() === c.name.toLowerCase() ||
                homeCity.toLowerCase() === c.id.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setHomeCity(c.name)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-micro font-medium border transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  {c.flag ? `${c.flag} ` : ""}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: PREFERENCE DIMENSIONS (TRAVEL STYLE, BUDGET, STAY, FOOD, ACTIVITIES) */}
      <section className="space-y-6 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {t("settings.personalization.preferencesTitle", {
              defaultValue: isEn ? "Travel Preferences & Style" : "Phong cách & Sở thích chuyến đi",
            })}
          </h2>
          <p className="text-micro text-muted-foreground mt-0.5">
            {t("settings.personalization.preferencesSubtitle", {
              defaultValue: isEn
                ? "Customize who you travel with, your spending priority, stays, and favorite activities"
                : "Tùy chỉnh nhóm đồng hành, mức ngân sách, nơi lưu trú và các hoạt động ưa thích",
            })}
          </p>
        </div>

        {PREFERENCE_STEPS.map((step) => {
          const currentValues = selections[step.dimension] || [];
          // Merge predefined options with any custom options user has selected
          const allOptions = Array.from(new Set([...step.options, ...currentValues]));
          const isAddingCustom = addingCustomDim === step.dimension;

          return (
            <div key={step.dimension} className="space-y-2.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  {t(`onboarding.dimension.${step.dimension}`, {
                    defaultValue: t(`onboarding.${step.dimension}.title`, {
                      defaultValue: step.dimension,
                    }),
                  })}
                </label>
                <span className="text-micro text-muted-foreground">
                  {step.single
                    ? t("settings.personalization.singleChoice", { defaultValue: isEn ? "Single choice" : "Chọn 1" })
                    : t("settings.personalization.multiChoice", { defaultValue: isEn ? "Multi-select" : "Chọn nhiều" })}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {allOptions.map((option) => {
                  const isSelected = currentValues.includes(option);
                  const isCustom = !step.options.includes(option);
                  const optionLabel =
                    customLabels[option] ||
                    t(`onboarding.option.${option}`, {
                      defaultValue: option
                        .split("_")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(" "),
                    });

                  return (
                    <div
                      key={option}
                      className={cn(
                        "inline-flex items-center rounded-xl text-xs font-medium border transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOption(step.dimension, option, step.single)}
                        className="px-3.5 py-2 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary stroke-[3]" />}
                        <span>{optionLabel}</span>
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomOption(step.dimension, option);
                          }}
                          className="pr-2.5 pl-1 py-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title={t("onboarding.customOption.remove", { defaultValue: "Xóa lựa chọn này" })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Custom Choice Button or Inline Input */}
                {isAddingCustom ? (
                  <div className="inline-flex items-center gap-1.5 p-1 rounded-xl border border-primary/40 bg-background shadow-xs">
                    <Input
                      value={customInputText}
                      onChange={(e) => setCustomInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customInputText.trim()) {
                          e.preventDefault();
                          handleAddCustomOption(step.dimension, step.single);
                        } else if (e.key === "Escape") {
                          setAddingCustomDim(null);
                          setCustomInputText("");
                        }
                      }}
                      placeholder={t("settings.personalization.customOptionPlaceholder", {
                        defaultValue: isEn ? "Enter other choice..." : "Nhập lựa chọn khác...",
                      })}
                      className="h-7 text-xs border-none focus-visible:ring-0 px-2 w-44 sm:w-56"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddCustomOption(step.dimension, step.single)}
                      disabled={!customInputText.trim()}
                      className="h-7 text-micro px-2.5 rounded-lg cursor-pointer"
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      <span>{t("onboarding.customOption.add", { defaultValue: "Thêm" })}</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCustomDim(null);
                        setCustomInputText("");
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCustomDim(step.dimension);
                      setCustomInputText("");
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-medium border border-dashed border-border/80 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {t("settings.personalization.addCustom", {
                        defaultValue: isEn ? "+ Other" : "+ Khác",
                      })}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* SECTION 4: FREE-TEXT TRAVEL NOTES */}
      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {t("settings.personalization.notesTitle", {
              defaultValue: isEn
                ? "Personal Travel Notes & Special Requests"
                : "Ghi chú du lịch & Yêu cầu riêng",
            })}
          </h2>
          <p className="text-micro text-muted-foreground mt-0.5">
            {t("settings.personalization.notesSubtitle", {
              defaultValue: isEn
                ? "Add any dietary restrictions, hobbies, or unique preferences for the AI planner"
                : "Thêm khẩu vị ăn uống, sở thích đặc biệt hoặc ghi chú riêng cho AI khi gợi ý",
            })}
          </p>
        </div>

        <div className="space-y-3">
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t("settings.personalization.notesPlaceholder", {
              defaultValue: isEn
                ? "e.g. Love specialty coffee, sunset photography, vegetarian friendly spots, quiet stays..."
                : "Ví dụ: Thích quán cà phê chill, săn ảnh hoàng hôn, ăn thanh đạm, ưu tiên nơi yên tĩnh...",
            })}
            className="text-xs min-h-[90px] rounded-xl border-border resize-y"
            maxLength={2000}
          />

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-micro text-muted-foreground mr-1">
              {t("settings.personalization.quickTags", {
                defaultValue: isEn ? "Quick tags:" : "Gợi ý nhanh:",
              })}
            </span>
            {QUICK_FREE_TEXT_TAGS.map((tag) => {
              const tagLabel = t(`onboarding.freeTextNote.${tag.key}`, { defaultValue: tag.key });
              const isIncluded = freeText.includes(tagLabel);
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => handleToggleQuickTag(tag.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-micro font-medium border transition-colors cursor-pointer flex items-center gap-1",
                    isIncluded
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <span>{tag.icon}</span>
                  <span>{tagLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOTTOM STICKY ACTION BAR */}
      <div className="sticky bottom-4 z-20 p-3 sm:p-4 rounded-2xl border border-border/60 bg-background/90 backdrop-blur-md shadow-md flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadProfile}
          disabled={saving}
          className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>
            {t("settings.personalization.discard", { defaultValue: isEn ? "Discard changes" : "Hủy thay đổi" })}
          </span>
        </Button>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-micro font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in-50">
              <Check className="h-3.5 w-3.5" />
              <span>{t("settings.personalization.saved", { defaultValue: isEn ? "Saved!" : "Đã lưu!" })}</span>
            </span>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 px-5 shadow-xs cursor-pointer transition-all"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>
              {saving
                ? t("settings.personalization.saving", { defaultValue: isEn ? "Saving..." : "Đang lưu..." })
                : t("settings.personalization.save", { defaultValue: isEn ? "Save changes" : "Lưu thay đổi" })}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
