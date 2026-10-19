import type { PartnerAnalyticsRateDto } from "../types";

/** Aggregate raw rate counts without assuming every API version includes them. */
export function aggregatePartnerRate(
  rates: Array<PartnerAnalyticsRateDto | null | undefined>,
): PartnerAnalyticsRateDto | null {
  if (rates.length === 0 || rates.some((rate) =>
    !rate || !Number.isFinite(rate.numerator) || !Number.isFinite(rate.denominator),
  )) {
    return null;
  }

  const completeRates = rates as PartnerAnalyticsRateDto[];
  const numerator = completeRates.reduce((sum, rate) => sum + rate.numerator, 0);
  const denominator = completeRates.reduce((sum, rate) => sum + rate.denominator, 0);
  if (denominator === 0) return null;
  return { numerator, denominator, value: numerator / denominator };
}
