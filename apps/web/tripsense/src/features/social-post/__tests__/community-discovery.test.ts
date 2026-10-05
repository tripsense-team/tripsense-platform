import { describe, it, expect, beforeEach } from "vitest";
import { MockSocialPostRepository } from "../services/mock-social-post-repository";

describe("Community Discovery Rail Features", () => {
  let repo: MockSocialPostRepository;

  beforeEach(() => {
    repo = new MockSocialPostRepository();
  });

  describe("Suggested Creators & Follow Interactions", () => {
    it("loads list of suggested creators with niches and follower counts", async () => {
      const creators = await repo.getSuggestedCreators();
      expect(creators.length).toBeGreaterThanOrEqual(4);

      const creator1 = creators.find((c) => c.id === "creator-1");
      expect(creator1).toBeDefined();
      expect(creator1?.name).toBe("Minh Hằng");
      expect(creator1?.niche).toContain("Trekking");
      expect(creator1?.followerCount).toBe(1240);
      expect(creator1?.isFollowing).toBe(false);
    });

    it("toggles follow on an unfollowed creator and increments follower count", async () => {
      const result = await repo.toggleFollowCreator("creator-1", false);
      expect(result.following).toBe(true);
      expect(result.followerCount).toBe(1241);

      const creators = await repo.getSuggestedCreators();
      const updated = creators.find((c) => c.id === "creator-1");
      expect(updated?.isFollowing).toBe(true);
      expect(updated?.followerCount).toBe(1241);
    });

    it("toggles unfollow on an already-followed creator and decrements follower count", async () => {
      const result = await repo.toggleFollowCreator("creator-3", true);
      expect(result.following).toBe(false);
      expect(result.followerCount).toBe(2149);

      const creators = await repo.getSuggestedCreators();
      const updated = creators.find((c) => c.id === "creator-3");
      expect(updated?.isFollowing).toBe(false);
      expect(updated?.followerCount).toBe(2149);
    });

    it("throws an error when trying to toggle follow on non-existent creator", async () => {
      await expect(repo.toggleFollowCreator("non-existent-id")).rejects.toThrow(
        "Không tìm thấy người dùng",
      );
    });
  });

  describe("Destination Weather Widget", () => {
    it("fetches default weather for Da Lat", async () => {
      const weather = await repo.getDestinationWeather("dalat");
      expect(weather.cityName).toBe("Đà Lạt");
      expect(weather.temperature).toBe(19);
      expect(weather.tempRange).toContain("14°");
      expect(weather.iconType).toBe("partlyCloudy");
      expect(weather.humidity).toBe(75);
    });

    it("fetches weather for selected destination like Phu Quoc or Da Nang", async () => {
      const pqWeather = await repo.getDestinationWeather("phuquoc");
      expect(pqWeather.cityName).toBe("Phú Quốc");
      expect(pqWeather.temperature).toBe(29);
      expect(pqWeather.iconType).toBe("sunny");

      const dnWeather = await repo.getDestinationWeather("danang");
      expect(dnWeather.cityName).toBe("Đà Nẵng");
      expect(dnWeather.temperature).toBe(28);
    });

    it("falls back to Da Lat when requested cityId is unknown", async () => {
      const fallback = await repo.getDestinationWeather("unknown-city");
      expect(fallback.cityName).toBe("Đà Lạt");
    });
  });

  describe("Trending Destinations", () => {
    it("loads trending destinations recently shared with images and counts", async () => {
      const trending = await repo.getTrendingDestinations();
      expect(trending.length).toBeGreaterThanOrEqual(4);

      const dalat = trending.find((d) => d.id === "trend-1");
      expect(dalat?.name).toBe("Đà Lạt");
      expect(dalat?.shareCount).toBeGreaterThanOrEqual(1000);
      expect(dalat?.imageUrl).toContain("unsplash.com");
      expect(dalat?.slug).toBe("da-lat");
    });
  });
});
