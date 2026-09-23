"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth, UserRole } from "@/features/auth";
import type { SocialPost } from "../types";
import { formatRelativeTime } from "../utils/format-time";
import { PostMediaGallery } from "./post-media-gallery";
import { PostActionsMenu } from "./post-actions-menu";
import { PostActionsBar } from "./post-actions-bar";
import { parsePostContent } from "../utils/parse-trip-metadata";
import { DeletePostDialog } from "./delete-post-dialog";
import { SharedTripArtifactCard } from "./shared-trip-artifact-card";
import { useDeletePost } from "../hooks";
import { cn } from "@/lib/utils";
import { ReportPostDialog } from "./report-post-dialog";
import { useTranslation } from "@/i18n";
import { Loader2, Check, UserPlus } from "lucide-react";
import { getSocialPostRepository } from "../services";
import { Button } from "@/components/ui/button";

interface PostCardProps {
  post: SocialPost;
  onPostDeleted?: (postId: string) => void;
  showDetailLink?: boolean;
  className?: string;
}

export function PostCard({
  post,
  onPostDeleted,
  showDetailLink = true,
  className,
}: PostCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { remove, deleting } = useDeletePost();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);

  const visibilityLabel = (visibility?: SocialPost["visibility"]) => {
    switch (visibility) {
      case "PRIVATE":
        return t("social.visibilityPrivate");
      case "UNLISTED":
        return t("social.visibilityUnlisted");
      default:
        return t("social.visibilityPublic");
    }
  };

  const authorAvatar = post.author.avatar;

  const handleCommentClick = () => {
    if (showDetailLink) {
      router.push(`/community/posts/${post.id}?focus=comment`);
    } else {
      const el = document.getElementById("comments");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        const input = el.querySelector("textarea");
        input?.focus();
      }
    }
  };

  // Authorization check: User is the post author OR has ROLE_ADMIN (or guest author in dev mode)
  const canDelete = Boolean(
    (user && (user.id === post.author.id || user.role === UserRole.ADMIN)) ||
      (!user && post.author.id === "guest-user"),
  );

  const authorInitials = React.useMemo(() => {
    if (!post.author.name) return "U";
    const parts = post.author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return post.author.name.slice(0, 2).toUpperCase();
  }, [post.author.name]);

  const { cleanContent } = React.useMemo(
    () => parsePostContent(post.content),
    [post.content],
  );

  const isOwnPost = Boolean(user && user.id === post.author.id);
  const [isFollowing, setIsFollowing] = React.useState(
    Boolean(post.author.isFollowing),
  );
  const [followingPending, setFollowingPending] = React.useState(false);
  const followPendingRef = React.useRef(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isLongContent =
    cleanContent.length > 180 || cleanContent.split("\n").length > 3;

  const handleFollowToggle = async () => {
    if (followingPending || followPendingRef.current) return;
    followPendingRef.current = true;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowingPending(true);
    try {
      await getSocialPostRepository().toggleFollowCreator(
        post.author.id,
        isFollowing,
      );
    } catch {
      setIsFollowing(!nextState);
    } finally {
      followPendingRef.current = false;
      setFollowingPending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteError(null);
    try {
      await remove(post.id);
      setDeleteDialogOpen(false);
      onPostDeleted?.(post.id);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("social.deletePost"),
      );
    }
  };

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-all duration-200 hover:shadow-sm",
        className,
      )}
    >
      {/* Header: Author + Timestamp + Actions Menu */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/community/users/${post.author.id}`}
            className="transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            aria-label={t("social.authorPosts", { name: post.author.name })}
          >
            <Avatar className="h-10 w-10 sm:h-[46px] sm:w-[46px]">
              <AvatarImage src={authorAvatar} alt={post.author.name} />
              <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                {authorInitials}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/community/users/${post.author.id}`}
                className="text-sm font-semibold text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
              >
                {post.author.name}
              </Link>
              <Badge
                variant="secondary"
                className="rounded-full px-2 py-0 text-[10px] font-bold"
              >
                {post.type === "TRIP_SHARE"
                  ? t("social.postTypeTrip")
                  : t("social.postTypeStandard")}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>•</span>
              <span>{visibilityLabel(post.visibility)}</span>
            </div>
          </div>
        </div>

        {/* Header Actions: Follow button + (...) menu */}
        <div className="flex items-center gap-2">
          {!isOwnPost && (
            <Button
              type="button"
              size="sm"
              variant={isFollowing ? "secondary" : "outline"}
              disabled={followingPending}
              onClick={handleFollowToggle}
              aria-pressed={isFollowing}
              className={`shrink-0 rounded-full text-xs font-semibold px-3 h-7.5 transition-all cursor-pointer ${
                isFollowing
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
              }`}
            >
              {followingPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  <span>
                    {isFollowing ? t("social.following") : t("social.follow")}
                  </span>
                </>
              ) : isFollowing ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  <span>{t("social.following")}</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3 mr-1" />
                  <span>{t("social.follow")}</span>
                </>
              )}
            </Button>
          )}

          {/* Post Actions Menu (...) */}
          <PostActionsMenu
            postId={post.id}
            canDelete={canDelete}
            onDeleteClick={() => setDeleteDialogOpen(true)}
            onReportClick={
              user && !canDelete ? () => setReportDialogOpen(true) : undefined
            }
            showDetailLink={showDetailLink}
          />
        </div>
      </div>

      {/* Delete error notification if failed */}
      {deleteError && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
          {deleteError}
        </div>
      )}

      {/* Content with Expand / Collapse */}
      {cleanContent && (
        <div className="mb-4">
          <p
            className={cn(
              "text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-line break-words",
              !isExpanded && isLongContent && "line-clamp-3",
            )}
          >
            {cleanContent}
          </p>
          {isLongContent && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1.5 text-xs font-bold text-primary hover:underline cursor-pointer focus:outline-hidden"
            >
              {isExpanded ? t("social.showLess") : t("social.readMore")}
            </button>
          )}
        </div>
      )}

      {/* Shared trip artifact */}
      {post.type === "TRIP_SHARE" && post.trip && (
        <SharedTripArtifactCard
          trip={post.trip}
          compact={showDetailLink}
          href={`/community/posts/${post.id}`}
        />
      )}

      {/* Media gallery */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-3">
          <PostMediaGallery mediaUrls={post.mediaUrls} />
        </div>
      )}

      {/* Post Actions Bar: Like, Comment, Share */}
      <div className="mt-2">
        <PostActionsBar
          postId={post.id}
          initialLiked={post.isLiked}
          initialLikeCount={post.likeCount}
          commentCount={post.commentCount}
          postContent={cleanContent}
          onCommentClick={handleCommentClick}
        />
      </div>

      {/* Delete confirmation dialog */}
      <DeletePostDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
      <ReportPostDialog
        postId={post.id}
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </article>
  );
}
