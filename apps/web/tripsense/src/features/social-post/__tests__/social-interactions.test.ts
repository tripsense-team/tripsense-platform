import { describe, it, expect, beforeEach } from "vitest";
import { MockSocialPostRepository } from "../services/mock-social-post-repository";
import { buildFlattenedCommentTree, MAX_VISUAL_DEPTH } from "../utils/comment-tree";

describe("Social Interactions Repository & Tree Clamping", () => {
  let repo: MockSocialPostRepository;

  beforeEach(() => {
    repo = new MockSocialPostRepository();
  });

  describe("Post Likes", () => {
    it("toggles like on a post and updates likeCount", async () => {
      const post = await repo.getPostById("post-1");
      const initialLikeCount = post.likeCount;
      const initialLiked = post.isLiked ?? false;

      // First toggle
      const result1 = await repo.toggleLikePost("post-1");
      expect(result1.liked).toBe(!initialLiked);
      expect(result1.likeCount).toBe(initialLikeCount + (result1.liked ? 1 : -1));

      // Second toggle (toggle back)
      const result2 = await repo.toggleLikePost("post-1");
      expect(result2.liked).toBe(initialLiked);
      expect(result2.likeCount).toBe(initialLikeCount);
    });
  });

  describe("Post Comments & Threaded Clamping", () => {
    it("fetches seeded comments for post-1 with existing threaded replies", async () => {
      const comments = await repo.listComments("post-1");
      expect(comments.length).toBeGreaterThanOrEqual(7);

      const tree = buildFlattenedCommentTree(comments);
      expect(tree.length).toBe(comments.length);

      // Verify comm-1 (root, actual 0, visual 0)
      const nodeA = tree.find((n) => n.comment.id === "comm-1");
      expect(nodeA?.actualDepth).toBe(0);
      expect(nodeA?.visualDepth).toBe(0);

      // Verify comm-2 (child of comm-1, actual 1, visual 1)
      const nodeB = tree.find((n) => n.comment.id === "comm-2");
      expect(nodeB?.actualDepth).toBe(1);
      expect(nodeB?.visualDepth).toBe(1);
      expect(nodeB?.replyToAuthorName).toBe("Minh Vi");

      // Verify comm-3 (child of comm-2, actual 2, visual 2)
      const nodeC = tree.find((n) => n.comment.id === "comm-3");
      expect(nodeC?.actualDepth).toBe(2);
      expect(nodeC?.visualDepth).toBe(2);
      expect(nodeC?.replyToAuthorName).toBe("Ngân Anh");

      // Verify comm-4 (child of comm-3, actual 3, visual clamped to 2)
      const nodeD = tree.find((n) => n.comment.id === "comm-4");
      expect(nodeD?.actualDepth).toBe(3);
      expect(nodeD?.visualDepth).toBe(MAX_VISUAL_DEPTH); // strictly 2
      expect(nodeD?.replyToAuthorName).toBe("Minh Vi");

      // Verify comm-5 (child of comm-4, actual 4, visual clamped to 2)
      const nodeE = tree.find((n) => n.comment.id === "comm-5");
      expect(nodeE?.actualDepth).toBe(4);
      expect(nodeE?.visualDepth).toBe(MAX_VISUAL_DEPTH); // strictly 2
      expect(nodeE?.replyToAuthorName).toBe("Kin Bền");
    });

    it("adds a new root comment and updates post commentCount", async () => {
      const postBefore = await repo.getPostById("post-1");
      const initialCommentCount = postBefore.commentCount;

      const newComment = await repo.createComment("post-1", {
        content: "Bình luận mới từ unit test",
        parentId: null,
      });

      expect(newComment.id).toBeDefined();
      expect(newComment.content).toBe("Bình luận mới từ unit test");
      expect(newComment.parentId).toBeNull();

      const postAfter = await repo.getPostById("post-1");
      expect(postAfter.commentCount).toBe(initialCommentCount + 1);

      const comments = await repo.listComments("post-1");
      const found = comments.find((c) => c.id === newComment.id);
      expect(found).toBeDefined();
    });

    it("adds a reply to a level 4 comment and ensures it remains clamped at visual level 2", async () => {
      // Reply to comm-5 (which is depth 4) -> new comment will be depth 5
      const reply = await repo.createComment("post-1", {
        content: "Trả lời cho comm-5 ở độ sâu cấp 5",
        parentId: "comm-5",
      });

      expect(reply.parentId).toBe("comm-5");
      expect(reply.replyToAuthorName).toBe("Lê Bảo");

      const comments = await repo.listComments("post-1");
      const tree = buildFlattenedCommentTree(comments);
      const replyNode = tree.find((n) => n.comment.id === reply.id);

      expect(replyNode).toBeDefined();
      expect(replyNode?.actualDepth).toBe(5);
      expect(replyNode?.visualDepth).toBe(MAX_VISUAL_DEPTH); // strictly 2
      expect(replyNode?.replyToAuthorName).toBe("Lê Bảo");
    });

    it("toggles like on a comment", async () => {
      const comments = await repo.listComments("post-1");
      const targetComment = comments[0];
      const initialLiked = targetComment.isLiked ?? false;
      const initialCount = targetComment.likeCount;

      const result = await repo.toggleLikeComment("post-1", targetComment.id);
      expect(result.liked).toBe(!initialLiked);
      expect(result.likeCount).toBe(initialCount + (result.liked ? 1 : -1));
    });
  });
});
