import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeaningfulViewTimer } from "./meaningful-view-timer";

describe("MeaningfulViewTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits only after two visible seconds", async () => {
    const complete = vi.fn();
    const timer = new MeaningfulViewTimer(complete, () => true);

    timer.restart();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("does not emit after the detail view closes", async () => {
    const complete = vi.fn();
    const timer = new MeaningfulViewTimer(complete, () => true);

    timer.restart();
    timer.cancel();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(complete).not.toHaveBeenCalled();
  });

  it("does not count time while the document is hidden", async () => {
    const complete = vi.fn();
    let visible = false;
    const timer = new MeaningfulViewTimer(complete, () => visible);

    timer.restart();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(complete).not.toHaveBeenCalled();

    visible = true;
    timer.restart();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
