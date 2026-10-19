import assert from "node:assert/strict";
import test from "node:test";
import { recommendPlaces, recommendPlacesSchema } from "./recommend-places.js";

test("recommendPlacesSchema validates curated places correctly", () => {
  const valid = {
    title: "Điểm đến nổi bật tại Đà Nẵng",
    destination: "Đà Nẵng",
    places: [
      {
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

test("recommendPlaces.execute formats places and generates IDs with fallback photos", async () => {
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
  assert.equal(result.places.length, 2);

  // Check ID generation & fallback photo
  assert.ok(result.places[0].id.startsWith("ai-rec-1-"));
  assert.equal(result.places[0].name, "Cầu Rồng");
  assert.ok(result.places[0].photoUrl.includes("unsplash.com"));
  assert.equal(result.places[0].reason, "Xem rồng phun lửa cuối tuần");

  assert.ok(result.places[1].id.startsWith("ai-rec-2-"));
  assert.equal(result.places[1].name, "Quán Cafe Út Tịch");
  assert.ok(result.places[1].photoUrl.includes("unsplash.com"));
});
