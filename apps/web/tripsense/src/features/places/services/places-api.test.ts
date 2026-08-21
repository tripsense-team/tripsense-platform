import { afterEach, describe, expect, it, vi } from "vitest";

import { getAutocomplete, getPlaceDetails, searchPlaces } from "./places-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("places API client", () => {
  it("routes search through the TripSense API only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [], meta: { total: 0 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPlaces({ q: " cafe ", lat: 16.05, lng: 108.2, limit: 10 });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.origin).toBe(window.location.origin);
    expect(requestedUrl.pathname).toBe("/api/places/search");
    expect(requestedUrl.searchParams.get("q")).toBe("cafe");
    expect(requestedUrl.hostname).not.toBe("maps.mapvina.com");
  });

  it("uses Gateway-relative endpoints for autocomplete and details", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: "p1", name: "Cafe", categories: [], photos: [] } }))
      );
    vi.stubGlobal("fetch", fetchMock);

    await getAutocomplete("caf", 16.05, 108.2);
    await getPlaceDetails("provider/id", "Cafe");

    expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe("/api/places/autocomplete");
    expect((fetchMock.mock.calls[1][0] as URL).pathname).toBe("/api/places/provider%2Fid");
  });

  it("preserves structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "PROVIDER_UNAVAILABLE", message: "Please retry" } }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(searchPlaces({ q: "cafe" })).rejects.toMatchObject({
      name: "PlaceApiError",
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      message: "Please retry",
    });
  });
});
