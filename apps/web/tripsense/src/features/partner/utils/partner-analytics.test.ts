import { describe, expect, it } from "vitest";
import { aggregatePartnerRate } from "./partner-analytics";

describe("aggregatePartnerRate", () => {
  it("aggregates numerators and denominators before calculating the rate", () => {
    expect(aggregatePartnerRate([
      { numerator: 2, denominator: 3, value: 2 / 3 },
      { numerator: 1, denominator: 2, value: 1 / 2 },
    ])).toEqual({ numerator: 3, denominator: 5, value: 3 / 5 });
  });

  it("returns unavailable when an API result omits rate counts", () => {
    expect(aggregatePartnerRate([{ numerator: 1, denominator: 2, value: 0.5 }, undefined])).toBeNull();
  });

  it("returns unavailable when there are no resolved reservations", () => {
    expect(aggregatePartnerRate([{ numerator: 0, denominator: 0, value: 0 }])).toBeNull();
  });
});
