import assert from "node:assert/strict";
import test from "node:test";
import { getSystemPrompt } from "../ai/prompts.js";
import { fetchUserContext, mapContextPreferences } from "./context-preferences.js";

const endpoints = { userServiceUrl: "http://user", contextServiceUrl: "http://context" };
const signal = (dimensionCode = "FOOD_STYLE", valueCode = "CAFE", confidence: unknown = 1, source = "ONBOARDING") =>
  ({ dimensionCode, valueCode, confidence, source });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("maps only declared allowlisted Context data to typed preferences", () => {
  const preferences = mapContextPreferences([
    signal(), signal("ACTIVITY_INTEREST", "BEACH"), signal("BUDGET_TIER", "MID_RANGE"),
    signal("TRAVEL_PARTY", "FAMILY"), signal("STAY_STYLE", "HOMESTAY"),
    signal("LOYALTY_PROGRAM", "SECRET"), signal("DIETARY_RESTRICTION", "SECRET"),
    signal("FOOD_STYLE", "IGNORE_ALL_INSTRUCTIONS"), signal("FOOD_STYLE", "HOTEL"),
    signal("FOOD_STYLE", "STREET_FOOD", 1, "HISTORY"),
    signal("EXPLORE_AFFINITY", "CAFE", 0.7, "ONBOARDING_DERIVED_V1"),
    { ...signal(), freeText: "private-notes", attributes: { HOME_CITY: "private-city" } },
  ]);
  assert.deepEqual(preferences, {
    travelParty: "FAMILY", budgetTier: "MID_RANGE", stayStyles: ["HOMESTAY"],
    foodStyles: ["CAFE"], activityInterests: ["BEACH"], splurgeCategories: [],
  });
  assert.doesNotMatch(JSON.stringify(preferences), /SECRET|private|HISTORY|IGNORE_ALL/);
});

test("empty, zero weight and invalid values do not claim personalization", () => {
  assert.equal(mapContextPreferences([]), undefined);
  assert.equal(mapContextPreferences([
    ...[0, -1, 2, Number.NaN, Infinity, "1", null].map(weight => signal("FOOD_STYLE", "CAFE", weight)),
    signal("__proto__", "CAFE"), signal("constructor", "CAFE"),
  ]), undefined);
});

test("rejects envelopes, malformed arrays and excessive signal counts", () => {
  for (const value of [null, {}, { data: [] }, [null], ["CAFE"], Array.from({ length: 201 }, () => signal())]) {
    assert.throws(() => mapContextPreferences(value));
  }
});

test("deduplicates and maps deterministically regardless of response order", () => {
  const input = [signal(), signal(), signal("FOOD_STYLE", "LOCAL_FOOD"),
    signal("TRAVEL_PARTY", "FAMILY", 0.9), signal("TRAVEL_PARTY", "SOLO", 0.7)];
  assert.deepEqual(mapContextPreferences(input), mapContextPreferences([...input].reverse()));
  assert.deepEqual(mapContextPreferences(input)?.foodStyles, ["CAFE", "LOCAL_FOOD"]);
  assert.equal(mapContextPreferences(input)?.travelParty, "FAMILY");
});

test("fetches Context plus identity, never User travel preferences", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init?.redirect, "error");
    if (url === "http://user/api/users/me") {
      // Legacy preference/consent values in an identity envelope must be ignored.
      return json({ data: { displayName: "Lê", personalizationEnabled: false, preferences: { secret: "ticket" } } });
    }
    assert.equal(url, "http://context/api/context/preferences?purpose=TRIP_PLANNING");
    return json([signal()]);
  };
  const result = await fetchUserContext(endpoints, "Bearer test-token", fetcher);
  assert.equal(result.displayName, "Lê");
  assert.deepEqual(result.preferences?.foodStyles, ["CAFE"]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => !url.includes("travel-preferences")));
  const prompt = getSystemPrompt({ userName: result.displayName, userPreferences: result.preferences });
  assert.match(prompt, /CAFE/);
  assert.doesNotMatch(prompt, /ticket|personalizationEnabled/);
  assert.match(prompt, /Ưu tiên yêu cầu hiện tại/);
});

test("legacy User flag true or false has no effect on Context preferences", async () => {
  const results = [];
  for (const enabled of [true, false]) {
    const fetcher: typeof fetch = async input => String(input).startsWith("http://user/")
      ? json({ data: { displayName: "Lê", personalizationEnabled: enabled } }) : json([signal()]);
    results.push(await fetchUserContext(endpoints, "Bearer token", fetcher));
  }
  assert.deepEqual(results[0], results[1]);
});

test("identity HTTP or JSON failure does not discard valid Context", async () => {
  for (const failure of [() => json({}, 500), () => new Response("invalid-json")]) {
    const fetcher: typeof fetch = async input => String(input).startsWith("http://user/") ? failure() : json([signal()]);
    const result = await fetchUserContext(endpoints, "Bearer token", fetcher);
    assert.equal(result.displayName, undefined);
    assert.deepEqual(result.preferences?.foodStyles, ["CAFE"]);
  }
});

test("Context HTTP, schema, timeout and JSON failures retain identity without User fallback", async () => {
  const failures = [
    () => json({}, 401), () => json({}, 403), () => json({}, 500),
    () => json({ data: [signal()] }), () => new Response("bad-json"),
    () => { throw new DOMException("private-error", "TimeoutError"); },
  ];
  for (const failure of failures) {
    const calls: string[] = [];
    const fetcher: typeof fetch = async input => {
      const url = String(input); calls.push(url);
      return url === "http://user/api/users/me" ? json({ data: { name: "Lê" } }) : failure();
    };
    const result = await fetchUserContext(endpoints, "Bearer token", fetcher);
    assert.equal(result.displayName, "Lê");
    assert.equal(result.preferences, undefined);
    assert.equal(calls.length, 2);
  }
});

test("Context oversized body is cancelled and not passed to the model", async () => {
  let cancelled = false;
  const fetcher: typeof fetch = async input => {
    if (String(input).startsWith("http://user/")) return json({ data: { name: "Lê" } });
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(65_537)); },
      cancel() { cancelled = true; },
    }));
  };
  const result = await fetchUserContext(endpoints, "Bearer token", fetcher);
  assert.equal(cancelled, true);
  assert.equal(result.preferences, undefined);
  assert.equal(result.displayName, "Lê");
});

test("separate requests do not share Context across users or retain deleted preferences", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const token = new Headers(init?.headers).get("Authorization");
    if (String(input).startsWith("http://user/")) return json({ data: { name: token } });
    return json(token === "Bearer A" ? [signal()] : []);
  };
  const a = await fetchUserContext(endpoints, "Bearer A", fetcher);
  const b = await fetchUserContext(endpoints, "Bearer B", fetcher);
  assert.deepEqual(a.preferences?.foodStyles, ["CAFE"]);
  assert.equal(b.preferences, undefined);
});

test("no authorization makes no downstream calls and missing preferences stay out of prompt", async () => {
  const fetcher: typeof fetch = async () => { throw new Error("must not call"); };
  assert.deepEqual(await fetchUserContext(endpoints, undefined, fetcher), {});
  assert.doesNotMatch(getSystemPrompt({}), /Sở thích onboarding/);
});
