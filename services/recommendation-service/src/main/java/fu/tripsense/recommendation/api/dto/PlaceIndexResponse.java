package fu.tripsense.recommendation.api.dto;

import java.util.List;

public record PlaceIndexResponse(
    int submitted,
    int indexed,
    int skipped,
    int unchanged,
    int failed,
    boolean semanticEnabled,
    List<PlaceIndexItemResult> results) {
  public PlaceIndexResponse {
    results = results == null ? List.of() : List.copyOf(results);
  }
}
