import type { Place } from "@/features/places/types";

const BUTTON_CLASS =
  "w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs";

function safeHttpUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safePhoneUrl(value?: string): string | null {
  if (!value || !/^[+()\d\s.-]{3,30}$/.test(value)) return null;
  return `tel:${value.replace(/\s/g, "")}`;
}

function createActionButton(id: string, label: string, icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.textContent = icon;
  return button;
}

function createInfoRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "space-y-0.5";

  const labelNode = document.createElement("p");
  labelNode.className = "text-[11px] text-muted-foreground font-medium";
  labelNode.textContent = label;

  const valueNode = document.createElement("p");
  valueNode.className = "text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap";
  valueNode.textContent = value;

  row.append(labelNode, valueNode);
  return row;
}

function createExternalInfoRow(label: string, value: string, href: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "space-y-0.5";

  const labelNode = document.createElement("p");
  labelNode.className = "text-[11px] text-muted-foreground font-medium";
  labelNode.textContent = label;

  const link = document.createElement("a");
  link.className = "text-xs text-primary hover:underline truncate block max-w-[260px]";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = value;

  row.append(labelNode, link);
  return row;
}

export function createMapVinaPopup(place: Place, isFavorite: boolean): HTMLDivElement {
  const container = document.createElement("div");
  container.className =
    "w-[300px] sm:w-[340px] max-h-[350px] overflow-y-auto rounded-2xl bg-card text-card-foreground border border-border shadow-2xl p-4 space-y-3.5 scrollbar-thin";

  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-2.5";

  const titleColumn = document.createElement("div");
  titleColumn.className = "flex-1 min-w-0";
  const title = document.createElement("h3");
  title.className = "font-bold text-base sm:text-lg text-foreground leading-snug line-clamp-1";
  title.textContent = place.name;
  const category = document.createElement("p");
  category.className = "text-xs text-muted-foreground font-medium capitalize mt-0.5";
  category.textContent = place.categories?.[0]?.replace(/_/g, " ") ?? "Địa điểm";
  titleColumn.append(title, category);

  const closeButton = createActionButton("btn-close-popup", "Đóng", "×");
  header.append(titleColumn, closeButton);
  container.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1.5";
  if (place.location) {
    const directions = document.createElement("a");
    directions.className =
      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold";
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.location.lat},${place.location.lng}`)}`;
    directions.target = "_blank";
    directions.rel = "noopener noreferrer";
    directions.textContent = "Dẫn đường";
    actions.appendChild(directions);
  }

  const phoneUrl = safePhoneUrl(place.phone);
  if (phoneUrl) {
    const phone = document.createElement("a");
    phone.className = BUTTON_CLASS;
    phone.href = phoneUrl;
    phone.title = "Gọi điện";
    phone.setAttribute("aria-label", "Gọi điện");
    phone.textContent = "☎";
    actions.appendChild(phone);
  }

  const favorite = createActionButton("btn-fav-popup", "Yêu thích", isFavorite ? "♥" : "♡");
  const share = createActionButton("btn-share-popup", "Chia sẻ", "↗");
  const details = createActionButton("btn-detail-popup", "Xem chi tiết", "ⓘ");
  actions.append(favorite, share, details);
  container.appendChild(actions);

  const info = document.createElement("div");
  info.className = "space-y-2.5 text-xs border-t border-border/60 pt-3";
  info.appendChild(createInfoRow("Địa chỉ", place.address || place.district || "Thành phố Đà Nẵng"));
  if (place.oldAddress) info.appendChild(createInfoRow("Địa chỉ cũ", place.oldAddress));
  if (place.phone) info.appendChild(createInfoRow("Điện thoại", place.phone));
  if (place.openingHours) info.appendChild(createInfoRow("Giờ hoạt động", place.openingHours));

  const website = safeHttpUrl(place.website);
  if (website) info.appendChild(createExternalInfoRow("Trang web", place.website ?? website, website));

  const social = safeHttpUrl(place.socials?.[0]);
  if (social) info.appendChild(createExternalInfoRow("Mạng xã hội", place.socials?.[0] ?? social, social));

  container.appendChild(info);
  return container;
}
