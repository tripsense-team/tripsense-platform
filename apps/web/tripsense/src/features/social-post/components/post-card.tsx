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
import { Loader2, Check, UserPlus, Compass, ShieldCheck } from "lucide-react";
import { getSocialPostRepository } from "../services";
import { Button } from "@/components/ui/button";
import { GuideInquiryFormModal } from "@/features/partner";

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
  const { t, locale } = useTranslation();
  const { remove, deleting } = useDeletePost();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = React.useState(false);

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
                className="rounded-full px-2 py-0 text-micro font-bold"
              >
                {post.type === "TRIP_SHARE"
                  ? t("social.postTypeTrip")
                  : post.type === "GUIDE_PROMOTION"
                  ? (t("social.postTypeGuide") || "Hướng dẫn viên")
                  : t("social.postTypeStandard")}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatRelativeTime(post.createdAt, locale)}</span>
              {post.updatedAt && post.updatedAt !== post.createdAt && (
                <>
                  <span>•</span>
                  <span className="text-primary font-medium">
                    {t("social.updatedAt") || "Đã cập nhật"}: {formatRelativeTime(post.updatedAt, locale)}
                  </span>
                </>
              )}
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
              className={`shrink-0 rounded-full text-xs font-semibold px-3 transition-all cursor-pointer ${
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

      {/* Guide Promotion Artifact Card */}
      {post.type === "GUIDE_PROMOTION" && post.guidePromotion && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-background p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                <Compass className="h-3.5 w-3.5" />
                <span>Gói dịch vụ hướng dẫn viên</span>
              </div>
              <h4 className="text-base font-bold text-foreground line-clamp-1">
                {post.guidePromotion.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {post.guidePromotion.summary}
              </p>
            </div>

            {post.guidePromotion.indicativePrice && (
              <div className="text-right shrink-0">
                <span className="text-[11px] text-muted-foreground block">Mức giá:</span>
                <span className="text-sm font-bold text-primary">
                  {post.guidePromotion.indicativePrice.amount.toLocaleString("vi-VN")}{" "}
                  {post.guidePromotion.indicativePrice.currency} / {post.guidePromotion.indicativePrice.unit}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {post.guidePromotion.areaTopics?.map((at) => (
              <Badge key={at} variant="outline" className="text-micro">
                {at}
              </Badge>
            ))}
            {post.guidePromotion.skillLabels?.map((sk) => (
              <Badge key={sk} variant="secondary" className="text-micro">
                {sk}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
            <Link
              href={`/guides/${post.guidePromotion.businessId}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Xem hồ sơ chuyên môn &rarr;
            </Link>

            <Button
              size="sm"
              onClick={() => setInquiryModalOpen(true)}
              disabled={post.guidePromotion.canRequestInquiry === false}
              className="h-8 text-xs font-medium"
            >
              {post.guidePromotion.canRequestInquiry === false
                ? "Tạm dừng nhận mới"
                : "Gửi yêu cầu tư vấn"}
            </Button>
          </div>

          {/* Inquiry Modal */}
          <GuideInquiryFormModal
            open={inquiryModalOpen}
            onOpenChange={setInquiryModalOpen}
            guideBusinessId={post.guidePromotion.businessId}
            guideDisplayName={post.author.name}
            promotionId={post.guidePromotion.promotionId}
            expectedSourceRevisionId={post.guidePromotion.approvedRevisionId || "00000000-0000-0000-0000-000000000000"}
            sourceCommunityPostId={post.id}
            areaId={post.guidePromotion.areaTopics?.[0] || "hoi-an"}
            topicIds={post.guidePromotion.areaTopics?.slice(1) || ["general"]}
          />
        </div>
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
