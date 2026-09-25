package fu.tripsense.recommendation.api.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

public record RecommendationRequest(
    @Size(max = 200) String query,
    UUID tripId,
    @Pattern(regexp = "[A-Za-z0-9._:-]{1,128}") String sessionId,
    @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
    @DecimalMin("-180.0") @DecimalMax("180.0") Double lng,
    @Min(100) @Max(50_000) Integer radiusMeters,
    @Size(max = 20) Set<@Pattern(regexp = "[A-Za-z0-9_ -]{1,80}") String> preferredCategories,
    @Size(max = 20) Set<@Pattern(regexp = "[A-Za-z0-9_ -]{1,80}") String> dislikedCategories,
    @Size(max = 20) Set<@Pattern(regexp = "[A-Za-z0-9_ -]{1,80}") String> requiredCategories,
    @Valid GeographicScopeDto geographicScope,
    @Size(max = 12) List<@Valid RankingCriterionDto> rankingCriteria,
    @Min(1) @Max(50) Integer limit) {

  public record GeographicScopeDto(
      @Size(max = 120) String name,
      @Size(max = 120) String adminArea,
      @Size(max = 120) String district,
      boolean strictNamedArea) {}

  public record RankingCriterionDto(
      @NotNull CriterionFeature feature,
      @NotNull CriterionDirection direction,
      @NotNull CriterionImportance importance) {}

  public enum CriterionFeature {
    RETRIEVAL_RELEVANCE,
    DISTANCE,
    RATING,
    POPULARITY,
    QUIETNESS,
    PREFERENCE,
    CONTEXT,
    HISTORY,
    SEMANTIC
  }

  public enum CriterionDirection { MINIMIZE, MAXIMIZE }

  public enum CriterionImportance { LOW, MEDIUM, HIGH }

  @AssertTrue(message = "Latitude and longitude must be provided together")
  public boolean isCoordinatePairValid() {
    return (lat == null) == (lng == null);
  }

  @AssertTrue(message = "A query, category, trip, or location anchor is required")
  public boolean hasIntent() {
    return (query != null && !query.isBlank())
        || (preferredCategories != null && !preferredCategories.isEmpty())
        || (requiredCategories != null && !requiredCategories.isEmpty())
        || tripId != null
        || (lat != null && lng != null);
  }

  @AssertTrue(message = "A category cannot be both preferred and disliked")
  public boolean hasNoCategoryConflict() {
    if (preferredCategories == null || dislikedCategories == null) return true;
    return preferredCategories.stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .noneMatch(
            value ->
                dislikedCategories.stream()
                    .map(category -> category.toLowerCase(Locale.ROOT))
                    .anyMatch(value::equals));
  }

  public int effectiveLimit() {
    return limit == null ? 10 : limit;
  }

  @AssertTrue(message = "A ranking criterion feature may be specified only once")
  public boolean hasUniqueRankingCriteria() {
    if (rankingCriteria == null) return true;
    return rankingCriteria.stream().map(RankingCriterionDto::feature).distinct().count()
        == rankingCriteria.size();
  }
}
