"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Edit,
  FileText,
  Globe,
  Link as LinkIcon,
  Briefcase,
  UserPlus,
  UserCheck,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/shared";
import { useUserPosts } from "../hooks";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { getSocialPostRepository } from "../services";
import { useUserProfile, EditProfileModal } from "@/features/profile";
import { useAuth } from "@/features/auth/context/auth-context";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface UserPostsScreenProps {
  userId: string;
}

export function UserPostsScreen({ userId }: UserPostsScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.id === userId;
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState<boolean>(false);
  const [followingPending, setFollowingPending] = React.useState<boolean>(false);

  const {
    posts,
    author,
    loading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
    removePost,
  } = useUserPosts(userId);
  const { data: profile, refetch: refetchProfile } = useUserProfile(userId);
  const standardPosts = posts.filter((post) => post.type !== "TRIP_SHARE");
  const tripPosts = posts.filter((post) => post.type === "TRIP_SHARE");

  const authorName = author?.name || "Người dùng";
  const authorInitials = React.useMemo(() => {
    if (!author?.name) return "U";
    const parts = author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return author.name.slice(0, 2).toUpperCase();
  }, [author]);

  React.useEffect(() => {
    if (author?.isFollowing !== undefined) {
      setIsFollowing(author.isFollowing);
    }
  }, [author?.isFollowing]);

  const handleFollowToggle = async () => {
    if (followingPending) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowingPending(true);
    try {
      await getSocialPostRepository().toggleFollowCreator(userId, isFollowing);
    } catch {
      // Keep optimistic follow state in mock environment if not in presets
    } finally {
      setFollowingPending(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/community");
    }
  };

  const avatarUrl = profile?.avatarUrl || author?.avatar;
  const coverUrl = profile?.coverUrl;
  const bio = profile?.bio;
  const location = profile?.location;
  const socialPorts = profile?.socialPorts || {};

  const renderSocialIcon = (key: string, url: string) => {
    const Icon = (() => {
      switch (key.toLowerCase()) {
        case "website":
          return Globe;
        default:
          return LinkIcon;
      }
    })();
    return (
      <a
        key={key}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[200px]">
          {url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </span>
      </a>
    );
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back Button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground -ml-2 cursor-pointer hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("common.back")}</span>
        </Button>
      </div>

      {/* Premium Profile Header */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Cover Photo */}
        <div className="h-48 sm:h-64 bg-muted w-full relative">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Ảnh bìa hồ sơ"
              fill
              sizes="(max-width: 768px) 100vw, 1100px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/5" />
          )}
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-12 sm:-mt-16 mb-4 gap-4">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card ring-1 ring-border shadow-md">
              <AvatarImage src={avatarUrl} alt={authorName} />
              <AvatarFallback className="bg-muted text-muted-foreground font-bold text-2xl sm:text-3xl">
                {authorInitials}
              </AvatarFallback>
            </Avatar>

            {isOwnProfile ? (
              <Button
                variant="outline"
                className="gap-2 rounded-full font-semibold mt-12 sm:mt-0"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="w-4 h-4" /> Chỉnh sửa cá nhân
              </Button>
            ) : (
              <div className="flex items-center gap-2.5 mt-12 sm:mt-0 flex-wrap">
                {/* Follow / Following Button */}
                <Button
                  type="button"
                  variant={isFollowing ? "secondary" : "default"}
                  disabled={followingPending}
                  onClick={handleFollowToggle}
                  className={cn(
                    "gap-2 rounded-full font-semibold text-sm h-10 px-5 shadow-xs transition-all cursor-pointer",
                    isFollowing
                      ? "bg-muted text-foreground border border-border/80 hover:bg-muted/80"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {followingPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFollowing ? (
                    <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>
                    {isFollowing ? t("social.following") : t("social.follow")}
                  </span>
                </Button>

                {/* Message Button */}
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="gap-2 rounded-full font-semibold text-sm h-10 px-5 border-border/80 text-foreground hover:bg-muted shadow-2xs transition-all cursor-pointer"
                >
                  <Link href={`/chat?userId=${userId}`}>
                    <MessageSquare className="h-4 w-4" />
                    <span>{t("social.messageUser")}</span>
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {authorName}
              </h1>
              {location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </p>
              )}
            </div>

            {bio && (
              <p className="text-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
                {bio}
              </p>
            )}

            {Object.keys(socialPorts).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(socialPorts).map(([key, url]) =>
                  renderSocialIcon(key, url),
                )}
              </div>
            )}

            <div className="pt-4 border-t border-border flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg">
                  {posts.length}
                </span>
                <span className="text-muted-foreground text-sm font-medium">
                  Bài viết
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg">
                  {tripPosts.length}
                </span>
                <span className="text-muted-foreground text-sm font-medium">
                  Hành trình công khai
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full flex justify-start mb-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="posts"
            className="rounded-none border-b-2 border-transparent px-4 py-3 font-semibold data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Bài viết đã đăng
          </TabsTrigger>
          <TabsTrigger
            value="trips"
            className="rounded-none border-b-2 border-transparent px-4 py-3 font-semibold data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Chuyến đi đã chia sẻ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 outline-none">
          {postsLoading ? (
            <div className="space-y-4">
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : postsError ? (
            <ErrorState message={postsError} onRetry={refetchPosts} />
          ) : standardPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Chưa có bài viết nào"
              description="Chưa có bài viết nào từ người dùng này."
            />
          ) : (
            standardPosts.map((post) => (
              <PostCard key={post.id} post={post} onPostDeleted={removePost} />
            ))
          )}
        </TabsContent>

        <TabsContent value="trips" className="outline-none">
          {postsLoading ? (
            <PostCardSkeleton />
          ) : tripPosts.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Chưa có chuyến đi nào"
              description="Người dùng này chưa chia sẻ chuyến đi nào công khai."
            />
          ) : (
            <div className="space-y-4">
              {tripPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostDeleted={removePost}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile || null}
        onSuccess={refetchProfile}
      />
    </div>
  );
}
