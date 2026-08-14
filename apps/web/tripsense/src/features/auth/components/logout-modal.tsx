"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Laptop, Globe, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/auth-context";

interface LogoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogoutModal({ open, onOpenChange }: LogoutModalProps) {
  const router = useRouter();
  const { logout, logoutAll } = useAuth();
  const [loadingType, setLoadingType] = React.useState<"current" | "all" | null>(null);

  const handleLogoutCurrentDevice = async () => {
    setLoadingType("current");
    try {
      await logout();
      onOpenChange(false);
      router.push("/");
    } catch {
      onOpenChange(false);
      router.push("/");
    } finally {
      setLoadingType(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    setLoadingType("all");
    try {
      await logoutAll();
      onOpenChange(false);
      router.push("/");
    } catch {
      onOpenChange(false);
      router.push("/");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-2xl text-card-foreground">
        <DialogHeader className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 rounded-2xl bg-destructive/10 text-destructive">
            <LogOut className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Log Out</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose whether to log out of your current browser session or revoke access across all devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* Option A: Current Device */}
          <button
            type="button"
            disabled={loadingType !== null}
            onClick={handleLogoutCurrentDevice}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:bg-accent text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-muted group-hover:bg-background text-foreground transition-colors">
                <Laptop className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Log out of this device</p>
                <p className="text-xs text-muted-foreground">Đăng xuất khỏi thiết bị này</p>
              </div>
            </div>
            {loadingType === "current" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </button>

          {/* Option B: All Devices */}
          <button
            type="button"
            disabled={loadingType !== null}
            onClick={handleLogoutAllDevices}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive transition-colors">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-destructive">Log out of all devices</p>
                <p className="text-xs text-destructive/80">Đăng xuất khỏi tất cả thiết bị</p>
              </div>
            </div>
            {loadingType === "all" && <Loader2 className="h-4 w-4 animate-spin text-destructive" />}
          </button>
        </div>

        <div className="pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loadingType !== null}
            className="w-full rounded-full text-xs font-semibold"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
