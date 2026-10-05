package fu.tripsense.recommendation.domain;

public record GeographicScope(
    String name, String adminArea, String district, boolean strictNamedArea) {}
