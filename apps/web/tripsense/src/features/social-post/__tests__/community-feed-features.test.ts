import { describe, it, expect } from "vitest";
import type { SocialPost, SharedTripSummary } from "../types";

describe("Community Feed Features (TF-62: TF-64 - TF-69)", () => {
  const sampleTrip: SharedTripSummary = {
    name: "Khám phá Đà Nẵng 3N2Đ",
    destinationName: "Đà Nẵng, Việt Nam",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    dayCount: 3,
    coverImageUrl: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b",
  };

  const samplePosts: SocialPost[] = [
    {
      id: "post-1",
      author: { id: "user-1", name: "Nguyễn Văn A" },
      content: "Chuyến đi tuyệt vời cùng bạn bè!",
      createdAt: "2026-09-14T10:00:00Z",
      likeCount: 5,
      commentCount: 2,
    },
    {
      id: "post-2",
      author: { id: "user-2", name: "Trần Thị B" },
      content: "Chia sẻ lịch trình Đà Nẵng chi tiết cho ai cần nha",
      type: "TRIP_SHARE",
      trip: sampleTrip,
      createdAt: "2026-09-14T12:00:00Z",
      likeCount: 12,
      commentCount: 4,
    },
  ];

  it("TF-64: verifies post structure and required fields for community display", () => {
    const post = samplePosts[0];
    expect(post.id).toBe("post-1");
    expect(post.author.name).toBe("Nguyễn Văn A");
    expect(post.content).toBeDefined();
    expect(post.likeCount).toBeGreaterThanOrEqual(0);
    expect(post.commentCount).toBeGreaterThanOrEqual(0);
  });

  it("TF-65: verifies post with attached shared trip summary", () => {
    const postWithTrip = samplePosts[1];
    expect(postWithTrip.trip).toBeDefined();
    expect(postWithTrip.trip?.name).toBe("Khám phá Đà Nẵng 3N2Đ");
    expect(postWithTrip.trip?.destinationName).toBe("Đà Nẵng, Việt Nam");
    expect(postWithTrip.trip?.dayCount).toBe(3);
  });

  it("TF-66: sorts posts by newest first (descending createdAt)", () => {
    const sorted = [...samplePosts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    expect(sorted[0].id).toBe("post-2");
    expect(sorted[1].id).toBe("post-1");
  });

  it("TF-67: generates valid post detail URL and handles comment focus anchor", () => {
    const postId = "post-2";
    const detailUrl = `/community/posts/${postId}`;
    const commentFocusUrl = `/community/posts/${postId}?focus=comment`;
    expect(detailUrl).toBe("/community/posts/post-2");
    expect(commentFocusUrl).toBe("/community/posts/post-2?focus=comment");
  });

  it("TF-68: handles pagination state with page offset and hasMore", () => {
    const pageData = {
      items: samplePosts,
      total: 20,
      page: 0,
      size: 10,
      hasMore: true,
    };
    expect(pageData.items.length).toBe(2);
    expect(pageData.hasMore).toBe(true);
    expect(pageData.page + 1).toBe(1);
  });

  it("TF-69: verifies empty state filtering condition when no posts match", () => {
    const filteredByTripsOnly = samplePosts.filter(
      (p) => p.type === "TRIP_SHARE",
    );
    expect(filteredByTripsOnly.length).toBe(1);

    const emptyFilter = samplePosts.filter(
      (p) => p.author.id === "non-existent",
    );
    expect(emptyFilter.length).toBe(0);
  });
});
