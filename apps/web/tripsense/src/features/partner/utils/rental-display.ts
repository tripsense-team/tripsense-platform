import type { RentalCategory, RentalItemDto } from "../types";

export const RENTAL_CATEGORY_META: Record<
  string,
  { label: string; shortLabel: string; icon: string }
> = {
  CAR_4_SEATS: { label: "Ô tô 4 chỗ", shortLabel: "Ô tô 4 chỗ", icon: "🚗" },
  CAR_7_SEATS: { label: "Ô tô 7 chỗ", shortLabel: "Ô tô 7 chỗ", icon: "🚙" },
  MOTORBIKE_SCOOTER: { label: "Xe máy tay ga", shortLabel: "Xe tay ga", icon: "🛵" },
  MOTORBIKE_MANUAL: { label: "Xe máy số / Côn", shortLabel: "Xe số / Côn", icon: "🏍️" },
  BICYCLE: { label: "Xe đạp địa hình / dạo phố", shortLabel: "Xe đạp", icon: "🚲" },
  CAMPING_GEAR: { label: "Lều trại & Đồ dã ngoại", shortLabel: "Cắm trại", icon: "⛺" },
  WATER_SPORTS: { label: "SUP & Thể thao nước", shortLabel: "SUP & Nước", icon: "🏄" },
  VEHICLE: { label: "Phương tiện di chuyển", shortLabel: "Phương tiện", icon: "🛵" },
  OTHER: { label: "Dịch vụ khác", shortLabel: "Khác", icon: "📦" },
};

export function getRentalCategoryMeta(category: RentalCategory | string) {
  return RENTAL_CATEGORY_META[category] ?? {
    label: String(category),
    shortLabel: String(category),
    icon: "📦",
  };
}

export function isRentalItemActive(item: RentalItemDto): boolean {
  return item.active ?? item.isActive ?? true;
}

export function supportsRentalDelivery(item: RentalItemDto): boolean {
  return Boolean(
    item.deliveryAvailable ||
      item.pickupOption === "BOTH" ||
      item.pickupOption === "DOOR_DELIVERY" ||
      item.pickupOption === "DELIVERY_TO_LOCATION",
  );
}

export function toSafeDisplayImageUrl(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return /^(https?:\/\/|blob:|\/)/i.test(trimmed) ? trimmed : null;
}

export function foldVietnameseText(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim();
}

