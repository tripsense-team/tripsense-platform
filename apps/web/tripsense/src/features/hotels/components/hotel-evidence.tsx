"use client";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import type { AiArtifact } from "@/features/ai-chat/types";

export function HotelEvidence({ artifact }: { artifact: AiArtifact }) {
  const { t } = useTranslation();
  const rows = Array.isArray(artifact.data.hotels) ? artifact.data.hotels as Record<string, unknown>[] : [];
  return <section className="space-y-2 rounded-xl border border-border bg-card p-4">
    <h3 className="font-semibold">{t("trip.hotels.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("trip.hotels.historical")}</p>
    {rows.slice(0, 10).map(row => <p key={String(row.room_type_id)}>{String(row.name)} · {String(row.room_name)} · {Number(row.total).toLocaleString()} {String(row.currency)}</p>)}
    <Link className="text-primary underline" href="/hotels">{t("trip.hotels.viewRooms")}</Link>
  </section>;
}
