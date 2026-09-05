"use client";

import { useParams } from "next/navigation";
import { UserPostsScreen } from "@/features/social-post";

export default function UserPostsPage() {
  const params = useParams<{ userId: string }>();
  return <UserPostsScreen userId={params.userId} />;
}
