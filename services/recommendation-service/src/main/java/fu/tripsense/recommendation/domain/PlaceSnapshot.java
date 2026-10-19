package fu.tripsense.recommendation.domain;

import java.time.Instant;
import java.util.List;

public record PlaceSnapshot(
    String id,
    String provider,
    String providerPlaceId,
    String name,
    GeoPoint location,
    String address,
    String city,
    String district,
    List<String> categories,
    Double rating,
    Integer userRatingCount,
    QuietnessEvidence quietnessEvidence,
    List<String> photos,
    String openingHours,
    String businessStatus,
    String description,
    Instant fetchedAt,
    String freshness,
    String primaryType) {
  public PlaceSnapshot {
    categories = categories == null ? List.of() : List.copyOf(categories);
    photos = photos == null ? List.of() : List.copyOf(photos);
  }

  /** Source compatibility for snapshots without explicit primary type. */
  public PlaceSnapshot(
      String id,
      String provider,
      String providerPlaceId,
      String name,
      GeoPoint location,
      String address,
      String city,
      String district,
      List<String> categories,
      Double rating,
      Integer userRatingCount,
      QuietnessEvidence quietnessEvidence,
      List<String> photos,
      String openingHours,
      String businessStatus,
      String description,
      Instant fetchedAt,
      String freshness) {
    this(
        id,
        provider,
        providerPlaceId,
        name,
        location,
        address,
        city,
        district,
        categories,
        rating,
        userRatingCount,
        quietnessEvidence,
        photos,
        openingHours,
        businessStatus,
        description,
        fetchedAt,
        freshness,
        null);
  }

  public PlaceSnapshot(
      String id,
      String provider,
      String providerPlaceId,
      String name,
      GeoPoint location,
      String address,
      String city,
      String district,
      List<String> categories,
      Double rating,
      Integer userRatingCount,
      List<String> photos,
      String openingHours,
      String businessStatus,
      String description,
      Instant fetchedAt,
      String freshness) {
    this(
        id,
        provider,
        providerPlaceId,
        name,
        location,
        address,
        city,
        district,
        categories,
        rating,
        userRatingCount,
        null,
        photos,
        openingHours,
        businessStatus,
        description,
        fetchedAt,
        freshness);
  }
}
