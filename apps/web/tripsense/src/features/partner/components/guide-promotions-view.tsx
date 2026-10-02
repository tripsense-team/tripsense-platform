"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  ArrowLeft,
  Share2,
  CheckCircle,
  Clock,
  Send,
  Eye,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createGuidePromotion,
  getBusinessDetail,
  getGuidePromotions,
  getGuideTaxonomy,
  submitGuidePromotion,
  updateCommunityPublication,
} from "../services/partner-api";
import type {
  BusinessDetailDto,
  CreateGuidePromotionDraftRequest,
  GuidePromotionDto,
  GuideTaxonomyData,
  IndicativePriceUnit,
} from "../types";

interface GuidePromotionsViewProps {
  businessId: string;
}

export function GuidePromotionsView({ businessId }: GuidePromotionsViewProps) {
  const [business, setBusiness] = React.useState<BusinessDetailDto | null>(null);
  const [promotions, setPromotions] = React.useState<GuidePromotionDto[]>([]);
  const [taxonomy, setTaxonomy] = React.useState<GuideTaxonomyData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Form State
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [areaId, setAreaId] = React.useState("hoi-an");
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>(["heritage"]);
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>(["storytelling"]);
  const [experienceDuration, setExperienceDuration] = React.useState("3 giờ");
  const [priceAmount, setPriceAmount] = React.useState<number>(500000);
  const [priceUnit, setPriceUnit] = React.useState<IndicativePriceUnit>("PER_PERSON");
  const [coverImageRef, setCoverImageRef] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [b, list, tax] = await Promise.all([
        getBusinessDetail(businessId),
        getGuidePromotions(businessId),
        getGuideTaxonomy().catch(() => null),
      ]);
      setBusiness(b);
      setPromotions(list || []);
      setTaxonomy(tax);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách bài quảng bá");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateDraft = async () => {
    if (!title.trim() || !summary.trim()) {
      setFormError("Vui lòng điền tiêu đề và tóm tắt bài giới thiệu dịch vụ");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const req: CreateGuidePromotionDraftRequest = {
        title: title.trim(),
        summary: summary.trim(),
        areaId,
        topicIds: selectedTopics,
        skillIds: selectedSkills,
        experienceDuration,
        indicativePriceAmount: priceAmount,
        indicativePriceCurrency: "VND",
        indicativePriceUnit: priceUnit,
        coverImageRef: coverImageRef.trim() || undefined,
        inclusions: ["Hướng dẫn viên chuyên nghiệp", "Nước uống"],
        exclusions: ["Chi phí cá nhân", "Vé vào cổng"],
      };

      const created = await createGuidePromotion(businessId, req);

      // Auto submit draft for review if created
      if (created.currentRevision) {
        await submitGuidePromotion(businessId, created.id, {
          expectedVersion: created.version,
          expectedRevisionId: created.currentRevision.id,
        });
      }

      setCreateModalOpen(false);
      setTitle("");
      setSummary("");
      loadAll();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Lỗi khi tạo bài quảng bá");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCommunity = async (promo: GuidePromotionDto) => {
    try {
      const nextEnabled = !promo.communityEnabled;
      if (!promo.approvedRevisionId) {
        alert("Bài quảng bá cần được Admin phê duyệt trước khi phân phối qua Community!");
        return;
      }

      const res = await updateCommunityPublication(businessId, promo.id, {
        expectedVersion: promo.version,
        expectedRevisionId: promo.approvedRevisionId,
        enabled: nextEnabled,
      });

      setPromotions((prev) =>
        prev.map((p) =>
          p.id === promo.id
            ? {
                ...p,
                communityEnabled: res.desiredEnabled,
                communityPostId: res.postId,
                distributionVersion: res.distributionVersion,
              }
            : p,
        ),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi cập nhật phân phối");
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Navigation & Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
          <Link href="/partner">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại Trung tâm Đối tác
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Bài quảng bá chuyên môn HDV
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cơ sở: <span className="font-semibold text-foreground">{business?.displayName || "..."}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Làm mới
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Soạn bài quảng bá mới
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : promotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Chưa có bài quảng bá nào</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            Tạo bài giới thiệu gói dịch vụ chuyên môn để thu hút du khách và phân phối qua Community.
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Soạn bài đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map((promo) => {
            const rev = promo.currentRevision;
            const isApproved = !!promo.approvedRevisionId;

            return (
              <Card key={promo.id} className="flex flex-col overflow-hidden border-border/80 hover:shadow-md transition-all">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-base tracking-tight line-clamp-1">
                      {rev?.title || "Bài quảng bá chưa đặt tên"}
                    </h3>

                    {isApproved ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <CheckCircle className="mr-1 h-3 w-3" /> Đã duyệt
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">
                        <Clock className="mr-1 h-3 w-3" /> Đang xét duyệt
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {rev?.summary}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 px-5 py-2 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-micro">
                      Khu vực: {rev?.areaId}
                    </Badge>
                    {rev?.experienceDuration && (
                      <Badge variant="outline" className="text-micro">
                        {rev.experienceDuration}
                      </Badge>
                    )}
                    {rev?.indicativePriceAmount && (
                      <Badge variant="outline" className="text-micro font-semibold text-primary">
                        {rev.indicativePriceAmount.toLocaleString("vi-VN")} VND / {rev.indicativePriceUnit}
                      </Badge>
                    )}
                  </div>

                  {/* Community Distribution status (§7) */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Share2 className="h-3.5 w-3.5 text-primary" /> Phân phối qua Community
                      </span>
                      <span className={`text-[11px] font-semibold ${promo.communityEnabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {promo.communityEnabled ? "Đang bật" : "Tắt"}
                      </span>
                    </div>

                    {promo.communityPostId && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>Bài viết cộng đồng:</span>
                        <Link
                          href={`/community/posts/${promo.communityPostId}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Xem bài <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs flex-1"
                    onClick={() => handleToggleCommunity(promo)}
                    disabled={!isApproved}
                  >
                    {promo.communityEnabled ? "Tạm ngắt Community" : "Phân phối ra Community"}
                  </Button>

                  <Button asChild variant="secondary" size="sm" className="h-8 text-xs">
                    <Link href={`/guide-promotions/${promo.id}`}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Xem trang
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Guide Promotion Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Soạn bài giới thiệu dịch vụ chuyên môn</DialogTitle>
            <DialogDescription>
              Bài viết sẽ được Ban quản trị thẩm định trước khi mở phân phối ra Community.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Tiêu đề gói trải nghiệm</label>
              <Input
                placeholder="VD: Khám phá di sản phố cổ Hội An & Ẩm thực đêm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Tóm tắt nội dung & trải nghiệm</label>
              <Textarea
                rows={3}
                placeholder="Mô tả các điểm nhấn, câu chuyện văn hóa bạn sẽ mang lại cho du khách..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Khu vực địa bàn</label>
                <Input
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  placeholder="hoi-an, da-nang..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Thời lượng trải nghiệm</label>
                <Input
                  value={experienceDuration}
                  onChange={(e) => setExperienceDuration(e.target.value)}
                  placeholder="3 giờ, nửa ngày..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Mức giá tham khảo (VND)</label>
                <Input
                  type="number"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Đơn vị tính giá</label>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as IndicativePriceUnit)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="PER_PERSON">Theo người (PER_PERSON)</option>
                  <option value="PER_GROUP">Theo đoàn (PER_GROUP)</option>
                  <option value="PER_HOUR">Theo giờ (PER_HOUR)</option>
                  <option value="PER_DAY">Theo ngày (PER_DAY)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Ảnh bìa (URL tham chiếu)</label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={coverImageRef}
                onChange={(e) => setCoverImageRef(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={handleCreateDraft} disabled={submitting}>
              {submitting ? "Đang gửi..." : "Tạo & Nộp xét duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
