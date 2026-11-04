import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api-client";
import {
  archiveAdminPlace, createAdminPlace, listAdminPlaces, restoreAdminPlace,
  reverseGeocodeAdminPlace, updateAdminPlace,
} from "./admin-places-api";

vi.mock("@/services/api-client", () => ({ apiClient: vi.fn() }));

const payload = {
  name: "Cầu Rồng", primaryType: "tourist_attraction", categories: ["tourist_attraction"],
  location: { lat: 16.0611, lng: 108.2276 }, address: "Đà Nẵng", oldAddress: null,
  city: "Đà Nẵng", district: null, phone: null, website: null, socials: [], openingHours: null,
  businessStatus: "OPERATIONAL", description: null,
};

describe("admin places API", () => {
  beforeEach(() => vi.mocked(apiClient).mockReset());

  it("sends server-side list filters", async () => {
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: { items: [], nextCursor: null } });
    await listAdminPlaces({ q: "cầu rồng", lifecycle: "ARCHIVED", source: "MANUAL" });
    expect(apiClient).toHaveBeenCalledWith(expect.stringContaining("lifecycle=ARCHIVED"));
    expect(apiClient).toHaveBeenCalledWith(expect.stringContaining("source=MANUAL"));
  });

  it("posts create payload to the shared catalog", async () => {
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: {} });
    await createAdminPlace(payload);
    expect(apiClient).toHaveBeenCalledWith("/api/places/admin/catalog", expect.objectContaining({
      method: "POST", body: JSON.stringify(payload),
    }));
  });

  it("looks up map addresses through the admin gateway API with cancellation", async () => {
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: { matched: false, address: null } });
    const controller = new AbortController();
    await reverseGeocodeAdminPlace(16.05, 108.2, controller.signal);
    expect(apiClient).toHaveBeenCalledWith(
      "/api/places/admin/catalog/reverse-geocode?lat=16.05&lng=108.2",
      { signal: controller.signal },
    );
  });

  it("uses revision preconditions for every mutation of an existing place", async () => {
    vi.mocked(apiClient).mockResolvedValue(undefined);
    await updateAdminPlace("place/1", 4, payload);
    await archiveAdminPlace("place/1", 5);
    await restoreAdminPlace("place/1", 6);
    expect(apiClient).toHaveBeenNthCalledWith(1, "/api/places/admin/catalog/place%2F1",
      expect.objectContaining({ headers: { "If-Match": '"4"' } }));
    expect(apiClient).toHaveBeenNthCalledWith(2, "/api/places/admin/catalog/place%2F1",
      expect.objectContaining({ method: "DELETE", headers: { "If-Match": '"5"' } }));
    expect(apiClient).toHaveBeenNthCalledWith(3, "/api/places/admin/catalog/place%2F1/restore",
      expect.objectContaining({ method: "POST", headers: { "If-Match": '"6"' } }));
  });

});
