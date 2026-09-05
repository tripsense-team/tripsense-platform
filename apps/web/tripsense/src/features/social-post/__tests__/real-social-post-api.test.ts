import { afterEach, describe, expect, it, vi } from "vitest";
import { RealSocialPostApi } from "../services/real-social-post-api";

describe("RealSocialPostApi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps a successful empty response empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      message: "Success",
      data: { items: [], total: 0, page: 0, size: 10, hasMore: false },
      timestamp: new Date().toISOString(),
    }), { status: 200 })));

    await expect(new RealSocialPostApi().listPosts({ page: 0, size: 10 })).resolves.toEqual({
      items: [], total: 0, page: 0, size: 10, hasMore: false,
    });
  });

  it("propagates an API failure rather than substituting a sample post", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Service unavailable" }), { status: 500 })));

    await expect(new RealSocialPostApi().listPosts()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });

  it("sends the idempotency key when creating a post", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "post-1" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new RealSocialPostApi().createPost({ content: "one post", media: [] }, "f0fd5e2f-89e2-49d7-a212-3102c0f4e9f1");

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ "Idempotency-Key": "f0fd5e2f-89e2-49d7-a212-3102c0f4e9f1" });
  });

  it("uses the mock repository only when the explicit flag is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_SOCIAL_POST_MOCK", "false");
    const realModule = await import("../services/social-post-service");
    expect(realModule.socialPostRepository.constructor.name).toBe("RealSocialPostApi");

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_SOCIAL_POST_MOCK", "true");
    const mockModule = await import("../services/social-post-service");
    expect(mockModule.socialPostRepository.constructor.name).toBe("MockSocialPostRepository");
  });
});
