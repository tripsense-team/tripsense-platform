import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDestinationQuery,
  executeHybridPlaceSearch,
  extractPhotoUrl,
  groundRecommendations,
  mapUserPreferencesToCategories,
  PlaceGroundingStore,
  prepareTripCandidates,
  resolveCanonicalActivityPlaces,
} from "./place-grounding.js";

test("extractPhotoUrl prioritizes primaryPhoto, READY media primary, and Cloudinary URLs", () => {
  assert.equal(
    extractPhotoUrl({
      primaryPhoto: { url: "https://res.cloudinary.com/demo/image/upload/p1.jpg" },
      media: { state: "READY", primary: { url: "https://example.com/media.jpg" } },
      photos: ["https://example.com/old.jpg"],
    }),
    "https://res.cloudinary.com/demo/image/upload/p1.jpg"
  );

  assert.equal(
    extractPhotoUrl({
      media: { state: "READY", primary: { url: "https://res.cloudinary.com/demo/ready.jpg" } },
      photos: ["https://lh3.googleusercontent.com/temp"],
    }),
    "https://res.cloudinary.com/demo/ready.jpg"
  );

  assert.equal(
    extractPhotoUrl({
      media: { state: "PENDING", primary: { url: "https://example.com/pending.jpg" } },
      photos: [
        "https://lh3.googleusercontent.com/ephemeral",
        "https://res.cloudinary.com/demo/image/upload/perm.jpg",
      ],
    }),
    "https://res.cloudinary.com/demo/image/upload/perm.jpg"
  );
});

test("buildDestinationQuery appends destination only when missing (accent-insensitive)", () => {
  assert.equal(buildDestinationQuery("cafe view biển", "Phú Quốc"), "cafe view biển Phú Quốc");
  assert.equal(buildDestinationQuery("cafe view biển phú quốc", "Phú Quốc"), "cafe view biển phú quốc");
  assert.equal(buildDestinationQuery("hải sản phu quoc", "Phú Quốc"), "hải sản phu quoc");
  assert.equal(buildDestinationQuery("Bãi biển Mỹ Khê", undefined), "Bãi biển Mỹ Khê");
});

test("executeHybridPlaceSearch merges place-service and recommendation-service results and hydrates missing photos", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedSnapshotBody: unknown;
  let capturedSnapshotIncludePhoto: string | null = null;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("/api/places/search")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "place-cafe-1",
              name: "Chuồn Chuồn Bistro",
              address: "Đồi Sao Mai, Dương Đông, Phú Quốc",
              city: "Phú Quốc",
              categories: ["cafe"],
              rating: 4.7,
              userRatingCount: 512,
              location: { lat: 10.2145, lng: 103.9571 },
              photos: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/recommendations")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                score: 0.92,
                reasons: ["View hoàng hôn đỉnh cao hợp gu chill"],
                place: {
                  id: "place-sunset-2",
                  name: "Sunset Sanato Beach Club",
                  address: "Bãi Trường, Phú Quốc",
                  city: "Phú Quốc",
                  categories: ["cafe", "beach"],
                  rating: 4.8,
                  userRatingCount: 840,
                  location: { lat: 10.1512, lng: 103.9721 },
                  photos: ["https://res.cloudinary.com/demo/image/upload/sunset.jpg"],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/places/batch-snapshots")) {
      const parsed = new URL(urlStr);
      capturedSnapshotIncludePhoto = parsed.searchParams.get("includePhoto");
      capturedSnapshotBody = JSON.parse(String(init?.body || "[]"));
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "place-cafe-1",
              name: "Chuồn Chuồn Bistro",
              primaryPhoto: { url: "https://res.cloudinary.com/demo/image/upload/chuonchuon.jpg" },
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
  const result = await executeHybridPlaceSearch({
    query: "cafe view biển",
    category: "CAFE",
    limit: 5,
    destinationHint: "Phú Quốc",
    authorization: "Bearer test-token",
    store,
  });

  assert.equal(result.success, true);
  assert.equal(result.effectiveQuery, "cafe view biển Phú Quốc");
  assert.equal(result.places.length, 2);
  assert.equal(capturedSnapshotIncludePhoto, "true");
  assert.deepEqual(capturedSnapshotBody, ["place-cafe-1"]);

  const cafe = result.places.find((p) => p.id === "place-cafe-1");
  assert.equal(cafe?.photoUrl, "https://res.cloudinary.com/demo/image/upload/chuonchuon.jpg");
  assert.ok(store.getById("place-sunset-2"));
});

test("groundRecommendations resolves cached & searched places with real IDs and Cloudinary photos", async (t) => {
  const originalFetch = globalThis.fetch;
  const store = new PlaceGroundingStore();
  store.add([
    {
      id: "real-my-khe",
      name: "Bãi biển Mỹ Khê",
      address: "Võ Nguyên Giáp, Đà Nẵng",
      city: "Đà Nẵng",
      categories: ["beach"],
      location: { lat: 16.0598, lng: 108.2468 },
      rating: 4.9,
      userRatingCount: 2500,
      photoUrl: undefined,
      grounded: true,
    },
  ]);

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("/api/places/batch-snapshots")) {
      const ids = JSON.parse(String(init?.body || "[]")) as string[];
      const items = ids.map((id) => ({
        id,
        name: id === "real-my-khe" ? "Bãi biển Mỹ Khê" : "Cầu Rồng Đà Nẵng",
        address: id === "real-my-khe" ? "Võ Nguyên Giáp, Đà Nẵng" : "An Hải Tây, Sơn Trà, Đà Nẵng",
        rating: 4.8,
        primaryPhoto: { url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg` },
      }));
      return new Response(JSON.stringify({ success: true, data: items }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("/api/places/search")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "real-cau-rong",
              name: "Cầu Rồng Đà Nẵng",
              address: "An Hải Tây, Sơn Trà, Đà Nẵng",
              city: "Đà Nẵng",
              categories: ["attraction"],
              rating: 4.8,
              photos: ["https://res.cloudinary.com/demo/image/upload/real-cau-rong.jpg"],
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

  const grounded = await groundRecommendations({
    destination: "Đà Nẵng",
    store,
    places: [
      {
        placeId: "real-my-khe",
        name: "Bãi biển Mỹ Khê",
        category: "BEACH",
        reason: "Bãi cát mịn, hợp tắm biển buổi sáng",
      },
      {
        name: "Cầu Rồng",
        category: "ATTRACTION",
        reason: "Biểu tượng Đà Nẵng về đêm",
      },
    ],
  });

  assert.equal(grounded.length, 2);
  assert.equal(grounded[0].id, "real-my-khe");
  assert.equal(grounded[0].grounded, true);
  assert.equal(grounded[0].photoUrl, "https://res.cloudinary.com/demo/image/upload/real-my-khe.jpg");
  assert.equal(grounded[0].reason, "Bãi cát mịn, hợp tắm biển buổi sáng");

  assert.equal(grounded[1].id, "real-cau-rong");
  assert.equal(grounded[1].grounded, true);
  assert.equal(grounded[1].photoUrl, "https://res.cloudinary.com/demo/image/upload/real-cau-rong.jpg");
});

test("resolveCanonicalActivityPlaces skips generic logistics and resolves real venues", async (t) => {
  const originalFetch = globalThis.fetch;
  let searchCount = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes("/api/places/batch-snapshots")) {
      const ids = JSON.parse(String(init?.body || "[]")) as string[];
      if (ids.includes("hotel-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "hotel-1",
                name: "Sala Danang Beach Hotel",
                address: "36-38 Lâm Hoành, Đà Nẵng",
                primaryPhoto: { url: "https://res.cloudinary.com/demo/sala.jpg" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/api/places/search")) {
      searchCount += 1;
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "madame-lan-id",
              name: "Nhà hàng Madame Lân",
              address: "04 Bạch Đằng, Hải Châu, Đà Nẵng",
              categories: ["restaurant"],
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

  const resolved = await resolveCanonicalActivityPlaces({
    destinationHint: "Đà Nẵng",
    items: [
      { placeId: "hotel-1", title: "Sala Danang", category: "STAY" },
      { title: "Nghỉ ngơi tại khách sạn", category: "ACTIVITY" },
      { title: "Madame Lân", category: "FOOD" },
    ],
  });

  assert.equal(resolved.get(0)?.id, "hotel-1");
  assert.equal(resolved.get(0)?.address, "36-38 Lâm Hoành, Đà Nẵng");
  assert.equal(resolved.has(1), false);
  assert.equal(resolved.get(2)?.id, "madame-lan-id");
  assert.equal(searchCount, 1);
});

test("executeHybridPlaceSearch forwards coordinates, preferredCategories, and dislikedCategories without overlap", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedRecBody: any = null;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes("/api/recommendations")) {
      capturedRecBody = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                score: 0.9,
                reasons: ["Hợp gu biển chill"],
                place: {
                  id: "geo-rec-1",
                  name: "Esco Beach Bar",
                  categories: ["beach", "cafe"],
                  photos: ["https://res.cloudinary.com/demo/esco.jpg"],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlStr.includes("/api/places/search")) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const res = await executeHybridPlaceSearch({
    query: "quán cafe view biển",
    category: "CAFE",
    lat: 16.0544,
    lng: 108.2022,
    preferredCategories: ["beach", "bar"],
    dislikedCategories: ["bar", "nightclub"],
    destinationHint: "Đà Nẵng",
    authorization: "Bearer test-token",
  });

  assert.equal(res.success, true);
  assert.equal(res.places.length, 1);
  assert.equal(res.places[0].id, "geo-rec-1");
  assert.ok(capturedRecBody);
  assert.equal(capturedRecBody.lat, 16.0544);
  assert.equal(capturedRecBody.lng, 108.2022);
  assert.equal(capturedRecBody.preferredCategories.includes("cafe"), true);
  assert.equal(capturedRecBody.preferredCategories.includes("beach"), true);
  assert.equal(capturedRecBody.preferredCategories.includes("bar"), false);
  assert.deepEqual(capturedRecBody.dislikedCategories, ["bar", "nightclub"]);
});

test("prepareTripCandidates prioritizes Qdrant recommendations with user preferences and falls back only for sparse categories", async (t) => {
  const originalFetch = globalThis.fetch;
  let placeSearchCalls = 0;
  let batchSnapshotCalled = false;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("/api/recommendations")) {
      const body = JSON.parse(String(init?.body || "{}"));
      const cats: string[] = body.preferredCategories || [];
      if (cats.includes("restaurant")) {
        // Dense Qdrant hits for FOOD -> should NOT trigger place-service fallback
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  score: 0.91,
                  reasons: ["Đặc sản địa phương"],
                  place: {
                    id: "rec-food-1",
                    name: "Mì Quảng Bà Mua",
                    categories: ["restaurant"],
                    photos: [],
                  },
                },
                {
                  score: 0.88,
                  reasons: ["Hợp street food"],
                  place: {
                    id: "rec-food-2",
                    name: "Bánh Xèo Bà Dưỡng",
                    categories: ["restaurant"],
                    photos: ["https://res.cloudinary.com/demo/bx.jpg"],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // Sparse hits for STAY -> triggers place-service fallback
      return new Response(JSON.stringify({ success: true, data: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("/api/places/search")) {
      placeSearchCalls += 1;
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "ps-stay-1",
              name: "Ninh Bình Hidden Charm Hotel",
              categories: ["hotel"],
              photos: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/places/batch-snapshots")) {
      batchSnapshotCalled = true;
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "rec-food-1",
              name: "Mì Quảng Bà Mua",
              primaryPhoto: { url: "https://res.cloudinary.com/demo/miquang.jpg" },
            },
            {
              id: "ps-stay-1",
              name: "Ninh Bình Hidden Charm Hotel",
              primaryPhoto: { url: "https://res.cloudinary.com/demo/nb-hotel.jpg" },
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
  const mappedPrefs = mapUserPreferencesToCategories({
    stayStyles: ["HOMESTAY"],
    foodStyles: ["STREET_FOOD"],
    activityInterests: ["NATURE"],
    splurgeCategories: [],
  });
  assert.equal(mappedPrefs.includes("homestay"), true);
  assert.equal(mappedPrefs.includes("street_food"), true);

  const result = await prepareTripCandidates({
    destination: "Ninh Bình",
    categories: ["FOOD", "STAY"],
    limitPerCategory: 2,
    userPreferences: {
      stayStyles: ["HOMESTAY"],
      foodStyles: ["STREET_FOOD"],
      activityInterests: ["NATURE"],
      splurgeCategories: [],
    },
    authorization: "Bearer user-jwt",
    store,
  });

  assert.equal(result.success, true);
  assert.equal(result.fallbackTriggered, true);
  assert.equal(placeSearchCalls, 1);
  assert.equal(batchSnapshotCalled, true);
  assert.equal(result.groups[0].source, "recommendation");
  assert.equal(result.groups[1].source, "place-service");
  assert.equal(store.getById("rec-food-1")?.photoUrl, "https://res.cloudinary.com/demo/miquang.jpg");
  assert.equal(store.getById("ps-stay-1")?.photoUrl, "https://res.cloudinary.com/demo/nb-hotel.jpg");
});

test("resolveCanonicalActivityPlaces reuses cached hydrated store entries and only fetches missing photos", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedBatches: string[][] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes("/api/places/batch-snapshots")) {
      const ids = JSON.parse(String(init?.body || "[]")) as string[];
      requestedBatches.push(ids);
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "food-no-photo",
              name: "Bánh xèo Bà Dưỡng",
              primaryPhoto: { url: "https://res.cloudinary.com/demo/banhxeo.jpg" },
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
  store.add([
    {
      id: "hotel-cached",
      name: "Sala Danang Beach Hotel",
      address: "36-38 Lâm Hoành, Đà Nẵng",
      categories: ["hotel"],
      photoUrl: "https://res.cloudinary.com/demo/sala.jpg",
      grounded: true,
      source: "recommendation",
    },
    {
      id: "food-no-photo",
      name: "Bánh xèo Bà Dưỡng",
      categories: ["restaurant"],
      grounded: true,
      source: "place-service",
    },
  ]);

  // Case 1: Only cached place with photo -> 0 batch-snapshots calls
  const cachedOnly = await resolveCanonicalActivityPlaces({
    destinationHint: "Đà Nẵng",
    store,
    items: [{ placeId: "hotel-cached", title: "Sala Danang Beach Hotel", category: "STAY" }],
  });
  assert.equal(requestedBatches.length, 0);
  assert.equal(cachedOnly.get(0)?.id, "hotel-cached");
  assert.equal(cachedOnly.get(0)?.photoUrl, "https://res.cloudinary.com/demo/sala.jpg");

  // Case 2: Mixed cached (with photo) + cached (no photo) + uncached -> only requests missing photo IDs
  const mixed = await resolveCanonicalActivityPlaces({
    destinationHint: "Đà Nẵng",
    store,
    items: [
      { placeId: "hotel-cached", title: "Sala Danang Beach Hotel", category: "STAY" },
      { placeId: "food-no-photo", title: "Bánh xèo Bà Dưỡng", category: "FOOD" },
      { placeId: "missing-id", title: "Chợ Hàn", category: "ACTIVITY" },
    ],
  });

  assert.equal(requestedBatches.length, 1);
  assert.deepEqual(requestedBatches[0], ["food-no-photo", "missing-id"]);
  assert.equal(mixed.get(0)?.photoUrl, "https://res.cloudinary.com/demo/sala.jpg");
  assert.equal(mixed.get(1)?.photoUrl, "https://res.cloudinary.com/demo/banhxeo.jpg");
});


