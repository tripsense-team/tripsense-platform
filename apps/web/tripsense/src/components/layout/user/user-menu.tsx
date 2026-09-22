"use client";

import * as React from "react";
import Link from "next/link";
import { User, Settings, LogOut, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, LogoutModal } from "@/features/auth";
import { useUserProfile } from "@/features/profile";
import { useTranslation } from "@/i18n";

interface UserMenuProps {
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function UserMenu({ user: customUser }: UserMenuProps) {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const activeUser = customUser || authUser;

  const { data: userProfile } = useUserProfile(authUser?.id || "");
  const displayAvatar = userProfile?.avatarUrl || activeUser?.avatar;
  const displayName = userProfile?.email
    ? userProfile.email.split("@")[0] || activeUser?.name
    : activeUser?.name;

  const initials = activeUser?.email
    ? activeUser.email.slice(0, 2).toUpperCase()
    : "TS";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={displayAvatar}
                alt={displayName || activeUser?.email || t("common.guestUser")}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-foreground truncate">
                {displayName || activeUser?.email || t("common.guestUser")}
              </p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {activeUser?.email || "guest@tripsense.app"}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="h-4 w-4" />
                <span>{t("nav.profile")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/collections"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Bookmark className="h-4 w-4" />
                <span>{t("nav.savedPlaces")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>{t("nav.settings")}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setLogoutModalOpen(true)}
            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>{t("common.logOut")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LogoutModal open={logoutModalOpen} onOpenChange={setLogoutModalOpen} />
    </>
  );
}
