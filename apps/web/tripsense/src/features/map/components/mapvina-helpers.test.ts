import { describe, expect, it, vi } from "vitest";
import type { Place } from "@/features/places/types";
import {
  dispatchMapMarkerClick,
  hasValidPlaceLocation,
  shouldHideBuiltInMapLayer,
} from "./mapvina-helpers";

describe("shouldHideBuiltInMapLayer", () => {
  it("hides built-in POI, business, shop, and transit vector symbol layers", () => {
    expect(shouldHideBuiltInMapLayer({ id: "poi-level-1", type: "symbol", "source-layer": "poi" })).toBe(true);
    expect(shouldHideBuiltInMapLayer({ id: "poi_z15", type: "symbol" })).toBe(true);
    expect(shouldHideBuiltInMapLayer({ id: "shop-icons", type: "symbol" })).toBe(true);
    expect(shouldHideBuiltInMapLayer({ id: "transit_stop_label", type: "symbol" })).toBe(true);
    expect(shouldHideBuiltInMapLayer({ id: "aerodrome-label", type: "symbol", sourceLayer: "aerodrome_label" })).toBe(true);
  });

  it("preserves city, district, road, water, park, and non-symbol geography layers", () => {
    expect(shouldHideBuiltInMapLayer({ id: "place_city", type: "symbol", "source-layer": "place" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "place-label-district", type: "symbol" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "road_major_label", type: "symbol", "source-layer": "transportation_name" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "highway-shield-ct01", type: "symbol" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "water_name_ocean", type: "symbol", "source-layer": "water_name" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "park-label", type: "symbol" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "building-3d", type: "fill-extrusion" })).toBe(false);
    expect(shouldHideBuiltInMapLayer({ id: "map-tiles-layer", type: "raster" })).toBe(false);
  });
});

describe("hasValidPlaceLocation", () => {
  const basePlace: Omit<Place, "location"> = {
    id: "p1",
    name: "Test Place",
    categories: ["ATTRACTION"],
    photos: [],
  };

  it("accepts real finite coordinates", () => {
    expect(hasValidPlaceLocation({ ...basePlace, location: { lat: 16.0544, lng: 108.2022 } })).toBe(true);
  });

  it("rejects Null Island (0, 0), NaN, missing, and out-of-range coordinates", () => {
    expect(hasValidPlaceLocation({ ...basePlace, location: undefined })).toBe(false);
    expect(hasValidPlaceLocation({ ...basePlace, location: { lat: 0, lng: 0 } })).toBe(false);
    expect(hasValidPlaceLocation({ ...basePlace, location: { lat: Number.NaN, lng: 108.2 } })).toBe(false);
    expect(hasValidPlaceLocation({ ...basePlace, location: { lat: 95, lng: 108.2 } })).toBe(false);
    expect(hasValidPlaceLocation({ ...basePlace, location: { lat: 16.05, lng: 190 } })).toBe(false);
  });
});

describe("dispatchMapMarkerClick", () => {
  const place: Place = {
    id: "place-pin-1",
    name: "Bảo tàng Mỹ thuật Đà Nẵng",
    categories: ["MUSEUM"],
    location: { lat: 16.0715, lng: 108.2195 },
    photos: [],
  };

  it("only selects the marker by default so /places popup behavior stays intact", () => {
    const onSelectPlace = vi.fn();
    const onViewDetails = vi.fn();

    dispatchMapMarkerClick({ place, onSelectPlace, onViewDetails });

    expect(onSelectPlace).toHaveBeenCalledTimes(1);
    expect(onSelectPlace).toHaveBeenCalledWith("place-pin-1");
    expect(onViewDetails).not.toHaveBeenCalled();
  });

  it("opens place details directly without triggering floating popup selection when openDetailsOnMarkerClick is true", () => {
    const onSelectPlace = vi.fn();
    const onViewDetails = vi.fn();

    dispatchMapMarkerClick({
      place,
      openDetailsOnMarkerClick: true,
      onSelectPlace,
      onViewDetails,
    });

    expect(onSelectPlace).not.toHaveBeenCalled();
    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(place);
  });
});
