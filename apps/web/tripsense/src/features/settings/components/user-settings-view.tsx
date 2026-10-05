"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles,
  User,
  Shield,
  Bell,
  Globe,
  BellRing,
  Zap,
  Link2,
  Cookie,
  Camera,
  Loader2,
  Save,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useChangePassword } from "@/features/auth";
import { useUserProfile, useUpdateProfile } from "@/features/profile";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { PersonalizationEditor } from "./personalization-editor";
import { socialPostRepository } from "@/features/social-post/services";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

interface SettingsTabItem {
  id: string;
  labelKey: string;
  icon: React.ElementType;
}

const SETTINGS_TABS: readonly SettingsTabItem[] = [
  { id: "personalization", labelKey: "settings.userSettings.tabs.personalization", icon: Sparkles },
  { id: "profile", labelKey: "settings.userSettings.tabs.profile", icon: User },
  { id: "account", labelKey: "settings.userSettings.tabs.account", icon: Shield },
  { id: "alerts", labelKey: "settings.userSettings.tabs.alerts", icon: Bell },
  { id: "language", labelKey: "settings.userSettings.tabs.language", icon: Globe },
  { id: "notifications", labelKey: "settings.userSettings.tabs.notifications", icon: BellRing },
  { id: "early_access", labelKey: "settings.userSettings.tabs.earlyAccess", icon: Zap },
  { id: "connected", labelKey: "settings.userSettings.tabs.connected", icon: Link2 },
  { id: "cookies", labelKey: "settings.userSettings.tabs.cookies", icon: Cookie },
] as const;

export function UserSettingsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const initialTab = searchParams.get("tab") || "personalization";
  const [activeTab, setActiveTab] = React.useState<string>(initialTab);

  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    router.replace(`/settings?tab=${tabId}`);
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Mindtrip Settings Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          <div className="px-3 pb-3 hidden md:block">
            <h2 className="text-base font-bold text-foreground">
              {t("settings.userSettings.title")}
            </h2>
          </div>

          {/* Desktop nav list */}
          <nav className="space-y-0.5">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer",
                    isActive
                      ? "bg-muted font-bold text-foreground shadow-2xs border border-border/40"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 min-w-0 w-full">
          {activeTab === "personalization" && <PersonalizationEditor />}
          {activeTab === "profile" && <ProfileSettingsPanel />}
          {activeTab === "account" && <AccountSettingsPanel />}
          {!["personalization", "profile", "account"].includes(activeTab) && (
            <GenericSettingsPanel
              tab={SETTINGS_TABS.find((t) => t.id === activeTab) || SETTINGS_TABS[0]}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Simple Profile Editor Sub-Panel
function ProfileSettingsPanel() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile(user?.id || "");
  const { mutateAsync: updateProfile, isLoading: isSaving } = useUpdateProfile();
  const { t } = useTranslation();

  const [displayName, setDisplayName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setLocation(profile.location || "");
      setBio(profile.bio || "");
      setWebsite(profile.socialPorts?.website || "");
      setAvatarUrl(profile.avatarUrl || user?.avatar || "");
    }
  }, [profile, user]);

  const handleUploadImage = async (file: File) => {
    try {
      setIsUploadingAvatar(true);
      const signature = await socialPostRepository.getUploadSignature();
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signature.apiKey);
      body.append("timestamp", signature.timestamp.toString());
      body.append("signature", signature.signature);
      if (signature.signature.length === 64) {
        body.append("signature_algorithm", "sha256");
      }
      body.append("folder", signature.folder);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: "POST", body }
      );
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setAvatarUrl(data.secure_url);
    } catch (err) {
      console.error("Failed to upload image", err);
      alert(t("settings.userSettings.profile.uploadError", { defaultValue: "Failed to upload image!" }));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadImage(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        displayName: displayName.trim(),
        location: location.trim(),
        bio: bio.trim(),
        avatarUrl,
        socialPorts: website ? { website: website.trim() } : undefined,
      });
      useAuthStore.getState().updateUserProfile({
        avatar: avatarUrl || undefined,
        name: displayName.trim() || undefined,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // Handled by hook error toast
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t("settings.userSettings.profile.title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.userSettings.profile.manageSubtitle")}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border/50 bg-card p-6 shadow-xs">
        {/* Avatar section */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 group">
            <Avatar className="h-16 w-16 ring-1 ring-border">
              <AvatarImage src={avatarUrl || user?.avatar} alt={user?.name || "User"} />
              <AvatarFallback className="font-bold text-base bg-primary/10 text-primary">
                {(profile?.displayName || user?.name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
              <label className="cursor-pointer text-white">
                {isUploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploadingAvatar || isSaving}
                />
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              @{user?.email ? user.email.split("@")[0] : "user"}
            </p>
            <p className="text-micro text-muted-foreground">
              {profile?.email || user?.email}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("settings.userSettings.profile.displayName")}
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="text-xs bg-background h-9 rounded-xl border-border"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("settings.userSettings.profile.location")}
          </label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("settings.userSettings.profile.locationPlaceholder")}
            className="text-xs bg-background h-9 rounded-xl border-border"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("settings.userSettings.profile.website")}
          </label>
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="text-xs bg-background h-9 rounded-xl border-border"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("settings.userSettings.profile.bio")}
          </label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("settings.userSettings.profile.bioPlaceholder")}
            className="text-xs min-h-[90px] rounded-xl border-border resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          {savedSuccess && (
            <span className="text-micro font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              <span>{t("settings.userSettings.profile.saved")}</span>
            </span>
          )}
          <Button
            type="submit"
            disabled={isSaving || isUploadingAvatar}
            className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 px-5 shadow-xs cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{isSaving ? t("settings.userSettings.profile.saving") : t("settings.userSettings.profile.save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

// Account Details Panel
function AccountSettingsPanel() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.userSettings.account.passwordMismatch", { defaultValue: "New passwords do not match" }));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t("settings.userSettings.account.passwordTooShort", { defaultValue: "Password must be at least 6 characters" }));
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || t("settings.userSettings.account.passwordChangeError", { defaultValue: "Failed to change password" }));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t("settings.userSettings.account.title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.userSettings.account.securitySubtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4 shadow-xs">
        <div className="space-y-1">
          <span className="text-micro text-muted-foreground font-semibold uppercase">Email</span>
          <p className="text-xs font-bold text-foreground font-mono">{user?.email}</p>
        </div>
        <div className="space-y-1 pt-3 border-t border-border/40">
          <span className="text-micro text-muted-foreground font-semibold uppercase">User ID</span>
          <p className="text-micro font-mono text-muted-foreground select-all">{user?.id}</p>
        </div>
        <div className="space-y-1 pt-3 border-t border-border/40">
          <span className="text-micro text-muted-foreground font-semibold uppercase">
            {t("settings.userSettings.account.role")}
          </span>
          <p className="text-xs font-bold text-foreground">{user?.role || "USER"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4 shadow-xs mt-6">
        <h2 className="text-sm font-bold text-foreground">
          {t("settings.userSettings.account.changePasswordTitle", { defaultValue: "Change Password" })}
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              {t("settings.userSettings.account.currentPassword", { defaultValue: "Current Password" })}
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="text-xs bg-background h-9 rounded-xl border-border"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              {t("settings.userSettings.account.newPassword", { defaultValue: "New Password" })}
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="text-xs bg-background h-9 rounded-xl border-border"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              {t("settings.userSettings.account.confirmPassword", { defaultValue: "Confirm Password" })}
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="text-xs bg-background h-9 rounded-xl border-border"
              required
              minLength={6}
            />
          </div>

          {passwordError && (
            <p className="text-xs font-medium text-destructive">{passwordError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            {passwordSuccess && (
              <span className="text-micro font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                <span>{t("settings.userSettings.account.passwordChanged", { defaultValue: "Password changed successfully" })}</span>
              </span>
            )}
            <Button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 px-5 shadow-xs cursor-pointer"
            >
              {isChangingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{isChangingPassword ? t("settings.userSettings.account.changing", { defaultValue: "Saving..." }) : t("settings.userSettings.account.changePassword", { defaultValue: "Update Password" })}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Generic Placeholder for secondary tabs
function GenericSettingsPanel({ tab }: { tab: SettingsTabItem }) {
  const { t } = useTranslation();
  const Icon = tab.icon;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t(tab.labelKey)}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.userSettings.generic.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center space-y-2 shadow-xs">
        <p className="text-xs font-medium text-foreground">
          {t("settings.userSettings.generic.inDevelopment")}
        </p>
        <p className="text-micro text-muted-foreground">
          {t("settings.userSettings.generic.footer")}
        </p>
      </div>
    </div>
  );
}
