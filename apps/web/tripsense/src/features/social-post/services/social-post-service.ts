import type { ISocialPostRepository } from "./social-post-repository";
import { RealSocialPostApi } from "./real-social-post-api";
import { MockSocialPostRepository } from "./mock-social-post-repository";

// Determine whether to use mock repository
const isMockEnabled =
  process.env.NEXT_PUBLIC_USE_SOCIAL_POST_MOCK === "true";

// Singleton repository instances
const realApi = new RealSocialPostApi();
const mockRepo = new MockSocialPostRepository();

export const socialPostRepository: ISocialPostRepository = isMockEnabled
  ? mockRepo
  : realApi;
