"use client";

import * as React from "react";
import type { SocialPost } from "../types";
import { socialPostRepository } from "../services";

export type FeedFilterTab = "all" | "updates" | "trips";

const filterType: Record<FeedFilterTab, "ALL" | "STANDARD" | "TRIP_SHARE"> = {
  all: "ALL",
  updates: "STANDARD",
  trips: "TRIP_SHARE",
};

export function useSocialFeed() {
  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<FeedFilterTab>("all");

  const fetchPosts = React.useCallback(
    async (targetPage = 0, isInitial = false) => {
      if (!isInitial) {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const response = await socialPostRepository.listPosts({
          page: targetPage,
          size: 20,
          type: filterType[activeTab],
        });
        if (targetPage === 0) {
          setPosts(response.items);
        } else {
          setPosts((prev) => [...prev, ...response.items]);
        }
        setHasMore(response.hasMore);
        setPage(targetPage);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách bài viết",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab],
  );

  React.useEffect(() => {
    let ignore = false;

    async function initialLoad() {
      try {
        setLoading(true);
        setError(null);
        const response = await socialPostRepository.listPosts({
          page: 0,
          size: 20,
          type: filterType[activeTab],
        });
        if (!ignore) {
          setPosts(response.items);
          setHasMore(response.hasMore);
          setPage(0);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải danh sách bài viết",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      ignore = true;
    };
  }, [activeTab]);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchPosts(page + 1, false);
  }, [fetchPosts, hasMore, loadingMore, page]);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    await fetchPosts(0, true);
  }, [fetchPosts]);

  const prependPost = React.useCallback((newPost: SocialPost) => {
    setPosts((prev) =>
      prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev],
    );
  }, []);

  const removePost = React.useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    activeTab,
    setActiveTab,
    loadMore,
    refetch,
    prependPost,
    removePost,
  };
}
