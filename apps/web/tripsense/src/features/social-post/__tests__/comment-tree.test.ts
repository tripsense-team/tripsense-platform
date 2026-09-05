import { describe, it, expect } from "vitest";
import { buildFlattenedCommentTree, MAX_VISUAL_DEPTH } from "../utils/comment-tree";
import type { PostComment } from "../types";

describe("buildFlattenedCommentTree", () => {
  it("clamps visual depth to MAX_VISUAL_DEPTH (2) while keeping accurate actualDepth and replyToAuthorName", () => {
    // Chain: A -> B -> C -> D -> E
    const comments: PostComment[] = [
      {
        id: "A",
        postId: "post-1",
        parentId: null,
        author: { id: "u1", name: "Minh Vi" },
        content: "Nạp chắc ko dưới 3 tỏi",
        createdAt: "2026-01-01T10:00:00Z",
        likeCount: 0,
      },
      {
        id: "B",
        postId: "post-1",
        parentId: "A",
        author: { id: "u2", name: "Ngan Anh" },
        content: "Nó phải 1 triệu đô...",
        createdAt: "2026-01-01T10:05:00Z",
        likeCount: 0,
      },
      {
        id: "C",
        postId: "post-1",
        parentId: "B",
        author: { id: "u1", name: "Minh Vi" },
        content: "Nói thật...",
        createdAt: "2026-01-01T10:10:00Z",
        likeCount: 0,
      },
      {
        id: "D",
        postId: "post-1",
        parentId: "C",
        author: { id: "u3", name: "Kin Bền" },
        content: "660 hai ông thế đó",
        createdAt: "2026-01-01T10:15:00Z",
        likeCount: 0,
      },
      {
        id: "E",
        postId: "post-1",
        parentId: "D",
        author: { id: "u4", name: "Lê Bảo" },
        content: "Quá đã anh em!",
        createdAt: "2026-01-01T10:20:00Z",
        likeCount: 0,
      },
    ];

    const flattened = buildFlattenedCommentTree(comments);

    expect(flattened).toHaveLength(5);

    // Comment A
    expect(flattened[0].comment.id).toBe("A");
    expect(flattened[0].actualDepth).toBe(0);
    expect(flattened[0].visualDepth).toBe(0);
    expect(flattened[0].replyToAuthorName).toBeUndefined();

    // Comment B
    expect(flattened[1].comment.id).toBe("B");
    expect(flattened[1].actualDepth).toBe(1);
    expect(flattened[1].visualDepth).toBe(1);
    expect(flattened[1].replyToAuthorName).toBe("Minh Vi");

    // Comment C
    expect(flattened[2].comment.id).toBe("C");
    expect(flattened[2].actualDepth).toBe(2);
    expect(flattened[2].visualDepth).toBe(2);
    expect(flattened[2].replyToAuthorName).toBe("Ngan Anh");

    // Comment D (actual depth 3, visual depth clamped to 2)
    expect(flattened[3].comment.id).toBe("D");
    expect(flattened[3].actualDepth).toBe(3);
    expect(flattened[3].visualDepth).toBe(MAX_VISUAL_DEPTH); // 2
    expect(flattened[3].replyToAuthorName).toBe("Minh Vi");

    // Comment E (actual depth 4, visual depth clamped to 2)
    expect(flattened[4].comment.id).toBe("E");
    expect(flattened[4].actualDepth).toBe(4);
    expect(flattened[4].visualDepth).toBe(MAX_VISUAL_DEPTH); // 2
    expect(flattened[4].replyToAuthorName).toBe("Kin Bền");
  });

  it("orders root comments newest first and child replies newest last", () => {
    const comments: PostComment[] = [
      {
        id: "root-older",
        postId: "post-1",
        parentId: null,
        author: { id: "u1", name: "Author 1" },
        content: "Bình luận gốc cũ hơn",
        createdAt: "2026-01-01T09:00:00Z",
        likeCount: 0,
      },
      {
        id: "root-newer",
        postId: "post-1",
        parentId: null,
        author: { id: "u2", name: "Author 2" },
        content: "Bình luận gốc mới hơn (phải ở đầu)",
        createdAt: "2026-01-01T10:00:00Z",
        likeCount: 0,
      },
      {
        id: "reply-1",
        postId: "post-1",
        parentId: "root-older",
        author: { id: "u3", name: "Author 3" },
        content: "Phản hồi 1 cho root-older",
        createdAt: "2026-01-01T09:10:00Z",
        likeCount: 0,
      },
      {
        id: "reply-2",
        postId: "post-1",
        parentId: "root-older",
        author: { id: "u4", name: "Author 4" },
        content: "Phản hồi 2 cho root-older (mới hơn reply-1, phải ở cuối cây)",
        createdAt: "2026-01-01T09:20:00Z",
        likeCount: 0,
      },
    ];

    const flattened = buildFlattenedCommentTree(comments);
    // Root comments: root-newer (10:00) comes first, then root-older (09:00)
    // Child replies: reply-1 (09:10) comes first, then reply-2 (09:20) at the end of root-older's thread
    expect(flattened.map((n) => n.comment.id)).toEqual([
      "root-newer",
      "root-older",
      "reply-1",
      "reply-2",
    ]);
  });
});

