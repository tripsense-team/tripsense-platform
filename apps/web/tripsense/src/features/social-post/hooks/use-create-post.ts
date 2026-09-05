"use client";

import * as React from "react";
import { ApiError } from "@/services/api-client";
import type { CreateSocialPostRequest, SocialPost } from "../types";
import { socialPostRepository } from "../services";

export function useCreatePost() {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ message: string; variant: "success" | "error" } | null>(null);
  const inFlightRef = React.useRef<Promise<SocialPost> | null>(null);
  const idempotencyKeyRef = React.useRef<string | null>(null);
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = React.useCallback((message: string, variant: "success" | "error") => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ message, variant });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 5000);
  }, []);

  React.useEffect(() => () => { if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); }, []);

  const create = React.useCallback((payload: CreateSocialPostRequest): Promise<SocialPost> => {
    if (inFlightRef.current) return inFlightRef.current;
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    setSubmitting(true);
    setError(null);
    const operation = socialPostRepository.createPost(payload, idempotencyKey)
      .then((created) => { idempotencyKeyRef.current = null; showFeedback("Đã đăng bài viết.", "success"); return created; })
      .catch((err: unknown) => {
        const isNetworkError = err instanceof TypeError;
        const isUnauthorized = err instanceof ApiError && err.status === 401;
        const msg = isNetworkError ? "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại." : "Không thể đăng bài viết. Vui lòng thử lại.";
        setError(msg);
        if (!isUnauthorized) showFeedback(msg, "error");
        throw err;
      })
      .finally(() => { inFlightRef.current = null; setSubmitting(false); });
    inFlightRef.current = operation;
    return operation;
  }, [showFeedback]);

  const beginNewDraft = React.useCallback(() => { if (!inFlightRef.current) idempotencyKeyRef.current = null; }, []);

  return {
    create,
    submitting,
    error,
    feedback,
    clearError: () => setError(null),
    beginNewDraft,
  };
}
