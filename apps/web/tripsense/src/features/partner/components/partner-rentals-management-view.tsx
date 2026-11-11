"use client";

import * as React from "react";
import Link from "next/link";
import {
  Car,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Package,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  X,
  Loader2,
  ImagePlus,
  PauseCircle,
  PlayCircle,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  validatePartnerImageFile,
  createPartnerImagePreview,
  releasePartnerImagePreview,
} from "../utils/partner-image-file";
import {
  getPartnerRentalItems,
  createPartnerRentalItem,
  updatePartnerRentalItem,
  deletePartnerRentalItem,
  uploadRentalItemImage,
  deleteUnreferencedRentalItemImage,
} from "../services/rental-api";
import type {
  RentalItemDto,
  CreateRentalItemRequest,
  UpdateRentalItemRequest,
  RentalCategory,
  PickupOption,
} from "../types";

import {
  isRentalItemActive,
  supportsRentalDelivery,
  toSafeDisplayImageUrl as toDisplayImageUrl,
} from "../utils/rental-display";

export interface PartnerRentalsManagementViewProps {
  businessId: string;
}

const RENTAL_IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
};

const CATEGORY_LABELS: Record<RentalCategory, { label: string; icon: string }> = {
  CAR_4_SEATS: { label: "Ô tô 4 chỗ", icon: "🚗" },
  CAR_7_SEATS: { label: "Ô tô 7 chỗ", icon: "🚙" },
  MOTORBIKE_SCOOTER: { label: "Xe máy tay ga", icon: "🛵" },
  MOTORBIKE_MANUAL: { label: "Xe máy số / Côn", icon: "🏍️" },
  BICYCLE: { label: "Xe đạp địa hình / dạo phố", icon: "🚲" },
  CAMPING_GEAR: { label: "Lều trại & Đồ dã ngoại", icon: "⛺" },
  WATER_SPORTS: { label: "SUP & Thể thao nước", icon: "🏄" },
  OTHER: { label: "Dịch vụ khác", icon: "📦" },
};

export function PartnerRentalsManagementView({ businessId }: PartnerRentalsManagementViewProps) {
  const [items, setItems] = React.useState<RentalItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<RentalItemDto | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<RentalCategory>("MOTORBIKE_SCOOTER");
  const [description, setDescription] = React.useState("");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");
  const [pendingImageFile, setPendingImageFile] = React.useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = React.useState<string>("");
  const [showManualUrlInput, setShowManualUrlInput] = React.useState(false);
  const [pricePerDay, setPricePerDay] = React.useState<number | "">(150000);
  const [pricePerHour, setPricePerHour] = React.useState<number | "">("");
  const [depositAmount, setDepositAmount] = React.useState<number | "">(500000);
  const [totalInventory, setTotalInventory] = React.useState<number | "">(5);
  const [pickupOption, setPickupOption] = React.useState<PickupOption>("BOTH");
  const [deliveryFee, setDeliveryFee] = React.useState<number | "">(0);
  const [itemActive, setItemActive] = React.useState(true);
  const [specSeats, setSpecSeats] = React.useState("");
  const [specFuel, setSpecFuel] = React.useState("");
  const [specTransmission, setSpecTransmission] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPartnerRentalItems(businessId);
      setItems(data);
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể tải danh sách phương tiện & dịch vụ cho thuê."));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  React.useEffect(() => {
    return () => {
      releasePartnerImagePreview(previewImageUrl);
    };
  }, [previewImageUrl]);

  const clearPendingImage = () => {
    releasePartnerImagePreview(previewImageUrl);
    setPendingImageFile(null);
    setPreviewImageUrl("");
    setThumbnailUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCloseModal = (open: boolean) => {
    if (!open) {
      releasePartnerImagePreview(previewImageUrl);
      setPendingImageFile(null);
      setPreviewImageUrl("");
      setModalError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setIsModalOpen(open);
  };

  const handleSelectImageFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validatePartnerImageFile(file, RENTAL_IMAGE_RULES);
    if (validationError === "invalidType") {
      setModalError("Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WEBP.");
      return;
    }
    if (validationError === "tooLarge") {
      setModalError("Dung lượng ảnh tối đa 5 MB.");
      return;
    }
    releasePartnerImagePreview(previewImageUrl);
    setModalError(null);
    setPendingImageFile(file);
    setPreviewImageUrl(createPartnerImagePreview(file));
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName("");
    setCategory("MOTORBIKE_SCOOTER");
    setDescription("");
    setThumbnailUrl("");
    releasePartnerImagePreview(previewImageUrl);
    setPendingImageFile(null);
    setPreviewImageUrl("");
    setShowManualUrlInput(false);
    setModalError(null);
    setPricePerDay(150000);
    setPricePerHour("");
    setDepositAmount(500000);
    setTotalInventory(5);
    setPickupOption("BOTH");
    setDeliveryFee(0);
    setItemActive(true);
    setSpecSeats("");
    setSpecFuel("");
    setSpecTransmission("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RentalItemDto) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description || "");
    const existingThumb = toDisplayImageUrl(item.thumbnailUrl || item.images?.[0]) || "";
    setThumbnailUrl(existingThumb);
    releasePartnerImagePreview(previewImageUrl);
    setPendingImageFile(null);
    setPreviewImageUrl(existingThumb);
    setShowManualUrlInput(false);
    setModalError(null);
    setPricePerDay(item.pricePerDay);
    setPricePerHour(item.pricePerHour || "");
    setDepositAmount(item.depositAmount);
    setTotalInventory(item.totalInventory);
    setPickupOption(supportsRentalDelivery(item) ? "BOTH" : "STORE_PICKUP");
    setDeliveryFee(item.deliveryFee || 0);
    setItemActive(isRentalItemActive(item));

    const specs = item.specifications || {};
    setSpecSeats(specs.seats ? String(specs.seats) : "");
    setSpecFuel(specs.fuel ? String(specs.fuel) : "");
    setSpecTransmission(specs.transmission ? String(specs.transmission) : "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError("Vui lòng nhập tên dịch vụ/phương tiện.");
      return;
    }
    if (!pricePerDay || Number(pricePerDay) <= 0) {
      setModalError("Vui lòng nhập đơn giá thuê theo ngày hợp lệ.");
      return;
    }
    if (!totalInventory || Number(totalInventory) <= 0) {
      setModalError("Vui lòng nhập số lượng tồn kho khả dụng.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setError(null);
    setActionSuccess(null);

    const specifications: Record<string, unknown> = {};
    if (specSeats) specifications.seats = specSeats;
    if (specFuel) specifications.fuel = specFuel;
    if (specTransmission) specifications.transmission = specTransmission;

    let uploadedPublicId: string | null = null;
    let committed = false;

    try {
      let resolvedUrl = thumbnailUrl.trim();
      if (pendingImageFile) {
        const uploaded = await uploadRentalItemImage(businessId, pendingImageFile);
        uploadedPublicId = uploaded.imagePublicId;
        resolvedUrl = uploaded.imageUrl;
      }

      const itemImages = resolvedUrl ? [resolvedUrl] : [];
      const deliveryAvailable = pickupOption !== "STORE_PICKUP" && pickupOption !== "PICKUP_AT_STORE";

      if (editingItem) {
        const payload: UpdateRentalItemRequest = {
          name: name.trim(),
          category,
          description: description.trim() || undefined,
          thumbnailUrl: resolvedUrl || undefined,
          images: itemImages,
          pricePerDay: Number(pricePerDay),
          pricePerHour: pricePerHour ? Number(pricePerHour) : undefined,
          depositAmount: depositAmount ? Number(depositAmount) : 0,
          totalInventory: Number(totalInventory),
          deliveryAvailable,
          pickupOption,
          deliveryFee: deliveryFee ? Number(deliveryFee) : 0,
          specifications,
          active: itemActive,
        };
        await updatePartnerRentalItem(businessId, editingItem.id, payload);
        setActionSuccess(`Cập nhật "${name.trim()}" thành công.`);
      } else {
        const payload: CreateRentalItemRequest = {
          name: name.trim(),
          category,
          description: description.trim() || undefined,
          thumbnailUrl: resolvedUrl || undefined,
          images: itemImages,
          pricePerDay: Number(pricePerDay),
          pricePerHour: pricePerHour ? Number(pricePerHour) : undefined,
          depositAmount: depositAmount ? Number(depositAmount) : 0,
          totalInventory: Number(totalInventory),
          deliveryAvailable,
          pickupOption,
          deliveryFee: deliveryFee ? Number(deliveryFee) : 0,
          specifications,
        };
        await createPartnerRentalItem(businessId, payload);
        setActionSuccess(`Thêm mới "${name.trim()}" vào danh mục thành công.`);
      }

      committed = true;
      handleCloseModal(false);
      await loadItems();
    } catch (err) {
      if (!committed && uploadedPublicId) {
        await Promise.allSettled([
          deleteUnreferencedRentalItemImage(businessId, uploadedPublicId),
        ]);
      }
      setModalError(getSafeErrorMessage(err, "Không thể lưu thông tin cho thuê."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleItemActive = async (item: RentalItemDto) => {
    const nextActive = !isRentalItemActive(item);
    setTogglingId(item.id);
    setError(null);
    setActionSuccess(null);
    try {
      await updatePartnerRentalItem(businessId, item.id, {
        name: item.name,
        category: item.category,
        description: item.description || undefined,
        thumbnailUrl: item.thumbnailUrl || undefined,
        images: item.images,
        pricePerDay: item.pricePerDay,
        pricePerHour: item.pricePerHour || undefined,
        depositAmount: item.depositAmount,
        totalInventory: item.totalInventory,
        deliveryAvailable: supportsRentalDelivery(item),
        pickupOption: item.pickupOption,
        deliveryFee: item.deliveryFee || 0,
        specifications: item.specifications,
        active: nextActive,
      });
      setActionSuccess(
        nextActive
          ? `Đã mở lại cho thuê "${item.name}".`
          : `Đã tạm ngưng cho thuê "${item.name}".`,
      );
      await loadItems();
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể cập nhật trạng thái phương tiện."));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item: RentalItemDto) => {
    if (!confirm(`Bạn có chắc muốn xóa dịch vụ "${item.name}"?`)) return;
    try {
      await deletePartnerRentalItem(businessId, item.id);
      setActionSuccess(`Đã xóa "${item.name}".`);
      await loadItems();
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể xóa dịch vụ cho thuê."));
    }
  };

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Link href="/partner/services">
            <ChevronLeft className="h-4 w-4" /> Quay lại Trung tâm Dịch vụ
          </Link>
        </Button>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Quản lý Phương tiện & Dịch vụ cho thuê
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cấu hình xe máy, ô tô tự lái, lều trại, đồ thể thao nước với tồn kho và đơn giá minh bạch.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadItems}
            disabled={loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="h-9 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Thêm phương tiện / Dịch vụ
          </Button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Items Catalog */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-8 w-8 text-teal-600" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
              <Package className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Chưa có phương tiện hoặc dịch vụ cho thuê nào</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Hãy thêm xe máy, ô tô, hoặc thiết bị dã ngoại đầu tiên để du khách có thể đặt thuê ngay trên TripSense.
              </p>
            </div>
            <Button onClick={handleOpenAdd} size="sm" className="mt-2 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs">
              <Plus className="h-3.5 w-3.5" /> Thêm ngay bây giờ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const cat = CATEGORY_LABELS[item.category] || { label: item.category, icon: "📦" };
            const active = isRentalItemActive(item);
            const hasDelivery = supportsRentalDelivery(item);
            const cardImage = toDisplayImageUrl(item.thumbnailUrl || item.images?.[0]);
            return (
              <Card key={item.id} className="overflow-hidden border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
                <div>
                  {cardImage ? (
                    <div className="aspect-[16/9] bg-muted overflow-hidden border-b border-border/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cardImage} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400 text-micro gap-1">
                        <span>{cat.icon}</span> {cat.label}
                      </Badge>
                      <Badge variant="outline" className={active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-micro" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-micro"}>
                        {active ? "Đang mở cho thuê" : "Tạm ngưng"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground mt-2 line-clamp-1">
                      {item.name}
                    </CardTitle>
                    {item.description && (
                      <CardDescription className="text-xs line-clamp-2 mt-1">
                        {item.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                </div>

                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Giá thuê theo ngày:</span>
                      <span className="font-bold text-foreground text-sm">{formatVnd(item.pricePerDay)}</span>
                    </div>
                    {item.depositAmount > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Tiền cọc thiết bị/xe:</span>
                        <span>{formatVnd(item.depositAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Tổng tồn kho:</span>
                      <span className="font-semibold text-foreground">{item.totalInventory} xe / bộ</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Giao nhận:</span>
                      <span className="font-medium text-foreground">
                        {hasDelivery ? "Tại cửa hàng & Tận nơi" : "Tại cửa hàng"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={togglingId === item.id}
                      onClick={() => handleToggleItemActive(item)}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {togglingId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : active ? (
                        <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      {active ? "Tạm ngưng" : "Mở lại"}
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 text-xs gap-1"
                      >
                        <Edit2 className="h-3 w-3" /> Sửa
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Xóa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-teal-600" />
              {editingItem ? "Chỉnh sửa dịch vụ cho thuê" : "Thêm phương tiện / Dịch vụ mới"}
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết và tải ảnh thực tế lên Cloud để du khách xem và đặt thuê.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {modalError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tên xe / Dụng cụ (*)</label>
              <Input
                placeholder="Ví dụ: Honda Vision 110cc, Ô tô Toyota Vios tự lái, Lều trại Eureka 4 người..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Loại danh mục (*)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RentalCategory)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.icon} {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Hình thức giao nhận (*)</label>
                <select
                  value={pickupOption}
                  onChange={(e) => setPickupOption(e.target.value as PickupOption)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                >
                  <option value="BOTH">Cả hai (Tại cửa hàng & Tận nơi)</option>
                  <option value="STORE_PICKUP">Chỉ lấy tại cửa hàng</option>
                  <option value="DOOR_DELIVERY">Chỉ giao tận nơi (khách sạn/sân bay)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Giá thuê / ngày (VNĐ) (*)</label>
                <Input
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="150000"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Tiền đặt cọc (VNĐ)</label>
                <Input
                  type="number"
                  min="0"
                  step="50000"
                  placeholder="500000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Số lượng tồn kho (*)</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="5"
                  value={totalInventory}
                  onChange={(e) => setTotalInventory(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Hình ảnh phương tiện / thiết bị (Cloud)</label>
                <button
                  type="button"
                  onClick={() => setShowManualUrlInput((prev) => !prev)}
                  className="text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  {showManualUrlInput ? "Ẩn nhập URL" : "Hoặc dán URL ảnh"}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => handleSelectImageFile(e.target.files?.[0])}
              />

              {toDisplayImageUrl(previewImageUrl || thumbnailUrl) ? (
                <div className="rounded-xl border border-border/80 bg-muted/20 overflow-hidden">
                  <div className="aspect-[16/9] max-h-48 w-full bg-muted overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toDisplayImageUrl(previewImageUrl || thumbnailUrl) ?? ""}
                      alt={name || "Preview"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-background/80 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground truncate">
                      {pendingImageFile ? `Sẵn sàng tải lên Cloud: ${pendingImageFile.name}` : "Ảnh đang sử dụng"}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-3 w-3" /> Đổi ảnh
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        onClick={clearPendingImage}
                      >
                        <X className="h-3 w-3" /> Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border hover:border-teal-500/60 hover:bg-teal-500/5 transition-colors p-5 text-center flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    Nhấn để chọn ảnh từ máy tải lên Cloud
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Hỗ trợ JPG, PNG, WEBP (tối đa 5 MB)
                  </span>
                </button>
              )}

              {showManualUrlInput && (
                <Input
                  placeholder="https://res.cloudinary.com/... hoặc link ảnh trực tiếp"
                  value={thumbnailUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (pendingImageFile) {
                      releasePartnerImagePreview(previewImageUrl);
                      setPendingImageFile(null);
                    }
                    setThumbnailUrl(val);
                    setPreviewImageUrl(val);
                  }}
                  className="text-xs"
                />
              )}
            </div>

            {editingItem && (
              <label className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3 text-xs cursor-pointer">
                <div>
                  <span className="font-semibold text-foreground block">Trạng thái mở cho thuê</span>
                  <span className="text-[11px] text-muted-foreground">
                    Bật để hiển thị mục này trên trang đặt xe của du khách.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={itemActive}
                  onChange={(e) => setItemActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-teal-600"
                />
              </label>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Mô tả chi tiết & Phụ kiện kèm theo</label>
              <Textarea
                rows={3}
                placeholder="Bao gồm 2 mũ bảo hiểm, áo mưa, gá điện thoại. Xe đã bảo dưỡng phanh và thay dầu định kỳ..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Vehicle Specs (Optional) */}
            {(category.includes("CAR") || category.includes("MOTORBIKE")) && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                <span className="text-xs font-semibold text-foreground block">Thông số kỹ thuật (Tùy chọn)</span>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Số chỗ ngồi (vd: 5 chỗ)"
                    value={specSeats}
                    onChange={(e) => setSpecSeats(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Hộp số (Tự động / Số sàn)"
                    value={specTransmission}
                    onChange={(e) => setSpecTransmission(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Nhiên liệu (Xăng / Điện)"
                    value={specFuel}
                    onChange={(e) => setSpecFuel(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => handleCloseModal(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? "Cập nhật" : "Lưu dịch vụ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
