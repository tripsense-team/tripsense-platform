"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PostDetailModal } from "@/features/social-post";

function PostModalContent() {
  const params = useParams<{ postId: string }>();
  const searchParams = useSearchParams();
  const focusComment = searchParams.get("focus") === "comment";

  if (!params?.postId) {
    return null;
  }

  return (
    <PostDetailModal
      postId={params.postId}
      initialFocusComment={focusComment}
    />
  );
}

export default function InterceptedPostModalPage() {
  return (
    <React.Suspense fallback={null}>
      <PostModalContent />
    </React.Suspense>
  );
}
