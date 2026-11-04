"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
  AlertCircle,
  Phone,
  Mail,
  Shield,
  ArrowUpDown,
  Calendar,
  ImagePlus,
  X,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RestaurantReservationsTab } from "./restaurant-reservations-tab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  getBusinessDetail,
  getRestaurantMenu,
  updateContactSharing,
  updateRestaurantMenu,
  uploadRestaurantMenuImage,
  deleteUnreferencedRestaurantMenuImage,
} from "../services/partner-api";
import type { BusinessDetailDto, RestaurantMenuItemDto } from "../types";
import {
  createPartnerImagePreview,
  releasePartnerImagePreview,
  validatePartnerImageFile,
} from "../utils/partner-image-file";

interface RestaurantMenuViewProps {
  businessId: string;
}

export function RestaurantMenuView({ businessId }: RestaurantMenuViewProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "reservations" ? "reservations" : "menu";
  const [business, setBusiness] = React.useState<BusinessDetailDto | null>(null);
  const [items, setItems] = React.useState<RestaurantMenuItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(initialTab);

  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "reservations" || tabParam === "menu") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Image Upload & Swap State
  const batchUploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const swapImageInputRef = React.useRef<HTMLInputElement | null>(null);
  const [swappingIndex, setSwappingIndex] = React.useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = React.useState<{ url: string; title: string } | null>(null);
  const pendingImageFilesRef = React.useRef<Record<string, File>>({});

  // Contact sharing
  const [savingConsent, setSavingConsent] = React.useState(false);
  const isOwner = business?.myRole === "OWNER";

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [biz, menu] = await Promise.all([
        getBusinessDetail(businessId),
        getRestaurantMenu(businessId).catch(() => []),
      ]);
      setBusiness(biz);
      setItems(menu || []);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError")));
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Clean up previews on unmount
  React.useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.imageUrl?.startsWith("blob:")) {
          releasePartnerImagePreview(item.imageUrl);
        }
      });
    };
  }, [items]);

  // Handle Batch Image Upload
  const handleBatchUpload = (fileList: FileList) => {
    setError(null);
    setSuccessMsg(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newItems: RestaurantMenuItemDto[] = [];
    let addedCount = 0;

    files.forEach((file, idx) => {
      const valErr = validatePartnerImageFile(file, {
        maxBytes: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      if (valErr) {
        setError(t(valErr === "tooLarge" ? "partner.restaurant.dishImageTooLarge" : "partner.restaurant.dishImageInvalid"));
        return;
      }

      const draftId = crypto.randomUUID();
      const previewUrl = createPartnerImagePreview(file);
      pendingImageFilesRef.current[draftId] = file;

      const cleanFileName = file.name.replace(/\.[^/.]+$/, "").trim();
      const title = cleanFileName ? cleanFileName.slice(0, 80) : `Ảnh thực đơn ${items.length + idx + 1}`;

      newItems.push({
        id: draftId,
        name: title,
        category: "Thực đơn & Bảng giá",
        price: 1, // Satisfies minimum valid price
        currency: "VND",
        available: true,
        displayOrder: items.length + idx + 1,
        imageUrl: previewUrl,
      });
      addedCount++;
    });

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setSuccessMsg(`Đã thêm ${addedCount} ảnh thực đơn. Nhấn "Lưu thay đổi" để hoàn tất.`);
    }
  };

  // Handle Swap / Replace Photo
  const handleStartSwap = (index: number) => {
    setSwappingIndex(index);
    swapImageInputRef.current?.click();
  };

  const handleSwapImage = (file: File) => {
    if (swappingIndex === null || swappingIndex < 0 || swappingIndex >= items.length) return;
    setError(null);
    setSuccessMsg(null);

    const valErr = validatePartnerImageFile(file, {
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (valErr) {
      setError(t(valErr === "tooLarge" ? "partner.restaurant.dishImageTooLarge" : "partner.restaurant.dishImageInvalid"));
      return;
    }

    const currentItem = items[swappingIndex];
    if (currentItem.imageUrl?.startsWith("blob:")) {
      releasePartnerImagePreview(currentItem.imageUrl);
    }

    const newPreviewUrl = createPartnerImagePreview(file);
    const targetId = currentItem.id || crypto.randomUUID();
    pendingImageFilesRef.current[targetId] = file;

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === swappingIndex
          ? {
              ...it,
              id: targetId,
              imageUrl: newPreviewUrl,
              imagePublicId: undefined, // Will be set upon saving
            }
          : it,
      ),
    );

    setSuccessMsg(`Đã thay ảnh thành công cho "${currentItem.name}". Nhấn "Lưu thay đổi" để áp dụng.`);
    setSwappingIndex(null);
  };

  const handleRemovePhoto = (index: number) => {
    const target = items[index];
    if (target?.id) {
      delete pendingImageFilesRef.current[target.id];
    }
    if (target?.imageUrl?.startsWith("blob:")) {
      releasePartnerImagePreview(target.imageUrl);
    }
    setItems((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((it, idx) => ({ ...it, displayOrder: idx + 1 }));
    });
  };

  const handleUpdateTitle = (index: number, newTitle: string) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, name: newTitle } : it)),
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const copy = [...items];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    copy.forEach((it, idx) => {
      it.displayOrder = idx + 1;
    });
    setItems(copy);
  };

  const handleSaveMenu = async () => {
    if (!business) return;
    const newlyUploaded: string[] = [];
    let menuCommitted = false;
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      const itemsToSave: RestaurantMenuItemDto[] = [];

      for (const item of items) {
        const pendingFile = item.id ? pendingImageFilesRef.current[item.id] : undefined;
        if (!pendingFile) {
          const { imageUrl: _imageUrl, ...payload } = item;
          itemsToSave.push(payload);
          continue;
        }

        const uploaded = await uploadRestaurantMenuImage(businessId, pendingFile);
        newlyUploaded.push(uploaded.imagePublicId);
        const { imageUrl: _imageUrl, ...payload } = item;
        itemsToSave.push({ ...payload, imagePublicId: uploaded.imagePublicId });
      }

      const updated = await updateRestaurantMenu(businessId, {
        items: itemsToSave,
        expectedVersion: business.version,
      });

      menuCommitted = true;
      items.forEach((item) => {
        if (item.imageUrl?.startsWith("blob:")) {
          releasePartnerImagePreview(item.imageUrl);
        }
      });
      setItems(updated);
      pendingImageFilesRef.current = {};
      setSuccessMsg("Đã lưu ảnh thực đơn & bảng giá thành công!");

      try {
        const refreshedBiz = await getBusinessDetail(businessId);
        setBusiness(refreshedBiz);
      } catch {
        // Keep committed state
      }
    } catch (err: unknown) {
      if (!menuCommitted) {
        await Promise.allSettled(
          newlyUploaded.map((imagePublicId) =>
            deleteUnreferencedRestaurantMenuImage(businessId, imagePublicId),
          ),
        );
      }
      setError(getSafeErrorMessage(err, "Không thể lưu thực đơn. Vui lòng thử lại sau."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleContactSharing = async (checked: boolean) => {
    if (!business || !isOwner) return;
    try {
      setSavingConsent(true);
      setError(null);
      await updateContactSharing(businessId, {
        expectedVersion: business.version,
        publicContactConsent: checked,
      });
      const refreshedBiz = await getBusinessDetail(businessId);
      setBusiness(refreshedBiz);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError")));
    } finally {
      setSavingConsent(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/partner">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Thực đơn & Bảng giá
              </h1>
              <Badge variant="outline" className="text-xs">
                {business?.displayName || "Cơ sở kinh doanh"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tải ảnh thực đơn, bảng giá hoặc danh thiếp của cơ sở để du khách tham khảo trực tuyến.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={`/restaurants/${businessId}`} target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Xem trang đón khách
            </Link>
          </Button>

          {activeTab === "menu" && (
            <Button
              size="sm"
              onClick={handleSaveMenu}
              disabled={saving}
              className="h-8 text-xs gap-1.5 font-medium shadow-xs"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Lưu thay đổi
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-10 p-1 bg-muted/60 border border-border/50">
          <TabsTrigger value="menu" className="gap-2 text-xs font-medium">
            <Utensils className="h-3.5 w-3.5" />
            Thực đơn & Bảng giá
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2 text-xs font-medium">
            <Calendar className="h-3.5 w-3.5" />
            Yêu cầu đặt bàn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6 mt-0">
          {/* Notifications */}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Owner Contact Sharing Settings Card */}
          {isOwner && (
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Chia sẻ thông tin liên hệ công khai
                </CardTitle>
                <CardDescription className="text-xs">
                  Cho phép hiển thị số điện thoại và email liên hệ trên trang giới thiệu nhà hàng để khách có thể chủ động liên hệ đặt chỗ.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4 border border-border/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Công khai số điện thoại & email
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Boolean(business.contactConsentVersion)
                        ? "Đang cho phép hiển thị liên hệ công khai."
                        : "Hiện đang ẩn thông tin liên hệ cá nhân."}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(business.contactConsentVersion)}
                    disabled={savingConsent}
                    onCheckedChange={handleToggleContactSharing}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Menu Photos Management Card */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-primary" />
                  Ảnh thực đơn & Bảng giá ({items.length} ảnh)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Chỉ cần tải ảnh chụp thực đơn hoặc bảng giá của quán. Bạn có thể thay đổi hoặc xóa ảnh bất kỳ lúc nào mà không cần nhập từng món.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={batchUploadInputRef}
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleBatchUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  type="file"
                  ref={swapImageInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleSwapImage(e.target.files[0]);
                    e.target.value = "";
                  }}
                />

                <Button
                  type="button"
                  size="sm"
                  onClick={() => batchUploadInputRef.current?.click()}
                  className="h-9 gap-1.5 font-medium shadow-2xs"
                >
                  <ImagePlus className="h-4 w-4" />
                  Tải ảnh thực đơn
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveMenu}
                  disabled={saving}
                  className="h-9 gap-1.5 font-medium border-primary/40 text-primary hover:bg-primary/5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu thay đổi
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
              {items.length === 0 ? (
                <div
                  onClick={() => batchUploadInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors p-10 text-center bg-card/40 cursor-pointer group"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 group-hover:scale-105 transition-transform">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    Chưa có ảnh thực đơn nào
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                    Nhấn vào đây để tải ảnh chụp thực đơn, bảng giá món ăn hoặc bảng hiệu của quán. Du khách sẽ nhìn thấy trực tiếp các trang ảnh này.
                  </p>
                  <Button type="button" size="sm" className="gap-2 pointer-events-none">
                    <ImagePlus className="h-4 w-4" /> Chọn ảnh tải lên
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((item, index) => (
                      <div
                        key={item.id || index}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-sm transition-all"
                      >
                        {/* Image Preview Container */}
                        <div
                          className="relative aspect-[3/4] w-full bg-muted/60 overflow-hidden cursor-pointer"
                          onClick={() => setLightboxPhoto({ url: item.imageUrl || "", title: item.name })}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform group-hover:scale-102"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImagePlus className="h-8 w-8 opacity-40" />
                            </div>
                          )}

                          {/* Trang # badge */}
                          <div className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-micro font-medium text-white">
                            Trang {index + 1}
                          </div>

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="rounded-full bg-white/90 p-2 text-foreground shadow-sm">
                              <Eye className="h-4 w-4" />
                            </span>
                          </div>
                        </div>

                        {/* Card Controls */}
                        <div className="p-3 space-y-2 bg-card border-t border-border/50">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateTitle(index, e.target.value)}
                            placeholder={`Trang thực đơn ${index + 1}`}
                            className="h-7 text-xs font-medium px-2"
                          />

                          <div className="flex items-center justify-between gap-1 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartSwap(index)}
                              className="h-7 text-micro gap-1 flex-1 font-medium hover:bg-primary/10 hover:text-primary"
                            >
                              <RefreshCw className="h-3 w-3" /> Thay ảnh
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => handleMove(index, "up")}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Đưa lên trước"
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemovePhoto(index)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="Xóa ảnh"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add More Photos Card in Grid */}
                    <div
                      onClick={() => batchUploadInputRef.current?.click()}
                      className="flex aspect-[3/4] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all p-4 text-center group"
                    >
                      <div className="rounded-full bg-primary/10 p-3 text-primary mb-2 group-hover:scale-110 transition-transform">
                        <Plus className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Thêm ảnh khác</span>
                      <span className="text-micro text-muted-foreground mt-1">Tải thêm trang menu / bảng giá</span>
                    </div>
                  </div>

                  {/* Bottom Save Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Đã có {items.length} ảnh thực đơn. Nhấn &quot;Lưu thay đổi&quot; để áp dụng lên trang công khai.
                    </span>
                    <Button
                      type="button"
                      onClick={handleSaveMenu}
                      disabled={saving}
                      className="gap-1.5 font-medium shadow-xs"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-0">
          <RestaurantReservationsTab businessId={businessId} />
        </TabsContent>
      </Tabs>

      {/* Lightbox Dialog: Fullscreen Preview */}
      <Dialog open={Boolean(lightboxPhoto)} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
        <DialogContent className="sm:max-w-3xl p-3 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-2 pb-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold truncate">
              {lightboxPhoto?.title || "Xem ảnh thực đơn"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 overflow-auto rounded-lg bg-black/5 flex items-center justify-center p-2 min-h-[300px]">
            {lightboxPhoto?.url && (
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
