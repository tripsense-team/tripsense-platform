"use client";

import * as React from "react";
import Link from "next/link";
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
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RestaurantReservationsTab } from "./restaurant-reservations-tab";
import { RestaurantMenuAiUploadModal } from "./restaurant-menu-ai-upload-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "../services/partner-api";
import type { BusinessDetailDto, RestaurantMenuItemDto } from "../types";

interface RestaurantMenuViewProps {
  businessId: string;
}

export function RestaurantMenuView({ businessId }: RestaurantMenuViewProps) {
  const { t } = useTranslation();
  const [business, setBusiness] = React.useState<BusinessDetailDto | null>(null);
  const [items, setItems] = React.useState<RestaurantMenuItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("menu");
  const [aiModalOpen, setAiModalOpen] = React.useState(false);

  // Dialog for add/edit item
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [itemName, setItemName] = React.useState("");
  const [itemCategory, setItemCategory] = React.useState("");
  const [itemPrice, setItemPrice] = React.useState("");
  const [itemDescription, setItemDescription] = React.useState("");
  const [itemTags, setItemTags] = React.useState("");
  const [itemAvailable, setItemAvailable] = React.useState(true);

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

  const handleOpenAddDialog = () => {
    setEditingIndex(null);
    setItemName("");
    setItemCategory("");
    setItemPrice("");
    setItemDescription("");
    setItemTags("");
    setItemAvailable(true);
    setItemDialogOpen(true);
  };

  const handleApplyAiItems = (
    newItems: RestaurantMenuItemDto[],
    mode: "append" | "replace",
  ) => {
    if (mode === "replace") {
      setItems(newItems);
    } else {
      setItems((prev) => {
        const startOrder = prev.length;
        const normalized = newItems.map((it, idx) => ({
          ...it,
          displayOrder: startOrder + idx + 1,
        }));
        return [...prev, ...normalized];
      });
    }
    setSuccessMsg(
      t("partner.restaurant.aiAppliedSuccess", {
        defaultValue: `Đã đưa ${newItems.length} món vào thực đơn. Hãy kiểm tra và nhấn "Lưu" để hoàn tất.`,
      }),
    );
  };

  const handleOpenEditDialog = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setItemName(item.name);
    setItemCategory(item.category || "");
    setItemPrice(String(item.price));
    setItemDescription(item.description || "");
    setItemTags((item.tags || []).join(", "));
    setItemAvailable(item.available);
    setItemDialogOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(itemPrice);
    if (!itemName.trim() || isNaN(priceNum) || priceNum <= 0) {
      return;
    }

    const tagsArray = itemTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newItem: RestaurantMenuItemDto = {
      name: itemName.trim(),
      category: itemCategory.trim() || undefined,
      price: priceNum,
      currency: "VND",
      description: itemDescription.trim() || undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      available: itemAvailable,
      displayOrder: editingIndex !== null ? items[editingIndex].displayOrder : items.length + 1,
    };

    if (editingIndex !== null) {
      setItems((prev) => prev.map((it, idx) => (idx === editingIndex ? { ...it, ...newItem } : it)));
    } else {
      setItems((prev) => [...prev, newItem]);
    }

    setItemDialogOpen(false);
  };

  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleAvailable = (index: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, available: !it.available } : it)),
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
    // Update display orders
    copy.forEach((it, idx) => {
      it.displayOrder = idx + 1;
    });
    setItems(copy);
  };

  const handleSaveMenu = async () => {
    if (!business) return;
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      const updated = await updateRestaurantMenu(businessId, {
        items,
        expectedVersion: business.version,
      });
      setItems(updated);
      setSuccessMsg(t("partner.restaurant.savedSuccess", { defaultValue: "Đã lưu thực đơn thành công!" }));
      // Reload business to update version
      const refreshedBiz = await getBusinessDetail(businessId);
      setBusiness(refreshedBiz);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("partner.restaurant.saveFailed", { defaultValue: "Không thể lưu thực đơn." })));
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
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
          {error || t("partner.businessNotFound", { defaultValue: "Không tìm thấy thông tin cơ sở kinh doanh." })}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs">
              <Link href="/partner">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("common.back")}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">{business.displayName}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("partner.restaurant.menuManagement", { defaultValue: "Quản lý Thực đơn & Dịch vụ" })}
            </h1>
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              <Utensils className="mr-1 h-3 w-3" /> Nhà hàng / Quán ăn
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {business.publicEligible && (
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href={`/restaurants/${business.id}`} target="_blank">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t("partner.restaurant.viewPublic", { defaultValue: "Xem trang công khai" })}
              </Link>
            </Button>
          )}
          {activeTab === "menu" && (
            <Button
              size="sm"
              onClick={handleSaveMenu}
              disabled={saving}
              className="h-9 shadow-xs font-medium"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("common.save")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-10 p-1 bg-muted/60 border border-border/50">
          <TabsTrigger value="menu" className="gap-2 text-xs font-medium">
            <Utensils className="h-3.5 w-3.5" />
            {t("partner.restaurant.tabMenu", { defaultValue: "Thực đơn món ăn" })}
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2 text-xs font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {t("partner.restaurant.tabReservations", { defaultValue: "Yêu cầu đặt bàn" })}
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
              {t("partner.restaurant.contactSharingTitle", { defaultValue: "Chia sẻ thông tin liên hệ công khai" })}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("partner.restaurant.contactSharingDesc", {
                defaultValue: "Cho phép hiển thị số điện thoại và email liên hệ trên trang giới thiệu nhà hàng để khách có thể chủ động liên hệ đặt chỗ.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {t("partner.restaurant.publicContactConsent", { defaultValue: "Công khai thông tin liên hệ" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Boolean(business.contactConsentVersion)
                    ? t("partner.restaurant.consentActive", { defaultValue: "Đang cho phép hiển thị liên hệ công khai." })
                    : t("partner.restaurant.consentInactive", { defaultValue: "Hiện đang ẩn thông tin liên hệ cá nhân." })}
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

      {/* Menu Items Table Card */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-bold">
              {t("partner.restaurant.dishesList", { defaultValue: "Danh sách món ăn & thức uống" })} ({items.length})
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {t("partner.restaurant.dishesDesc", {
                defaultValue: "Thêm món, phân loại theo nhóm và điều chỉnh tình trạng phục vụ của nhà hàng.",
              })}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAiModalOpen(true)}
              className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-medium shadow-2xs"
            >
              <Sparkles className="h-4 w-4" />
              {t("partner.restaurant.aiScanButton", { defaultValue: "Quét menu AI" })}
            </Button>
            <Button size="sm" onClick={handleOpenAddDialog} className="h-9 gap-1.5 font-medium">
              <Plus className="h-4 w-4" /> {t("partner.restaurant.addDish", { defaultValue: "Thêm món mới" })}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-12 text-center bg-card/40">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Utensils className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t("partner.restaurant.noDishesYet", { defaultValue: "Chưa có món nào trong thực đơn" })}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                {t("partner.restaurant.noDishesHelp", {
                  defaultValue: "Hãy bắt đầu thêm các món đặc trưng của nhà hàng để du khách dễ dàng khám phá ẩm thực của bạn.",
                })}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAiModalOpen(true)}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("partner.restaurant.aiScanButton", { defaultValue: "Quét menu AI" })}
                </Button>
                <Button size="sm" onClick={handleOpenAddDialog} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t("partner.restaurant.addDish", { defaultValue: "Thêm món mới" })}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors shadow-2xs"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-foreground">{item.name}</h4>
                      {item.category && (
                        <Badge variant="secondary" className="text-micro font-normal">
                          {item.category}
                        </Badge>
                      )}
                      <Badge
                        variant={item.available ? "outline" : "secondary"}
                        className={
                          item.available
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-micro"
                            : "text-muted-foreground text-micro"
                        }
                      >
                        {item.available
                          ? t("partner.restaurant.available", { defaultValue: "Đang phục vụ" })
                          : t("partner.restaurant.unavailable", { defaultValue: "Tạm ngưng" })}
                      </Badge>
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="font-bold text-foreground font-mono">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: item.currency || "VND",
                        }).format(item.price)}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="rounded-md bg-muted px-1.5 py-0.5 text-micro text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      title="Lên trên"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleToggleAvailable(index)}
                    >
                      {item.available
                        ? t("partner.restaurant.setUnavailable", { defaultValue: "Tắt" })
                        : t("partner.restaurant.setAvailable", { defaultValue: "Bật" })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleOpenEditDialog(index)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="reservations" className="mt-0">
        <RestaurantReservationsTab businessId={businessId} />
      </TabsContent>
      </Tabs>

      {/* Add / Edit Dish Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <form onSubmit={handleSaveItem}>
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null
                  ? t("partner.restaurant.editDish", { defaultValue: "Chỉnh sửa món" })
                  : t("partner.restaurant.addDish", { defaultValue: "Thêm món mới" })}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("partner.restaurant.dishFormHelp", {
                  defaultValue: "Nhập thông tin tên món, mức giá và phân loại vào thực đơn.",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">
                  {t("partner.restaurant.dishName", { defaultValue: "Tên món ăn *" })}
                </label>
                <Input
                  required
                  maxLength={160}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ví dụ: Phở bò đặc biệt, Bánh mì kẹp thịt..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">
                    {t("partner.restaurant.category", { defaultValue: "Danh mục / Phân loại" })}
                  </label>
                  <Input
                    maxLength={80}
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    placeholder="Món chính, Tráng miệng, Đồ uống..."
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">
                    {t("partner.restaurant.price", { defaultValue: "Giá (VND) *" })}
                  </label>
                  <Input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="50000"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {t("partner.restaurant.description", { defaultValue: "Mô tả nguyên liệu / hương vị" })}
                </label>
                <Textarea
                  maxLength={500}
                  rows={3}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Mô tả ngắn gọn về thành phần nguyên liệu, độ cay hoặc điểm nổi bật..."
                  className="text-xs resize-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {t("partner.restaurant.tags", { defaultValue: "Thẻ nhãn (cách nhau bởi dấu phẩy)" })}
                </label>
                <Input
                  value={itemTags}
                  onChange={(e) => setItemTags(e.target.value)}
                  placeholder="dacsan, cay, chay..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border/50">
                <span className="font-medium text-foreground">
                  {t("partner.restaurant.availableLabel", { defaultValue: "Đang sẵn sàng phục vụ" })}
                </span>
                <Switch checked={itemAvailable} onCheckedChange={setItemAvailable} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setItemDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm">
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Menu Upload & Extract Modal */}
      <RestaurantMenuAiUploadModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        onApplyItems={handleApplyAiItems}
      />
    </div>
  );
}
