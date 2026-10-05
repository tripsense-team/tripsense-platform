"use client";

import * as React from "react";
import { socialPostRepository } from "../services";

export function useDeletePost() {
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remove = React.useCallback(async (postId: string): Promise<void> => {
    setDeleting(true);
    setError(null);
    try {
      await socialPostRepository.deletePost(postId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xóa bài viết thất bại.";
      setError(msg);
      throw err;
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    remove,
    deleting,
    error,
    clearError: () => setError(null),
  };
}
