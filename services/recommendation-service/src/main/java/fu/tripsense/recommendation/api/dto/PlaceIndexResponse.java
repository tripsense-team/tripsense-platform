package fu.tripsense.recommendation.api.dto;

public record PlaceIndexResponse(
    int submitted, int indexed, int skipped, boolean semanticEnabled) {}
