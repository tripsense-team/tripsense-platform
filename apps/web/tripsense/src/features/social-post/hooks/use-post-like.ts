"use client";

import * as React from "react";
import { socialPostRepository } from "../services";

interface UsePostLikeOptions {
  postId: string;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChanged?: (liked: boolean, count: number) => void;
}

export function usePostLike({
  postId,
  initialLiked = false,
  initialCount = 0,
  onLikeChanged,
}: UsePostLikeOptions) {
  const [isLiked, setIsLiked] = React.useState(initialLiked);
  const [likeCount, setLikeCount] = React.useState(initialCount);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync if postId changes
  const [prevPostId, setPrevPostId] = React.useState(postId);
  if (prevPostId !== postId) {
    setPrevPostId(postId);
    setIsLiked(initialLiked);
    setLikeCount(initialCount);
  }


  const toggleLike = React.useCallback(async () => {
    if (isPending) return;

    const prevLiked = isLiked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    // Optimistic update
    setIsLiked(nextLiked);
    setLikeCount(nextCount);
    setIsPending(true);
    setError(null);
    onLikeChanged?.(nextLiked, nextCount);

    try {
      const result = await socialPostRepository.toggleLikePost(postId, prevLiked);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      onLikeChanged?.(result.liked, result.likeCount);
    } catch (err) {
      // Rollback on error
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
      onLikeChanged?.(prevLiked, prevCount);
      const message = err instanceof Error ? err.message : "Không thể cập nhật lượt thích";
      setError(message);
    } finally {
      setIsPending(false);
    }
  }, [isLiked, likeCount, isPending, postId, onLikeChanged]);

  return {
    isLiked,
    likeCount,
    isPending,
    error,
    toggleLike,
  };
}
