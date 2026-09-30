import { describe, expect, it } from "vitest";
import {
  isMapWorkspacePath,
  shouldDisableSidebarWidthTransition,
} from "../user-layout.utils";

describe("user layout sidebar transitions", () => {
  it.each(["/explore", "/explore/da-nang", "/places", "/places/123"])(
    "treats %s as a map workspace",
    (pathname) => {
      expect(isMapWorkspacePath(pathname)).toBe(true);
      expect(shouldDisableSidebarWidthTransition(pathname)).toBe(true);
    },
  );

  it.each(["/chat", "/chat/123"])(
    "keeps existing instant sidebar behavior for %s",
    (pathname) => {
      expect(shouldDisableSidebarWidthTransition(pathname)).toBe(true);
    },
  );

  it.each(["/community", "/trips", "/ai-planner"])(
    "preserves animated sidebar behavior for %s",
    (pathname) => {
      expect(isMapWorkspacePath(pathname)).toBe(false);
      expect(shouldDisableSidebarWidthTransition(pathname)).toBe(false);
    },
  );
});
