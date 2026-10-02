"use client";

import * as React from "react";
import Link from "next/link";
import {
  Compass,
  UserCheck,
  Languages,
  Award,
  MapPin,
  Clock,
  ShieldCheck,
  Send,
  Star,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { GuideInquiryFormModal } from "./guide-inquiry-form-modal";
import { getPublicGuideProfile } from "../services/partner-api";
import type { GuidePromotionSummaryDto, PublicGuideProfileDto } from "../types";

interface PublicGuideProfileViewProps {
  guideId: string;
}

export function PublicGuideProfileView({ guideId }: PublicGuideProfileViewProps) {
  const [profile, setProfile] = React.useState<PublicGuideProfileDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [inquiryModalOpen, setInquiryModalOpen] = React.useState(false);
  const [selectedPromotion, setSelectedPromotion] = React.useState<{
    id?: string;
    revisionId: string;
    areaId: string;
    topicIds: string[];
  } | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPublicGuideProfile(guideId);
        setProfile(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Không thể tải hồ sơ hướng dẫn viên");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [guideId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || "Không tìm thấy hồ sơ hướng dẫn viên"}
        </div>
      </div>
    );
  }

  const handleOpenInquiry = (promo?: GuidePromotionSummaryDto) => {
    setSelectedPromotion({
      id: promo?.promotionId,
      revisionId: promo?.approvedRevisionId || "11111111-1111-1111-1111-111111111111",
      areaId: promo?.areaId || "hoi-an",
      topicIds: promo?.topicIds || ["heritage"],
    });
    setInquiryModalOpen(true);
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Hero Profile Card */}
      <Card className="overflow-hidden border-border/80 shadow-md">
        <div className="h-32 bg-gradient-to-r from-emerald-600/20 via-primary/20 to-blue-600/20" />
        <CardContent className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-card text-primary shadow-md">
                <Compass className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {profile.displayName}
                  </h1>
                  <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                    <UserCheck className="h-3.5 w-3.5" /> Hồ sơ đã duyệt
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {profile.yearsExperience ? `${profile.yearsExperience} năm kinh nghiệm thực địa` : "Hướng dẫn viên được chứng nhận"}
                </p>
              </div>
            </div>

            <Button onClick={() => handleOpenInquiry()} size="lg" className="shadow-md">
              <Send className="mr-2 h-4 w-4" /> Gửi yêu cầu tư vấn
            </Button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {profile.bio || "Hướng dẫn viên am hiểu địa phương, cung cấp những trải nghiệm giàu tính văn hóa và cá nhân hóa lộ trình du lịch."}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
            {profile.languages && profile.languages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-primary" />
                <span>
                  Ngôn ngữ: {profile.languages.map((l) => `${l.code.toUpperCase()} (${l.selfAssessedLevel})`).join(", ")}
                </span>
              </div>
            )}

            {profile.indicativePrice && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  Mức giá tham khảo: {profile.indicativePrice.amount.toLocaleString("vi-VN")} {profile.indicativePrice.currency} / {profile.indicativePrice.unit}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skills & Expertise Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/80">
          <CardHeader className="p-5 pb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Kỹ năng & Chuyên môn
            </h2>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {profile.skillIds?.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>

            {profile.expertise && profile.expertise.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50 text-xs">
                {profile.expertise.map((exp, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-muted/30">
                    <span className="font-semibold text-foreground block">
                      {exp.areaId} • {exp.topicId}
                    </span>
                    <span className="text-muted-foreground text-[11px] block mt-0.5">
                      {exp.description} ({exp.experience})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="p-5 pb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Giới hạn & Đối tượng phù hợp
            </h2>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3 text-xs">
            <div>
              <span className="font-semibold text-foreground block mb-1">Phù hợp với du khách:</span>
              <div className="flex flex-wrap gap-1.5">
                {profile.audienceTags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px]">
                    {tag}
                  </Badge>
                )) || <span className="text-muted-foreground">Mọi đối tượng du khách</span>}
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <span className="font-semibold text-foreground block mb-1">Giới hạn hỗ trợ dịch vụ:</span>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                {profile.serviceLimitations?.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                )) || <li>Chỉ tư vấn và hướng dẫn, không nhận vận chuyển hàng hóa độc lập.</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guide's Promotions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">
          Các bài giới thiệu & Gói trải nghiệm của hướng dẫn viên
        </h2>

        {(!profile.promotions || profile.promotions.length === 0) ? (
          <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
            Hướng dẫn viên chưa đăng bài quảng bá dịch vụ nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.promotions.map((promo) => (
              <Card key={promo.promotionId} className="flex flex-col overflow-hidden border-border/80 hover:shadow-md transition-all">
                <CardHeader className="p-5 pb-2">
                  <h3 className="font-semibold text-foreground text-base tracking-tight line-clamp-1">
                    {promo.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {promo.summary}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 px-5 py-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Badge variant="secondary">{promo.areaId}</Badge>
                    {promo.experienceDuration && (
                      <Badge variant="outline">{promo.experienceDuration}</Badge>
                    )}
                  </div>

                  {promo.indicativePriceAmount && (
                    <p className="text-xs font-semibold text-primary pt-1">
                      Giá từ: {promo.indicativePriceAmount.toLocaleString("vi-VN")} VND / {promo.indicativePriceUnit}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="p-4 pt-2 border-t border-border/40">
                  <Button
                    onClick={() => handleOpenInquiry(promo)}
                    size="sm"
                    className="w-full text-xs"
                    disabled={promo.canRequestInquiry === false}
                  >
                    {promo.canRequestInquiry === false ? "Tạm ngưng tiếp nhận" : "Gửi yêu cầu tư vấn gói này"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Inquiry Form Modal */}
      {selectedPromotion && (
        <GuideInquiryFormModal
          open={inquiryModalOpen}
          onOpenChange={setInquiryModalOpen}
          guideBusinessId={profile.businessId}
          guideDisplayName={profile.displayName}
          promotionId={selectedPromotion.id}
          expectedSourceRevisionId={selectedPromotion.revisionId}
          areaId={selectedPromotion.areaId}
          topicIds={selectedPromotion.topicIds}
        />
      )}
    </div>
  );
}
