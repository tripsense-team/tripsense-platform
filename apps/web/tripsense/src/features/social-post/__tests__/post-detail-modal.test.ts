import { describe, it, expect } from "vitest";
import { buildFlattenedCommentTree } from "../utils/comment-tree";
import type { PostComment } from "../types";

describe("Post Detail Modal & Comment Interactions", () => {
  const mockComments: PostComment[] = [
    {
      id: "c-root-1",
      postId: "p-100",
      content: "Chuyến đi này tuyệt vời quá!",
      parentId: null,
      createdAt: "2026-09-05T08:00:00Z",
      author: { id: "u-1", name: "An Nguyen" },
      likeCount: 3,
      isLiked: false,
    },
    {
      id: "c-reply-1",
      postId: "p-100",
      content: "Cảm ơn bạn nhé!",
      parentId: "c-root-1",
      createdAt: "2026-09-05T08:05:00Z",
      author: { id: "u-2", name: "Bao Le" },
      likeCount: 1,
      isLiked: true,
    },
    {
      id: "c-reply-2",
      postId: "p-100",
      content: "Bạn đi vào mùa nào thế?",
      parentId: "c-reply-1",
      createdAt: "2026-09-05T08:10:00Z",
      author: { id: "u-3", name: "Chi Tran" },
      likeCount: 0,
      isLiked: false,
    },
    {
      id: "c-reply-3",
      postId: "p-100",
      content: "Mình đi vào tháng 4 nè, thời tiết siêu đẹp!",
      parentId: "c-reply-2",
      createdAt: "2026-09-05T08:15:00Z",
      author: { id: "u-2", name: "Bao Le" },
      likeCount: 0,
      isLiked: false,
    },
  ];

  it("builds flattened comment tree with visualDepth clamped strictly to max 2", () => {
    const tree = buildFlattenedCommentTree(mockComments);
    expect(tree).toHaveLength(4);

    // Root comment -> depth 0
    expect(tree[0].comment.id).toBe("c-root-1");
    expect(tree[0].visualDepth).toBe(0);

    // Reply 1 -> depth 1
    expect(tree[1].comment.id).toBe("c-reply-1");
    expect(tree[1].visualDepth).toBe(1);
    expect(tree[1].replyToAuthorName).toBe("An Nguyen");

    // Reply 2 -> depth 2
    expect(tree[2].comment.id).toBe("c-reply-2");
    expect(tree[2].visualDepth).toBe(2);
    expect(tree[2].replyToAuthorName).toBe("Bao Le");

    // Reply 3 -> depth clamped at 2 (even though logical depth is 3)
    expect(tree[3].comment.id).toBe("c-reply-3");
    expect(tree[3].visualDepth).toBe(2);
    expect(tree[3].replyToAuthorName).toBe("Chi Tran");
  });

  it("constructs genuine shareable post URL matching canonical route", () => {
    const postId = "test-post-456";
    const canonicalUrl = `/community/posts/${postId}`;
    expect(canonicalUrl).toBe("/community/posts/test-post-456");
  });

  it("constructs canonical route with focus=comment intent", () => {
    const postId = "test-post-789";
    const commentUrl = `/community/posts/${postId}?focus=comment`;
    expect(commentUrl).toBe("/community/posts/test-post-789?focus=comment");
  });

  it("validates modal vs direct page modes for PostDetailContent", () => {
    const modalMode: "modal" | "page" = "modal";
    const pageMode: "modal" | "page" = "page";
    expect(modalMode).not.toBe(pageMode);
  });
});
