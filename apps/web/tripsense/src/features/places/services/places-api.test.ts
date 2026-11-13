import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAutocomplete,
  getPlaceBatchSnapshots,
  getPlaceDetails,
  searchPlaces,
} from "./places-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("places API client", () => {
  it("routes search through the TripSense API only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: [], meta: { total: 0 } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: [] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: "p1", name: "Cafe", categories: [], photos: [] },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getAutocomplete("caf", 16.05, 108.2);
    await getPlaceDetails("provider/id", "Cafe");

    expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe(
      "/api/places/autocomplete",
    );
    expect((fetchMock.mock.calls[1][0] as URL).pathname).toBe(
      "/api/places/provider%2Fid",
    );
    expect(
      (fetchMock.mock.calls[1][0] as URL).searchParams.has("includePhoto"),
    ).toBe(false);
  });

  it("requests photos only when the caller explicitly opts in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { id: "p1", name: "Cafe" } }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getPlaceDetails(
      "p1",
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );

    expect(
      (fetchMock.mock.calls[0][0] as URL).searchParams.get("includePhoto"),
    ).toBe("true");
  });

  it("preserves structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { code: "PROVIDER_UNAVAILABLE", message: "Please retry" },
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(searchPlaces({ q: "cafe" })).rejects.toMatchObject({
      name: "PlaceApiError",
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      message: "Please retry",
    });
  });

  it("normalizes places with missing id using providerPlaceId or fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              providerPlaceId: "prov-123",
              name: "Coffee Shop",
              location: { lat: 16.05, lng: 108.2 },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPlaces({ q: "coffee" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("prov-123");
    expect(result.data[0].providerPlaceId).toBe("prov-123");
  });

  it("fetches batch snapshots in a single POST call and keys by canonical and provider ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "place-1",
              providerPlaceId: "prov-1",
              name: "Cầu Rồng",
              categories: ["landmark"],
              photos: ["https://res.cloudinary.com/demo/caurong.jpg"],
              primaryPhoto: {
                url: "https://res.cloudinary.com/demo/caurong.jpg",
                source: "cloudinary",
                attribution: [],
                fetchedAt: "2026-11-13T00:00:00Z",
                displayApproved: true,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const map = await getPlaceBatchSnapshots([" place-1 ", "place-1", "place-2"], true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe("/api/places/batch-snapshots?includePhoto=true");
    expect(requestInit.method).toBe("POST");
    expect(JSON.parse(String(requestInit.body))).toEqual(["place-1", "place-2"]);
    expect(map["place-1"]?.primaryPhoto?.url).toBe(
      "https://res.cloudinary.com/demo/caurong.jpg",
    );
    expect(map["prov-1"]?.id).toBe("place-1");
  });
});
