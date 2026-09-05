"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, UserCircle2, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared";
import { useUserPosts } from "../hooks";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";

interface UserPostsScreenProps {
  userId: string;
}

export function UserPostsScreen({ userId }: UserPostsScreenProps) {
  const { posts, author, loading, error, refetch, removePost } = useUserPosts(userId);

  const authorName = author?.name || "Người dùng";
  const authorInitials = React.useMemo(() => {
    if (!author?.name) return "U";
    const parts = author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return author.name.slice(0, 2).toUpperCase();
  }, [author]);

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Back Button */}
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

      {/* User Summary Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-border shadow-2xs">
            <AvatarImage src={author?.avatar} alt={authorName} />
            <AvatarFallback className="bg-muted text-muted-foreground font-bold text-lg">
              {authorInitials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-normal text-foreground">
              {authorName}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>{posts.length} bài viết</span>
            </p>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-foreground">
          Bài viết đã đăng
        </h2>
      </div>

      {/* Posts List / States */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={UserCircle2}
            title="Chưa có bài viết nào"
            description="Chưa có bài viết nào từ người dùng này."
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={removePost}
            />
          ))
        )}
      </div>
    </div>
  );
}
