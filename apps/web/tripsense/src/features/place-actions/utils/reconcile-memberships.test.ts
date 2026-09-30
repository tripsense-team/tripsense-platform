import { describe, expect, it, vi } from "vitest";
import { reconcileMemberships } from "./reconcile-memberships";

describe("reconcileMemberships", () => {
  it("serializes additions before removals", async () => {
    const calls: string[] = [];
    await reconcileMemberships(
      ["old", "kept"],
      ["kept", "new"],
      async (id) => { calls.push(`add:${id}`); },
      async (id) => { calls.push(`remove:${id}`); },
    );
    expect(calls).toEqual(["add:new", "remove:old"]);
  });

  it("does not remove confirmed memberships when an addition fails", async () => {
    const remove = vi.fn(async () => undefined);
    await expect(
      reconcileMemberships(
        ["old"],
        ["new"],
        async () => { throw new Error("add failed"); },
        remove,
      ),
    ).rejects.toThrow("add failed");
    expect(remove).not.toHaveBeenCalled();
  });
});
