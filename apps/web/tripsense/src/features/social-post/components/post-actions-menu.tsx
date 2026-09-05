"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PostActionsMenuProps {
  postId: string;
  canDelete: boolean;
  onDeleteClick: () => void;
  showDetailLink?: boolean;
}

export function PostActionsMenu({
  postId,
  canDelete,
  onDeleteClick,
  showDetailLink = true,
}: PostActionsMenuProps) {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Thao tác khác"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Tùy chọn</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5 shadow-sm">
        {showDetailLink && (
          <DropdownMenuItem asChild className="gap-2.5 rounded-lg text-sm cursor-pointer">
            <Link href={`/community/posts/${postId}`}>
              <Eye className="h-4 w-4 text-muted-foreground" />
              Xem chi tiết
            </Link>
          </DropdownMenuItem>
        )}

        {canDelete && showDetailLink && <DropdownMenuSeparator />}

        {canDelete && (
          <DropdownMenuItem
            onClick={onDeleteClick}
            className="gap-2.5 rounded-lg text-sm cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Xóa bài viết
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
