"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";

interface PostActionsMenuProps {
  postId: string;
  canDelete: boolean;
  onDeleteClick: () => void;
  onReportClick?: () => void;
  showDetailLink?: boolean;
}

export function PostActionsMenu({
  postId,
  canDelete,
  onDeleteClick,
  onReportClick,
  showDetailLink = true,
}: PostActionsMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={t("common.actions")}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{t("social.options")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent
        align="end"
        className="w-44 rounded-xl p-1.5 shadow-sm"
      >
        {showDetailLink && (
          <DropdownMenuItem
            asChild
            className="gap-2.5 rounded-lg text-sm cursor-pointer"
          >
            <Link href={`/community/posts/${postId}`}>
              <Eye className="h-4 w-4 text-muted-foreground" />
              {t("social.viewDetail")}
            </Link>
          </DropdownMenuItem>
        )}

        {(canDelete || onReportClick) && showDetailLink && (
          <DropdownMenuSeparator />
        )}

        {onReportClick && !canDelete && (
          <DropdownMenuItem
            onClick={onReportClick}
            className="gap-2.5 rounded-lg text-sm cursor-pointer"
          >
            <Flag className="h-4 w-4 text-muted-foreground" />
            {t("social.reportPost")}
          </DropdownMenuItem>
        )}

        {canDelete && (
          <DropdownMenuItem
            onClick={onDeleteClick}
            className="gap-2.5 rounded-lg text-sm cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {t("social.deletePost")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
