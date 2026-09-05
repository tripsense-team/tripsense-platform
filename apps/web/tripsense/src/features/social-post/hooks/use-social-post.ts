"use client";

import * as React from "react";
import type { SocialPost } from "../types";
import { socialPostRepository } from "../services";
import { ApiError } from "@/services/api-client";

export function useSocialPost(postId: string) {
  const [post, setPost] = React.useState<SocialPost | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNotFound, setIsNotFound] = React.useState(false);
  const [status, setStatus] = React.useState<number | null>(null);

  const fetchPost = React.useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    setIsNotFound(false);
    setStatus(null);

    try {
      const data = await socialPostRepository.getPostById(postId);
      setPost(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi tải bài viết";
      setError(message);
      setIsNotFound(err instanceof ApiError && err.status === 404);
      setStatus(err instanceof ApiError ? err.status : null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  React.useEffect(() => {
    let ignore = false;

    async function load() {
      if (!postId) {
        setLoading(false);
        return;
      }

      try {
        const data = await socialPostRepository.getPostById(postId);
        if (!ignore) {
          setPost(data);
        }
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : "Lỗi tải bài viết";
          setError(message);
          setIsNotFound(err instanceof ApiError && err.status === 404);
          setStatus(err instanceof ApiError ? err.status : null);
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
  }, [postId]);

  return {
    post,
    loading,
    error,
    isNotFound,
    status,
    refetch: fetchPost,
  };
}
