"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostDetailContent } from "./post-detail-content";

interface PostDetailScreenProps {
  postId: string;
}

export function PostDetailScreen({ postId }: PostDetailScreenProps) {
  const router = useRouter();

  const handlePostDeleted = () => {
    // Navigate back to community feed upon deletion
    router.push("/community");
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Back to Community Link */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground -ml-2"
        >
          <Link href="/community">
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại cộng đồng</span>
          </Link>
        </Button>
      </div>

      {/* Shared Post Detail Content */}
      <PostDetailContent
        postId={postId}
        mode="page"
        onPostDeleted={handlePostDeleted}
      />
    </div>
  );
}
