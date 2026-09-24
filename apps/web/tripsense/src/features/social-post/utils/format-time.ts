export function formatRelativeTime(
  dateString: string,
  locale: string = "vi",
): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const isEn = locale === "en";

    if (diffSeconds < 60) {
      return isEn ? "Just now" : "Vừa xong";
    }
    if (diffMinutes < 60) {
      return isEn
        ? `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`
        : `${diffMinutes} phút trước`;
    }
    if (diffHours < 24) {
      return isEn
        ? `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
        : `${diffHours} giờ trước`;
    }
    if (diffDays === 1) {
      return isEn ? "Yesterday" : "Hôm qua";
    }
    if (diffDays < 7) {
      return isEn ? `${diffDays} days ago` : `${diffDays} ngày trước`;
    }

    return date.toLocaleDateString(isEn ? "en-US" : "vi-VN", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}
