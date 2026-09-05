"use client";

import { useParams } from "next/navigation";
import { PostDetailScreen } from "@/features/social-post";

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  return <PostDetailScreen postId={params.postId} />;
}
