package fu.tripsense.contextservice.adapter.in.web.dto;

import java.util.List;

public record AdminContextStatsResponse(
    int periodDays,
    long totalOnboardingProfiles,
    long completedOnboardingProfiles,
    long periodOnboardingProfiles,
    long totalPreferenceSignals,
    List<PreferenceSegmentItem> topPreferences) {

  public record PreferenceSegmentItem(
      String dimensionCode, String valueCode, long count, double avgConfidence) {}
}

