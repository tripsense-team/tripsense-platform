"use client";

import * as React from "react";
import type { PostComment } from "../types";
import { socialPostRepository } from "../services";
import {
  buildFlattenedCommentTree,
  type FlattenedCommentNode,
} from "../utils/comment-tree";

export function usePostComments(postId: string) {
  const [comments, setComments] = React.useState<PostComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchComments = React.useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await socialPostRepository.listComments(postId);
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải bình luận");
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
        const data = await socialPostRepository.listComments(postId);
        if (!ignore) {
          setComments(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Không thể tải bình luận",
          );
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

  const isAddingCommentRef = React.useRef(false);
  const pendingLikesRef = React.useRef<Set<string>>(new Set());

  const addComment = React.useCallback(
    async (content: string, parentId?: string | null): Promise<PostComment> => {
      if (!content.trim() || submitting || isAddingCommentRef.current) {
        throw new Error("Yêu cầu gửi bình luận đang được xử lý, vui lòng chờ.");
      }
      isAddingCommentRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const newComment = await socialPostRepository.createComment(postId, {
          content: content.trim(),
          parentId: parentId || null,
        });
        setComments((prev) =>
          prev.some((c) => c.id === newComment.id)
            ? prev
            : [...prev, newComment],
        );
        return newComment;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gửi bình luận thất bại";
        setError(message);
        throw err;
      } finally {
        isAddingCommentRef.current = false;
        setSubmitting(false);
      }
    },
    [postId, submitting],
  );

  const toggleCommentLike = React.useCallback(
    async (commentId: string) => {
      if (pendingLikesRef.current.has(commentId)) return;
      const target = comments.find((c) => c.id === commentId);
      if (!target) return;

      pendingLikesRef.current.add(commentId);
      const prevLiked = target.isLiked ?? false;
      const prevCount = target.likeCount ?? 0;
      const nextLiked = !prevLiked;
      const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

      // Optimistic update
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, isLiked: nextLiked, likeCount: nextCount }
            : c,
        ),
      );

      try {
        const result = await socialPostRepository.toggleLikeComment(
          postId,
          commentId,
          prevLiked,
        );
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: result.liked, likeCount: result.likeCount }
              : c,
          ),
        );
      } catch {
        // Rollback on error
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: prevLiked, likeCount: prevCount }
              : c,
          ),
        );
      } finally {
        pendingLikesRef.current.delete(commentId);
      }
    },
    [comments, postId],
  );

  const flattenedTree: FlattenedCommentNode[] = React.useMemo(() => {
    return buildFlattenedCommentTree(comments);
  }, [comments]);

  return {
    comments,
    flattenedTree,
    totalCount: comments.length,
    loading,
    error,
    submitting,
    addComment,
    toggleCommentLike,
    refetch: fetchComments,
  };
}
