import { describe, it, expect, vi } from "vitest";
import type { SocialPost } from "../types";

describe("Race Condition & Double Submission Prevention", () => {
  describe("Post prepend deduplication", () => {
    it("does not duplicate posts in feed when prepended multiple times", () => {
      let posts: SocialPost[] = [];

      const prependPost = (newPost: SocialPost) => {
        if (!posts.some((p) => p.id === newPost.id)) {
          posts = [newPost, ...posts];
        }
      };

      const mockPost: SocialPost = {
        id: "post-double-click-1",
        author: { id: "user-1", name: "User 1" },
        content: "Testing race condition duplicate post",
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };

      // User double clicks or event fires twice
      prependPost(mockPost);
      prependPost(mockPost);
      prependPost(mockPost);

      expect(posts.length).toBe(1);
      expect(posts[0].id).toBe("post-double-click-1");
    });
  });

  describe("In-flight post creation mutex lock", () => {
    it("rejects concurrent creation calls when one is in flight", async () => {
      let inFlight = false;

      const createPostSimulation = async (content: string) => {
        if (inFlight) {
          throw new Error("Bài viết đang được xử lý, vui lòng chờ.");
        }
        inFlight = true;
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { id: "new-post-1", content };
        } finally {
          inFlight = false;
        }
      };

      // Fire 2 concurrent calls without waiting for first
      const p1 = createPostSimulation("Post 1");
      const p2 = createPostSimulation("Post 2");

      const [res1, res2] = await Promise.allSettled([p1, p2]);

      expect(res1.status).toBe("fulfilled");
      expect(res2.status).toBe("rejected");
      if (res2.status === "rejected") {
        expect(res2.reason.message).toContain("Bài viết đang được xử lý");
      }
    });
  });

  describe("Comment creation mutex lock", () => {
    it("blocks second submission when first comment is currently submitting", async () => {
      let isSubmitting = false;
      const apiSpy = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { id: "comm-1", content: "Great trip!" };
      });

      const submitComment = async (content: string) => {
        if (isSubmitting) return null;
        isSubmitting = true;
        try {
          return await apiSpy(content);
        } finally {
          isSubmitting = false;
        }
      };

      // Simulate simultaneous Enter keypress and button click
      const results = await Promise.all([
        submitComment("Test 1"),
        submitComment("Test 2"),
      ]);

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });
  });

  describe("Weather city switch race condition", () => {
    it("only applies the latest requested destination weather", async () => {
      let latestReqId = 0;
      let appliedData: string | null = null;

      const fetchWeatherForCity = async (cityId: string, delayMs: number) => {
        const reqId = ++latestReqId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (reqId === latestReqId) {
          appliedData = cityId;
        }
      };

      // City 1 is requested first but takes 100ms (slow network)
      const p1 = fetchWeatherForCity("dalat", 100);
      // City 2 is requested immediately after and takes only 20ms (fast network)
      const p2 = fetchWeatherForCity("phuquoc", 20);

      await Promise.all([p1, p2]);

      // City 2 must win and not be overwritten by City 1
      expect(appliedData).toBe("phuquoc");
    });
  });
});
