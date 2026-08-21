"use client";

import * as React from "react";
import * as mapvinagl from "mapvina-gl";
import "mapvina-gl/dist/mapvina-gl.css";
import { cn } from "@/lib/utils";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { MapVinaContainerProps } from "../types";
import type { Place } from "@/features/places/types";

const MAPVINA_API_KEY = process.env.NEXT_PUBLIC_MAPVINA_API_KEY || "d3d41d12e3f48ea412e21787195793ff33";
const MAPVINA_STYLE_URL = `https://maps.mapvina.com/styles/v2/streets.json?key=${MAPVINA_API_KEY}`;

// Fallback raster style if vector tile style is unavailable
const FALLBACK_STYLE: any = {
  version: 8,
  sources: {
    "map-tiles": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://mapvina.com">MapVina</a>',
    },
  },
  layers: [
    {
      id: "map-tiles-layer",
      type: "raster",
      source: "map-tiles",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Lucide-style SVG paths for category markers (stroke-based, 24x24 viewBox)
const CATEGORY_ICONS: Record<string, { svg: string; bg: string; label: string }> = {
  // Food & Drink
  restaurant: {
    svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
    bg: "bg-orange-500", label: "Nhà hàng",
  },
  cafe: {
    svg: `<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>`,
    bg: "bg-amber-600", label: "Quán cafe",
  },
  bar: {
    svg: `<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>`,
    bg: "bg-purple-600", label: "Bar / Pub",
  },
  seafood: {
    svg: `<path d="M2 16s9-15 20-4C11 23 2 8 2 8"/><circle cx="12" cy="12" r="1"/>`,
    bg: "bg-blue-600", label: "Hải sản",
  },
  bakery: {
    svg: `<path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M10 21v1a2 2 0 0 0 4 0v-1"/>`,
    bg: "bg-rose-500", label: "Bánh / Đặc sản",
  },
  // Accommodation
  hotel: {
    svg: `<path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><path d="m9 16 .348-.24c1.465-1.013 3.84-1.013 5.304 0L15 16"/><path d="M8 7h.01"/><path d="M16 7h.01"/><path d="M12 7h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/>`,
    bg: "bg-indigo-600", label: "Khách sạn",
  },
  // Tourism & Nature
  beach: {
    svg: `<path d="M17.553 3.553A10 10 0 0 0 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
    bg: "bg-teal-500", label: "Biển / Du lịch",
  },
  temple: {
    svg: `<path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/><path d="M9 20v-4h6v4"/><path d="M9 12h6"/><path d="M12 8v4"/>`,
    bg: "bg-yellow-600", label: "Chùa / Đền",
  },
  mountain: {
    svg: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/>`,
    bg: "bg-emerald-700", label: "Núi / Thiên nhiên",
  },
  // Shopping
  shopping: {
    svg: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
    bg: "bg-pink-500", label: "Mua sắm",
  },
  // Health
  hospital: {
    svg: `<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>`,
    bg: "bg-red-500", label: "Y tế",
  },
  // Education
  school: {
    svg: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 10 3 12 0v-5"/>`,
    bg: "bg-sky-600", label: "Trường học",
  },
  // Entertainment
  entertainment: {
    svg: `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`,
    bg: "bg-fuchsia-500", label: "Giải trí",
  },
  // Default
  default: {
    svg: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`,
    bg: "bg-emerald-500", label: "Địa điểm",
  },
};

function getCategoryIcon(categories?: string[]): { svg: string; bg: string; label: string } {
  if (!categories || categories.length === 0) return CATEGORY_ICONS.default;
  const cat = categories[0].toLowerCase();

  // Cafe / Coffee
  if (cat.includes("cafe") || cat.includes("coffee") || cat.includes("cà phê") || cat.includes("tea") || cat.includes("trà")) {
    return CATEGORY_ICONS.cafe;
  }
  // Seafood
  if (cat.includes("hải sản") || cat.includes("ốc") || cat.includes("seafood") || cat.includes("cá") || cat.includes("tôm")) {
    return CATEGORY_ICONS.seafood;
  }
  // Bar / Pub / Drink
  if (cat.includes("bar") || cat.includes("pub") || cat.includes("cocktail") || cat.includes("bia") || cat.includes("rượu")) {
    return CATEGORY_ICONS.bar;
  }
  // Bakery / Dessert / Traditional
  if (cat.includes("bánh") || cat.includes("bakery") || cat.includes("đặc sản") || cat.includes("truyền thống") || cat.includes("dessert") || cat.includes("kem")) {
    return CATEGORY_ICONS.bakery;
  }
  // Restaurant / Food general
  if (cat.includes("restaurant") || cat.includes("nhà hàng") || cat.includes("ăn") || cat.includes("nướng") || cat.includes("bbq") || cat.includes("food") || cat.includes("quán") || cat.includes("bún") || cat.includes("phở") || cat.includes("cơm") || cat.includes("lẩu") || cat.includes("meal")) {
    return CATEGORY_ICONS.restaurant;
  }
  // Hotel / Accommodation
  if (cat.includes("khách sạn") || cat.includes("hotel") || cat.includes("resort") || cat.includes("homestay") || cat.includes("hostel") || cat.includes("accommodation") || cat.includes("lodging")) {
    return CATEGORY_ICONS.hotel;
  }
  // Temple / Religion
  if (cat.includes("chùa") || cat.includes("đền") || cat.includes("nhà thờ") || cat.includes("temple") || cat.includes("church") || cat.includes("pagoda")) {
    return CATEGORY_ICONS.temple;
  }
  // Mountain / Nature
  if (cat.includes("núi") || cat.includes("mountain") || cat.includes("rừng") || cat.includes("forest") || cat.includes("thác") || cat.includes("waterfall")) {
    return CATEGORY_ICONS.mountain;
  }
  // Beach / Tourism
  if (cat.includes("biển") || cat.includes("beach") || cat.includes("du lịch") || cat.includes("cầu") || cat.includes("tourist") || cat.includes("park") || cat.includes("công viên")) {
    return CATEGORY_ICONS.beach;
  }
  // Shopping
  if (cat.includes("shop") || cat.includes("mua sắm") || cat.includes("chợ") || cat.includes("market") || cat.includes("store") || cat.includes("siêu thị") || cat.includes("mall")) {
    return CATEGORY_ICONS.shopping;
  }
  // Hospital / Health
  if (cat.includes("bệnh viện") || cat.includes("hospital") || cat.includes("clinic") || cat.includes("phòng khám") || cat.includes("y tế") || cat.includes("health")) {
    return CATEGORY_ICONS.hospital;
  }
  // School / Education
  if (cat.includes("trường") || cat.includes("school") || cat.includes("đại học") || cat.includes("university") || cat.includes("education") || cat.includes("học viện")) {
    return CATEGORY_ICONS.school;
  }
  // Entertainment
  if (cat.includes("karaoke") || cat.includes("cinema") || cat.includes("rạp") || cat.includes("game") || cat.includes("giải trí") || cat.includes("entertainment") || cat.includes("spa") || cat.includes("massage")) {
    return CATEGORY_ICONS.entertainment;
  }

  return CATEGORY_ICONS.default;
}

// Keep old getCategoryColor for popup compatibility
function getCategoryColor(categories?: string[]): { bg: string; text: string; icon: string } {
  const cat = getCategoryIcon(categories);
  return { bg: cat.bg, text: "text-white", icon: cat.label.split(" ")[0] };
}

function createMarkerWrapper(
  place: Place,
  isSelected: boolean,
  currentZoom: number
): HTMLDivElement {
  const { svg, bg } = getCategoryIcon(place.categories);
  const isHighZoom = currentZoom >= 13.5;
  const isSelectedOrHigh = isSelected || isHighZoom;

  const wrapper = document.createElement("div");
  wrapper.className = "tripsense-marker-inner flex flex-col items-center transition-transform duration-150";
  wrapper.style.transform = isSelected ? "scale(1.15)" : "scale(1)";

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

  // Downward-pointing triangle arrow
  const arrow = document.createElement("div");
  arrow.className = "w-0 h-0 -mt-px";

  if (isSelectedOrHigh) {
    const pill = document.createElement("div");
    pill.className = `flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg border backdrop-blur-md transition-all ${
      isSelected
        ? "bg-zinc-900 text-white border-white/40 ring-4 ring-primary/30 shadow-2xl dark:bg-white dark:text-zinc-900"
        : "bg-background/95 text-foreground border-border/80 hover:bg-background hover:scale-105 shadow-md"
    }`;

    const iconSpan = document.createElement("span");
    iconSpan.className = `flex items-center justify-center w-6 h-6 rounded-full text-white shrink-0 shadow-xs ${bg}`;
    iconSpan.innerHTML = svgIcon;

    const textSpan = document.createElement("span");
    textSpan.className = "text-xs font-semibold tracking-tight whitespace-nowrap max-w-[130px] truncate";
    textSpan.innerText = place.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = `text-[11px] font-bold shrink-0 ${
      isSelected ? "text-amber-300 dark:text-amber-500" : "text-amber-500 dark:text-amber-400"
    }`;
    scoreSpan.innerText = `★${(place.rating || 4.5).toFixed(1)}`;

    pill.appendChild(iconSpan);
    pill.appendChild(textSpan);
    pill.appendChild(scoreSpan);
    wrapper.appendChild(pill);

    // Arrow matches pill background
    arrow.style.borderLeft = "6px solid transparent";
    arrow.style.borderRight = "6px solid transparent";
    arrow.style.borderTop = isSelected ? "8px solid #18181b" : "8px solid var(--background, #fff)";
    wrapper.appendChild(arrow);
  } else {
    const dot = document.createElement("div");
    dot.className = `flex items-center justify-center w-8 h-8 rounded-full shadow-md border-2 border-white dark:border-zinc-800 transition-all hover:scale-110 text-white ${bg}`;
    dot.innerHTML = svgIcon;
    wrapper.appendChild(dot);

    // Arrow — CSS border triangle with hardcoded hex color matching the category bg
    const BG_HEX: Record<string, string> = {
      "bg-orange-500": "#f97316", "bg-amber-600": "#d97706", "bg-purple-600": "#9333ea",
      "bg-blue-600": "#2563eb", "bg-rose-500": "#f43f5e", "bg-indigo-600": "#4f46e5",
      "bg-teal-500": "#14b8a6", "bg-yellow-600": "#ca8a04", "bg-emerald-700": "#047857",
      "bg-pink-500": "#ec4899", "bg-red-500": "#ef4444", "bg-sky-600": "#0284c7",
      "bg-fuchsia-500": "#d946ef", "bg-emerald-500": "#10b981",
    };
    const arrowColor = BG_HEX[bg] || "#10b981";
    const dotArrow = document.createElement("div");
    dotArrow.style.width = "0";
    dotArrow.style.height = "0";
    dotArrow.style.marginTop = "-2px";
    dotArrow.style.borderLeft = "5px solid transparent";
    dotArrow.style.borderRight = "5px solid transparent";
    dotArrow.style.borderTop = `7px solid ${arrowColor}`;
    wrapper.appendChild(dotArrow);
  }

  return wrapper;
}

function createPopupContent(
  place: Place,
  isFavorite: boolean,
  onFavoriteClick: () => void,
  onAddClick: () => void,
  onDetailClick: () => void
): HTMLDivElement {
  const container = document.createElement("div");
  container.className =
    "w-[300px] sm:w-[340px] max-h-[350px] overflow-y-auto rounded-2xl bg-card text-card-foreground border border-border shadow-2xl backdrop-blur-xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin";

  const { svg: catSvg, bg: catBg } = getCategoryIcon(place.categories);
  const primaryCategory =
    place.categories && place.categories.length > 0 ? place.categories[0] : "Địa điểm";

  // 1. Top Header: Title, Category Subtitle, Category Icon & Close Button
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-2.5";

  const titleCol = document.createElement("div");
  titleCol.className = "flex-1 min-w-0 pr-1";

  const title = document.createElement("h3");
  title.className = "font-bold text-base sm:text-lg text-foreground leading-snug tracking-tight line-clamp-1";
  title.innerText = place.name;
  titleCol.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "text-xs text-muted-foreground font-medium capitalize mt-0.5";
  subtitle.innerText = primaryCategory.replace(/_/g, " ");
  titleCol.appendChild(subtitle);

  header.appendChild(titleCol);

  const iconBox = document.createElement("div");
  iconBox.className =
    `w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs text-white ${catBg}`;
  iconBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${catSvg}</svg>`;
  header.appendChild(iconBox);

  const closeBtn = document.createElement("button");
  closeBtn.id = "btn-close-popup";
  closeBtn.type = "button";
  closeBtn.className =
    "w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0";
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  header.appendChild(closeBtn);

  container.appendChild(header);

  // 2. Action Buttons Toolbar: Dẫn đường, Gọi điện, Yêu thích, Chia sẻ, Chi tiết
  const actionsRow = document.createElement("div");
  actionsRow.className = "flex items-center gap-1.5 pt-0.5";

  // Dẫn đường (Directions) button
  const dirBtn = document.createElement("a");
  const lat = place.location?.lat || 16.0544;
  const lng = place.location?.lng || 108.2022;
  dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  dirBtn.target = "_blank";
  dirBtn.rel = "noopener noreferrer";
  dirBtn.className =
    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer";
  dirBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg><span>Dẫn đường</span>`;
  actionsRow.appendChild(dirBtn);

  // Gọi điện (Phone) button
  if (place.phone) {
    const phoneBtn = document.createElement("a");
    phoneBtn.href = `tel:${place.phone}`;
    phoneBtn.className =
      "w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs";
    phoneBtn.title = `Gọi điện: ${place.phone}`;
    phoneBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
    actionsRow.appendChild(phoneBtn);
  }

  // Favorite button
  const favBtn = document.createElement("button");
  favBtn.id = "btn-fav-popup";
  favBtn.type = "button";
  favBtn.className = `w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
    isFavorite ? "text-rose-500" : ""
  }`;
  favBtn.title = "Yêu thích";
  favBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${
    isFavorite ? "currentColor" : "none"
  }" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
  actionsRow.appendChild(favBtn);

  // Share button
  const shareBtn = document.createElement("button");
  shareBtn.id = "btn-share-popup";
  shareBtn.type = "button";
  shareBtn.className =
    "w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs";
  shareBtn.title = "Chia sẻ";
  shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
  actionsRow.appendChild(shareBtn);

  // Detail / Info button
  const detailBtn = document.createElement("button");
  detailBtn.id = "btn-detail-popup";
  detailBtn.type = "button";
  detailBtn.className =
    "w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs";
  detailBtn.title = "Xem chi tiết";
  detailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  actionsRow.appendChild(detailBtn);

  container.appendChild(actionsRow);

  // Divider
  const divider = document.createElement("div");
  divider.className = "h-px bg-border/60 my-1";
  container.appendChild(divider);

  // 3. Information List Fields
  const infoList = document.createElement("div");
  infoList.className = "space-y-2.5 text-xs";

  // 📍 Địa chỉ
  const addressItem = document.createElement("div");
  addressItem.className = "flex items-start gap-2.5";
  addressItem.innerHTML = `
    <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[11px] text-muted-foreground font-medium">Địa chỉ</p>
      <p class="text-xs text-foreground font-medium leading-relaxed">${place.address || place.district || "Thành phố Đà Nẵng"}</p>
      ${place.oldAddress ? `<p class="text-[11px] text-muted-foreground/80 italic mt-0.5 leading-tight">Địa chỉ cũ: ${place.oldAddress}</p>` : ""}
    </div>
  `;
  infoList.appendChild(addressItem);

  // 📞 Điện thoại (nếu có)
  if (place.phone) {
    const phoneItem = document.createElement("div");
    phoneItem.className = "flex items-start gap-2.5";
    phoneItem.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] text-muted-foreground font-medium">Điện thoại</p>
        <a href="tel:${place.phone}" class="text-xs font-semibold text-foreground hover:text-emerald-600 transition-colors">${place.phone}</a>
      </div>
    `;
    infoList.appendChild(phoneItem);
  }

  // 🌐 Trang web (nếu có)
  if (place.website) {
    const webItem = document.createElement("div");
    webItem.className = "flex items-start gap-2.5";
    webItem.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] text-muted-foreground font-medium">Trang web</p>
        <a href="${place.website}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline truncate block max-w-[240px]">${place.website}</a>
      </div>
    `;
    infoList.appendChild(webItem);
  }

  // 💬 Mạng xã hội (nếu có)
  const socialUrl = (place.socials && place.socials.length > 0) ? place.socials[0] : (place.website?.includes("facebook.com") ? place.website : null);
  if (socialUrl) {
    const socialItem = document.createElement("div");
    socialItem.className = "flex items-start gap-2.5";
    socialItem.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] text-muted-foreground font-medium">Mạng xã hội</p>
        <a href="${socialUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <span>📘 Facebook</span>
        </a>
      </div>
    `;
    infoList.appendChild(socialItem);
  }

  // ⏰ Giờ mở cửa (nếu có)
  if (place.openingHours) {
    const hoursItem = document.createElement("div");
    hoursItem.className = "flex items-start gap-2.5";
    hoursItem.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] text-muted-foreground font-medium">Giờ hoạt động</p>
        <p class="text-xs text-foreground font-medium">${place.openingHours}</p>
      </div>
    `;
    infoList.appendChild(hoursItem);
  }

  container.appendChild(infoList);

  return container;
}

export function MapVinaContainer({
  places,
  selectedPlaceId,
  onSelectPlace,
  onAddAndSelectPlace,
  onViewDetails,
  onViewportChange,
  center = [108.2208, 16.0678], // Da Nang center [lng, lat]
  zoom = 13,
  className,
}: MapVinaContainerProps) {
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapvinagl.Map | null>(null);
  const markersRef = React.useRef<{ [id: string]: mapvinagl.Marker }>({});
  const popupRef = React.useRef<mapvinagl.Popup | null>(null);
  const onSelectPlaceRef = React.useRef(onSelectPlace);
  const onAddAndSelectPlaceRef = React.useRef(onAddAndSelectPlace);
  const onViewDetailsRef = React.useRef(onViewDetails);
  const onViewportChangeRef = React.useRef(onViewportChange);
  const isUserInteractingRef = React.useRef(false);

  const lastQueriedRef = React.useRef<{ lat: number; lng: number; zoom: number }>({
    lat: center[1],
    lng: center[0],
    zoom,
  });

  const [favorites, setFavorites] = React.useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [currentZoom, setCurrentZoom] = React.useState(zoom);
  const placesRef = React.useRef(places);

  React.useEffect(() => {
    placesRef.current = places;
  }, [places]);

  React.useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  React.useEffect(() => {
    onAddAndSelectPlaceRef.current = onAddAndSelectPlace;
  }, [onAddAndSelectPlace]);

  React.useEffect(() => {
    onViewDetailsRef.current = onViewDetails;
  }, [onViewDetails]);

  React.useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Initialize MapVina GL instance
  React.useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let mapInstance: mapvinagl.Map;
    try {
      mapInstance = new mapvinagl.Map({
        container: mapContainerRef.current,
        style: MAPVINA_STYLE_URL,
        center,
        zoom,
        attributionControl: {
          compact: true,
        },
      });
    } catch (e) {
      console.warn("MapVina style initialization failed, falling back to raster style:", e);
      mapInstance = new mapvinagl.Map({
        container: mapContainerRef.current,
        style: FALLBACK_STYLE,
        center,
        zoom,
        attributionControl: {
          compact: true,
        },
      });
    }

    mapInstance.addControl(new mapvinagl.NavigationControl({ showCompass: true }), "top-right");

    mapInstance.on("error", (e) => {
      console.warn("MapVina event:", e);
    });

    mapInstance.on("load", () => {
      mapRef.current = mapInstance;
      setIsLoaded(true);
      setCurrentZoom(mapInstance.getZoom());
      mapInstance.resize();
      setTimeout(() => {
        mapInstance.resize();
      }, 150);
    });

    mapInstance.on("dragstart", () => {
      isUserInteractingRef.current = true;
    });

    mapInstance.on("zoomstart", () => {
      isUserInteractingRef.current = true;
    });

    mapInstance.on("zoom", () => {
      setCurrentZoom(mapInstance.getZoom());
    });

    // 🎯 Interactive Click on base map POIs / Icons / Labels / Landmarks
    mapInstance.on("click", (e) => {
      const bbox: [mapvinagl.PointLike, mapvinagl.PointLike] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ];
      const features = mapInstance.queryRenderedFeatures(bbox);

      // Find first feature with a meaningful name or label
      const poi = features.find(
        (f: any) =>
          f.properties &&
          (f.properties.name ||
            f.properties.name_vi ||
            f.properties.name_en ||
            f.properties.label ||
            f.properties["name:vi"] ||
            f.properties["name:en"]) &&
          !f.layer?.id?.includes("background") &&
          !f.layer?.id?.includes("water") &&
          !f.layer?.id?.includes("landuse") &&
          !f.layer?.id?.includes("landcover")
      );

      if (poi && poi.properties) {
        const props = poi.properties;
        const name =
          props.name ||
          props.name_vi ||
          props["name:vi"] ||
          props.name_en ||
          props["name:en"] ||
          props.label ||
          "Địa điểm";

        let poiLat = e.lngLat.lat;
        let poiLng = e.lngLat.lng;

        if (poi.geometry && poi.geometry.type === "Point" && Array.isArray(poi.geometry.coordinates)) {
          poiLng = poi.geometry.coordinates[0];
          poiLat = poi.geometry.coordinates[1];
        }

        // 1. Check if place is already in our loaded places list
        const existing = placesRef.current.find((p) => {
          if (!p.location) return false;
          const dist = getDistanceFromLatLonInKm(p.location.lat, p.location.lng, poiLat, poiLng);
          return dist < 0.08 || (p.name && p.name.toLowerCase() === name.toLowerCase());
        });

        if (existing) {
          if (onSelectPlaceRef.current) {
            onSelectPlaceRef.current(existing.id);
          }
          return;
        }

        // 2. Build a new Place object for this clicked base map POI
        const category =
          props.subclass || props.class || props.category || props.type || (poi.layer?.id?.includes("poi") ? "Địa điểm" : "Điểm đến");
        const address =
          props.formatted_address ||
          props.address ||
          props.label ||
          props.vicinity ||
          `${name}, Đà Nẵng`;

        const newPlace: Place = {
          id: props.gid || props.id || `poi_${poiLat.toFixed(5)}_${poiLng.toFixed(5)}`,
          providerPlaceId: props.gid || props.id,
          name,
          location: {
            lat: poiLat,
            lng: poiLng,
          },
          address,
          city: "Đà Nẵng",
          categories: [category],
          rating: 4.5,
          userRatingCount: 25,
          provider: "mapvina",
          photos: [],
        };

        // Select place to show Map Popup Card
        if (onAddAndSelectPlaceRef.current) {
          onAddAndSelectPlaceRef.current(newPlace);
        } else if (onSelectPlaceRef.current) {
          onSelectPlaceRef.current(newPlace.id);
        }
      } else {
        // Clicked on empty area -> dismiss popup
        if (onSelectPlaceRef.current) {
          onSelectPlaceRef.current(null);
        }
      }
    });

    // 🎯 Hover effect: Pointer cursor when hovering over base map POIs
    mapInstance.on("mousemove", (e) => {
      const bbox: [mapvinagl.PointLike, mapvinagl.PointLike] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ];
      const features = mapInstance.queryRenderedFeatures(bbox);
      const isPoi = features.some(
        (f: any) =>
          f.properties &&
          (f.properties.name ||
            f.properties.name_vi ||
            f.properties.name_en ||
            f.properties.label ||
            f.properties["name:vi"] ||
            f.properties["name:en"]) &&
          !f.layer?.id?.includes("background") &&
          !f.layer?.id?.includes("water") &&
          !f.layer?.id?.includes("landuse") &&
          !f.layer?.id?.includes("landcover")
      );
      mapInstance.getCanvas().style.cursor = isPoi ? "pointer" : "";
    });

    // Complete-Stop Idle Detection: Fires only when the user stops panning/zooming
    mapInstance.on("idle", () => {
      if (isUserInteractingRef.current) {
        isUserInteractingRef.current = false;

        const currentCenter = mapInstance.getCenter();
        const currentZoomLevel = mapInstance.getZoom();

        const distKm = getDistanceFromLatLonInKm(
          lastQueriedRef.current.lat,
          lastQueriedRef.current.lng,
          currentCenter.lat,
          currentCenter.lng
        );
        const zoomDiff = Math.abs(currentZoomLevel - lastQueriedRef.current.zoom);

        if (distKm > 0.8 || zoomDiff > 0.75) {
          lastQueriedRef.current = {
            lat: currentCenter.lat,
            lng: currentCenter.lng,
            zoom: currentZoomLevel,
          };

          if (onViewportChangeRef.current) {
            const bounds = mapInstance.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const diagKm = getDistanceFromLatLonInKm(sw.lat, sw.lng, ne.lat, ne.lng);
            const radiusMeters = Math.max(1000, Math.min(15000, Math.round((diagKm / 2) * 1000)));

            onViewportChangeRef.current({
              lat: currentCenter.lat,
              lng: currentCenter.lng,
              zoom: currentZoomLevel,
              radius: radiusMeters,
            });
          }
        }
      }
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const validPlaces = places.filter(
      (p) => p.location && typeof p.location.lat === "number" && typeof p.location.lng === "number"
    );

    const validPlaceIds = new Set(validPlaces.map((p) => p.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!validPlaceIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    validPlaces.forEach((place) => {
      if (!place.location || typeof place.location.lat !== "number" || typeof place.location.lng !== "number") {
        return;
      }
      const isSelected = place.id === selectedPlaceId;
      const innerWrapper = createMarkerWrapper(place, isSelected, currentZoom);

      if (markersRef.current[place.id]) {
        const marker = markersRef.current[place.id];
        marker.setLngLat([place.location.lng, place.location.lat]);
        const currentEl = marker.getElement();
        currentEl.style.zIndex = isSelected ? "1000" : "10";
        currentEl.replaceChildren(innerWrapper);
      } else {
        const el = document.createElement("div");
        el.className = "tripsense-mapvina-marker cursor-pointer select-none";
        el.style.zIndex = isSelected ? "1000" : "10";
        el.appendChild(innerWrapper);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectPlaceRef.current) {
            onSelectPlaceRef.current(place.id);
          }
        });

        const marker = new mapvinagl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([place.location.lng, place.location.lat])
          .addTo(map);

        markersRef.current[place.id] = marker;
      }
    });
  }, [places, selectedPlaceId, isLoaded, currentZoom]);

  // Update Selected Place / Popup
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!selectedPlaceId) return;

    const place = places.find((p) => p.id === selectedPlaceId);
    if (!place || !place.location) return;

    const targetZoom = Math.max(map.getZoom(), 15.5);
    map.flyTo({
      center: [place.location.lng, place.location.lat],
      offset: [0, 95],
      zoom: targetZoom,
      duration: 800,
      essential: true,
    });

    const isFav = !!favorites[place.id];
    const container = createPopupContent(
      place,
      isFav,
      () => {},
      () => {},
      () => {}
    );

    container.querySelector("#btn-close-popup")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onSelectPlaceRef.current) {
        onSelectPlaceRef.current(null);
      }
    });

    container.querySelector("#btn-fav-popup")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setFavorites((prev) => ({ ...prev, [place.id]: !prev[place.id] }));
    });

    container.querySelector("#btn-share-popup")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const shareUrl = window.location.href;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    });

    container.querySelector("#btn-detail-popup")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onViewDetailsRef.current) {
        onViewDetailsRef.current(place);
      }
    });

    const popup = new mapvinagl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -18],
      anchor: "bottom",
      className: "tripsense-mindtrip-popup",
      maxWidth: "340px",
    })
      .setLngLat([place.location.lng, place.location.lat])
      .setDOMContent(container)
      .addTo(map);

    popupRef.current = popup;
  }, [selectedPlaceId, places, isLoaded, favorites]);

  return (
    <div className={cn("relative isolate z-0 w-full h-full min-h-[500px] overflow-hidden rounded-3xl border border-border shadow-md", className)}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

// Backward compatibility alias
export const MapLibreContainer = MapVinaContainer;
