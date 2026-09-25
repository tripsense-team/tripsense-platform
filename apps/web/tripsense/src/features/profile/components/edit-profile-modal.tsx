"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserProfile, UpdateProfileRequest } from "../types";
import { socialPostRepository } from "@/features/social-post/services";
import { useUpdateProfile } from "../hooks/use-update-profile";
import { Camera, Globe, Link as LinkIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSuccess: () => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSuccess,
}: EditProfileModalProps) {
  const [bio, setBio] = React.useState(profile?.bio || "");
  const [location, setLocation] = React.useState(profile?.location || "");
  const [facebook, setFacebook] = React.useState(
    profile?.socialPorts?.facebook || "",
  );
  const [instagram, setInstagram] = React.useState(
    profile?.socialPorts?.instagram || "",
  );
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatarUrl || "");
  const [displayName, setDisplayName] = React.useState(
    profile?.displayName || "",
  );
  const [coverUrl, setCoverUrl] = React.useState(profile?.coverUrl || "");

  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [isUploadingCover, setIsUploadingCover] = React.useState(false);

  const { mutateAsync, isLoading: isSaving, error } = useUpdateProfile();

  React.useEffect(() => {
    if (isOpen && profile) {
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setFacebook(profile.socialPorts?.facebook || "");
      setInstagram(profile.socialPorts?.instagram || "");
      setAvatarUrl(profile.avatarUrl || "");
      setDisplayName(profile.displayName || "");
      setCoverUrl(profile.coverUrl || "");
    }
  }, [isOpen, profile]);

  const handleUploadImage = async (file: File, isCover: boolean) => {
    try {
      if (isCover) setIsUploadingCover(true);
      else setIsUploadingAvatar(true);

      const signature = await socialPostRepository.getUploadSignature();
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signature.apiKey);
      body.append("timestamp", signature.timestamp.toString());
      body.append("signature", signature.signature);
      body.append("folder", signature.folder);
      body.append("allowed_formats", signature.allowedFormats.join(","));

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        {
          method: "POST",
          body,
        },
      );

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      if (isCover) setCoverUrl(data.secure_url);
      else setAvatarUrl(data.secure_url);
    } catch (err) {
      console.error("Failed to upload image", err);
      alert("Lỗi khi tải ảnh lên!");
    } finally {
      if (isCover) setIsUploadingCover(false);
      else setIsUploadingAvatar(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isCover: boolean,
  ) => {
    const file = e.target.files?.[0];
    if (file) handleUploadImage(file, isCover);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const socialPorts: Record<string, string> = {};
    if (facebook) socialPorts.facebook = facebook;
    if (instagram) socialPorts.instagram = instagram;

    const payload: UpdateProfileRequest = {
      bio,
      location,
      avatarUrl,
      displayName,
      coverUrl,
      socialPorts,
    };

    try {
      await mutateAsync(payload);
      useAuthStore.getState().updateUserProfile({
        avatar: avatarUrl || undefined,
        name: displayName || undefined,
      });
      onSuccess();
      onClose();
    } catch {
      // Error is handled by hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Chỉnh sửa thông tin cá nhân
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Cover Photo */}
          <div className="relative h-40 bg-muted rounded-xl overflow-hidden flex items-center justify-center group">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground text-sm">
                Chưa có ảnh bìa
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <label className="cursor-pointer bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors text-white flex items-center gap-2 px-4 text-sm font-medium">
                {isUploadingCover ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>{isUploadingCover ? "Đang tải..." : "Đổi ảnh bìa"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, true)}
                  disabled={isUploadingCover}
                />
              </label>
            </div>
          </div>

          {/* Avatar */}
          <div className="relative -mt-16 ml-6 w-24 h-24 group">
            <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-xl">U</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
              <label className="cursor-pointer text-white">
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Camera className="w-6 h-6" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, false)}
                  disabled={isUploadingAvatar}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Tên hiển thị trên Community
              </label>
              <Input
                placeholder="Ví dụ: Minh Hằng"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Tên này và ảnh đại diện có thể xuất hiện trong gợi ý Community;
                email và vị trí của bạn không được hiển thị.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Tiểu sử</label>
              <Textarea
                placeholder="Giới thiệu bản thân..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="resize-none h-20"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Vị trí (Location)</label>
              <Input
                placeholder="Ví dụ: Đà Nẵng, Việt Nam"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" /> Facebook
                </label>
                <Input
                  placeholder="https://facebook.com/..."
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-pink-600" /> Instagram
                </label>
                <Input
                  placeholder="https://instagram.com/..."
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-500">{error.message}</div>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isUploadingAvatar || isUploadingCover}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
