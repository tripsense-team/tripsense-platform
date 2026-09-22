import { describe, expect, it } from "vitest";
import { upsertArtifact } from "./upsert-artifact";
import type { AiArtifact } from "./types";

describe("upsertArtifact", () => {
  it("replaces progressive versions and ignores stale replay", () => {
    const first: AiArtifact = { artifactId: "places-1", schemaVersion: 1, type: "PLACE_LIST", version: 1,
      data: { places: [{ id: "place-1" }] } };
    const second: AiArtifact = { ...first, version: 2,
      data: { places: [{ id: "place-1" }, { id: "place-2" }] } };
    const latest = upsertArtifact(upsertArtifact([], first), second);
    expect(latest).toHaveLength(1);
    expect(latest[0]).toEqual(second);
    expect(upsertArtifact(latest, first)).toEqual(latest);
  });
});
