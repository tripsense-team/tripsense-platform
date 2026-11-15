import assert from "node:assert/strict";
import test from "node:test";
import {
  getRecommendPlacesTool,
  recommendPlaces,
  recommendPlacesSchema,
} from "./recommend-places.js";
import { getSearchPlacesTool } from "./search-places.js";
import { PlaceGroundingStore } from "../place-grounding.js";

test("recommendPlacesSchema validates curated places correctly", () => {
  const valid = {
    title: "Điểm đến nổi bật tại Đà Nẵng",
    destination: "Đà Nẵng",
    places: [
      {
        placeId: "place-my-khe",
        name: "Bãi biển Mỹ Khê",
        category: "BEACH",
        reason: "Bãi cát trắng mịn, thích hợp tắm biển buổi chiều",
        rating: 4.8,
      },
      {
        name: "Bán đảo Sơn Trà & Chùa Linh Ứng",
        category: "ATTRACTION",
        reason: "Ngắm tượng Phật Bà và toàn cảnh vịnh Đà Nẵng",
      },
      {
        name: "Bánh tráng cuốn thịt heo Đại Lộc",
        category: "FOOD",
        reason: "Món ngon đậm vị đặc sản địa phương",
      },
    ],
  };

  const parsed = recommendPlacesSchema.safeParse(valid);
  assert.equal(parsed.success, true);
});

test("recommendPlacesSchema rejects empty places list", () => {
  const invalid = {
    title: "Không có địa điểm",
    places: [],
  };
  const parsed = recommendPlacesSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});

test("recommendPlaces.execute degrades gracefully with fallback IDs and photos when services are offline", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await (recommendPlaces as any).execute({
    title: "Gợi ý Đà Nẵng",
    destination: "Đà Nẵng",
    places: [
      {
        name: "Cầu Rồng",
        category: "ATTRACTION",
        reason: "Xem rồng phun lửa cuối tuần",
      },
      {
        name: "Quán Cafe Út Tịch",
        category: "CAFE",
        reason: "View đẹp hoài cổ",
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.title, "Gợi ý Đà Nẵng");
  assert.equal(result.destination, "Đà Nẵng");
  assert.equal(result.total, 2);
  assert.equal(result.groundedCount, 0);
  assert.equal(result.places.length, 2);

  assert.ok(result.places[0].id.startsWith("ai-rec-1-"));
  assert.equal(result.places[0].name, "Cầu Rồng");
  assert.ok(result.places[0].photoUrl.includes("unsplash.com"));
  assert.equal(result.places[0].reason, "Xem rồng phun lửa cuối tuần");

  assert.ok(result.places[1].id.startsWith("ai-rec-2-"));
  assert.equal(result.places[1].name, "Quán Cafe Út Tịch");
  assert.ok(result.places[1].photoUrl.includes("unsplash.com"));
});

test("getSearchPlacesTool batch mode feeds getRecommendPlacesTool with verified IDs and real photos", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("/api/places/search")) {
      const q = new URL(urlStr).searchParams.get("q") || "";
      if (q.includes("hải sản")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "food-1",
                name: "Hải Sản Bé Mặn",
                city: "Đà Nẵng",
                address: "Lô 14 Hoàng Sa, Sơn Trà, Đà Nẵng",
                categories: ["restaurant"],
                rating: 4.6,
                primaryPhoto: { url: "https://res.cloudinary.com/demo/be-man.jpg" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "cafe-1",
              name: "Sơn Trà Marina",
              city: "Đà Nẵng",
              address: "Hồ Xanh, Sơn Trà, Đà Nẵng",
              categories: ["cafe"],
              rating: 4.5,
              primaryPhoto: { url: "https://res.cloudinary.com/demo/marina.jpg" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const store = new PlaceGroundingStore();
  const searchTool = getSearchPlacesTool({ destinationHint: "Đà Nẵng", store });
  const recTool = getRecommendPlacesTool({ destinationHint: "Đà Nẵng", store });

  const searchRes = await (searchTool as any).execute({
    queries: [
      { query: "hải sản", category: "FOOD", limit: 3 },
      { query: "cafe view biển", category: "CAFE", limit: 3 },
    ],
  });

  assert.equal(searchRes.success, true);
  assert.equal(searchRes.mode, "batch");
  assert.equal(searchRes.total, 2);

  const recRes = await (recTool as any).execute({
    title: "Ăn ngon & Cafe view biển Đà Nẵng",
    places: [
      {
        placeId: "food-1",
        name: "Hải Sản Bé Mặn",
        category: "FOOD",
        reason: "Hải sản tươi sống nổi tiếng",
      },
      {
        name: "Sơn Trà Marina",
        category: "CAFE",
        reason: "Phong cách Santorini ngắm vịnh Đà Nẵng",
      },
    ],
  });

  assert.equal(recRes.success, true);
  assert.equal(recRes.groundedCount, 2);
  assert.equal(recRes.places[0].id, "food-1");
  assert.equal(recRes.places[0].photoUrl, "https://res.cloudinary.com/demo/be-man.jpg");
  assert.equal(recRes.places[1].id, "cafe-1");
  assert.equal(recRes.places[1].photoUrl, "https://res.cloudinary.com/demo/marina.jpg");
});
