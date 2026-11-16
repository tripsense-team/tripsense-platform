import { describe, expect, it } from "vitest";
import {
  getDestinationCenter,
  inferDestinationFromPrompt,
  isValidCoordinate,
} from "./map";

describe("trip map coordinate helpers", () => {
  it("resolves Vietnamese destinations with diacritics accurately instead of falling back to Da Nang", () => {
    expect(getDestinationCenter("Đà Lạt")).toEqual([108.4583, 11.9404]);
    expect(getDestinationCenter("Hà Nội")).toEqual([105.8342, 21.0278]);
    expect(getDestinationCenter("Sa Pa")).toEqual([103.8438, 22.3364]);
    expect(getDestinationCenter("Hạ Long")).toEqual([107.0431, 20.9505]);
    expect(getDestinationCenter("Huế")).toEqual([107.5905, 16.4637]);
    expect(getDestinationCenter("Đà Nẵng")).toEqual([108.2022, 16.0544]);
  });

  it("covers international destinations from POPULAR_DESTINATIONS", () => {
    expect(getDestinationCenter("Bali")).toEqual([115.1889, -8.4095]);
    expect(getDestinationCenter("Paris")).toEqual([2.3522, 48.8566]);
    expect(getDestinationCenter("Tokyo")).toEqual([139.6917, 35.6895]);
    expect(getDestinationCenter("New York")).toEqual([-74.006, 40.7128]);
    expect(getDestinationCenter("Dubai")).toEqual([55.2708, 25.2048]);
    expect(getDestinationCenter("Sydney")).toEqual([151.2093, -33.8688]);
  });

  it("infers destinations from natural prompts without false substring positives", () => {
    expect(inferDestinationFromPrompt("Xin chào bạn hãy lên kế hoạch tôi đi du lịch đà nẵng")).toBe("Đà Nẵng");
    expect(inferDestinationFromPrompt("Gợi ý quán cafe yên tĩnh ở Đà Lạt cuối tuần")).toBe("Đà Lạt");
    expect(inferDestinationFromPrompt("5-day Tokyo trip this October")).toBe("Tokyo");
    expect(inferDestinationFromPrompt("Muốn thuê xe đi chơi cuối tuần")).toBeNull();
    expect(inferDestinationFromPrompt("Thời tiết hôm nay thế nào")).toBeNull();
  });

  it("validates coordinates against Null Island and out-of-range inputs", () => {
    expect(isValidCoordinate(16.0544, 108.2022)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate(null, 108.2)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 108.2)).toBe(false);
    expect(isValidCoordinate(-91, 10)).toBe(false);
  });
});
