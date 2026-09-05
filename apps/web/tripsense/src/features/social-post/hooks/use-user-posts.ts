"use client";

import * as React from "react";
import type { SocialPost, SocialPostAuthor } from "../types";
import { socialPostRepository } from "../services";

export function useUserPosts(userId: string) {
  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [author, setAuthor] = React.useState<SocialPostAuthor | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUserPosts = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await socialPostRepository.getUserPosts(userId);
      setPosts(response.items);
      if (response.items.length > 0) {
        setAuthor(response.items[0].author);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải bài viết của người dùng");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    let ignore = false;

    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await socialPostRepository.getUserPosts(userId);
        if (!ignore) {
          setPosts(response.items);
          if (response.items.length > 0) {
            setAuthor(response.items[0].author);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không thể tải bài viết của người dùng");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [userId]);

  const removePost = React.useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return {
    posts,
    author,
    loading,
    error,
    refetch: fetchUserPosts,
    removePost,
  };
}
