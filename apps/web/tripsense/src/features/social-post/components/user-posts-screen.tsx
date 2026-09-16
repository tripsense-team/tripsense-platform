"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Edit, FileText, Users, UserPlus, Globe, Link as LinkIcon, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { useUserPosts } from "../hooks";
import { useUserSharedTrips } from "../hooks/use-user-shared-trips";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { SharedTripCard } from "./shared-trip-card";
import { useUserProfile, EditProfileModal } from "@/features/profile";
import { useAuth } from "@/features/auth/context/auth-context";

interface UserPostsScreenProps {
  userId: string;
}

export function UserPostsScreen({ userId }: UserPostsScreenProps) {
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.id === userId;
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const { posts, author, loading: postsLoading, error: postsError, refetch: refetchPosts, removePost } = useUserPosts(userId);
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile(userId);
  const { trips, isLoading: tripsLoading } = useUserSharedTrips(userId);

  const authorName = author?.name || "Người dùng";
  const authorInitials = React.useMemo(() => {
    if (!author?.name) return "U";
    const parts = author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return author.name.slice(0, 2).toUpperCase();
  }, [author]);

  const avatarUrl = profile?.avatarUrl || author?.avatar;
  const coverUrl = profile?.coverUrl;
  const bio = profile?.bio;
  const location = profile?.location;
  const socialPorts = profile?.socialPorts || {};

  const renderSocialIcon = (key: string, url: string) => {
    const Icon = (() => {
      switch (key.toLowerCase()) {
        case 'website': return Globe;
        default: return LinkIcon;
      }
    })();
    return (
      <a key={key} href={url} target="_blank" rel="noopener noreferrer" 
         className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[200px]">{url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
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
          asChild
          className="gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground -ml-2"
        >
          <Link href="/community">
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại cộng đồng</span>
          </Link>
        </Button>
      </div>

      {/* Premium Profile Header */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Cover Photo */}
        <div className="h-48 sm:h-64 bg-muted w-full relative">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/5" />
          )}
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-12 sm:-mt-16 mb-4 gap-4">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-md">
              <AvatarImage src={avatarUrl} alt={authorName} />
              <AvatarFallback className="bg-muted text-muted-foreground font-bold text-2xl sm:text-3xl">
                {authorInitials}
              </AvatarFallback>
            </Avatar>
            
            {isOwnProfile && (
              <Button 
                variant="outline" 
                className="gap-2 rounded-full font-semibold mt-12 sm:mt-0"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="w-4 h-4" /> Chỉnh sửa cá nhân
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
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
                {Object.entries(socialPorts).map(([key, url]) => renderSocialIcon(key, url))}
              </div>
            )}

            <div className="pt-4 border-t border-border flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg">{posts.length}</span>
                <span className="text-muted-foreground text-sm font-medium">Bài viết</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg">0</span>
                <span className="text-muted-foreground text-sm font-medium">Người theo dõi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg">0</span>
                <span className="text-muted-foreground text-sm font-medium">Đang theo dõi</span>
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
          ) : posts.length === 0 ? (
            <EmptyState
              icon={FileText}
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
        </TabsContent>

        <TabsContent value="trips" className="outline-none">
          {tripsLoading ? (
            <LoadingState text="Đang tải chuyến đi..." />
          ) : trips.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Chưa có chuyến đi nào"
              description="Người dùng này chưa chia sẻ chuyến đi nào công khai."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {trips.map((trip) => (
                <SharedTripCard key={trip.id} trip={trip} />
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
