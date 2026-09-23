package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceReview;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.dto.PlaceReviewDto;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class PlacePersistenceServiceImpl implements PlacePersistenceService {

  private final PlaceRepository repository;
  private final TripSensePlaceProperties properties;
  private volatile long lastFailureTime = 0;

  public PlacePersistenceServiceImpl(
      PlaceRepository repository, TripSensePlaceProperties properties) {
    this.repository = repository;
    this.properties = properties;
  }

  @Override
  public PlaceDto upsertProviderPlace(PlaceDto dto, String defaultProvider) {
    if (dto == null || !StringUtils.hasText(dto.getProviderPlaceId())) {
      throw new IllegalArgumentException("Provider place ID is required for persistence");
    }

    if (System.currentTimeMillis() - lastFailureTime < 30_000) {
      if (!StringUtils.hasText(dto.getId())) {
        dto.setId(dto.getProviderPlaceId());
      }
      return dto;
    }

    try {
      String provider =
          StringUtils.hasText(dto.getProvider()) ? dto.getProvider() : defaultProvider;
      Place entity =
          repository
              .findByProviderAndProviderPlaceId(provider, dto.getProviderPlaceId())
              .orElse(null);
      if (entity == null) {
        Place duplicate = unambiguousDuplicate(dto);
        if (duplicate != null) {
          return toDto(duplicate);
        }
        entity = newPlace(dto, provider);
      }
      applyProviderData(entity, dto);
      return toDto(repository.save(entity));
    } catch (Exception ex) {
      lastFailureTime = System.currentTimeMillis();
      log.warn("Failed to upsert place to MongoDB: {}", ex.getMessage());
      if (!StringUtils.hasText(dto.getId())) {
        dto.setId(dto.getProviderPlaceId());
      }
      return dto;
    }
  }

  private Place unambiguousDuplicate(PlaceDto incoming) {
    if (!StringUtils.hasText(incoming.getName())
        || !StringUtils.hasText(incoming.getAddress())
        || incoming.getLocation() == null) {
      return null;
    }
    List<Place> matches =
        repository.findByNormalizedName(normalize(incoming.getName())).stream()
            .filter(
                existing ->
                    existing.getLocation() != null
                        && StringUtils.hasText(existing.getAddress())
                        && normalize(existing.getAddress()).equals(normalize(incoming.getAddress()))
                        && distanceMeters(
                                existing.getLocation().getY(),
                                existing.getLocation().getX(),
                                incoming.getLocation().getLat(),
                                incoming.getLocation().getLng())
                            <= 100)
            .toList();
    return matches.size() == 1 ? matches.get(0) : null;
  }

  private static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    double lat = Math.toRadians(lat2 - lat1);
    double lon = Math.toRadians(lon2 - lon1);
    double arc =
        Math.sin(lat / 2) * Math.sin(lat / 2)
            + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(lon / 2)
                * Math.sin(lon / 2);
    return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(arc)));
  }

  @Override
  public PlaceDto enrichExistingPlace(Place entity, PlaceDto enrichment) {
    if (System.currentTimeMillis() - lastFailureTime < 30_000) {
      return enrichment;
    }

    try {
      applyProviderData(entity, enrichment);
      return toDto(repository.save(entity));
    } catch (Exception ex) {
      lastFailureTime = System.currentTimeMillis();
      log.warn("Failed to enrich place in MongoDB: {}", ex.getMessage());
      return enrichment;
    }
  }

  @Override
  public PlaceDto toDto(Place place) {
    if (place == null) return null;

    LocationDto location =
        place.getLocation() == null
            ? null
            : LocationDto.builder()
                .lat(place.getLocation().getY())
                .lng(place.getLocation().getX())
                .build();

    List<PlaceReviewDto> reviews =
        place.getReviews() == null
            ? new ArrayList<>()
            : place.getReviews().stream().map(this::toReviewDto).toList();

    PlacePhotoDto primaryPhoto =
        (place.getPhotos() != null && !place.getPhotos().isEmpty())
            ? new PlacePhotoDto(
                place.getPhotos().get(0),
                StringUtils.hasText(place.getProvider()) ? place.getProvider() : "ziomap",
                List.of(),
                place.getLastFetchedAt() != null ? place.getLastFetchedAt() : Instant.now(),
                true)
            : null;

    List<PlacePhotoDto> photoGallery =
        (place.getPhotos() != null && !place.getPhotos().isEmpty())
            ? place.getPhotos().stream()
                .filter(StringUtils::hasText)
                .map(
                    url ->
                        new PlacePhotoDto(
                            url,
                            StringUtils.hasText(place.getProvider())
                                ? place.getProvider()
                                : "ziomap",
                            List.of(),
                            place.getLastFetchedAt() != null
                                ? place.getLastFetchedAt()
                                : Instant.now(),
                            true))
                .toList()
            : List.of();

    return PlaceDto.builder()
        .id(place.getId())
        .provider(place.getProvider())
        .providerPlaceId(place.getProviderPlaceId())
        .name(place.getName())
        .location(location)
        .address(place.getAddress())
        .oldAddress(place.getOldAddress())
        .city(place.getCity())
        .district(place.getDistrict())
        .categories(place.getCategories() == null ? List.of() : place.getCategories())
        .rating(place.getRating())
        .userRatingCount(place.getUserRatingCount())
        .photos(place.getPhotos() == null ? List.of() : place.getPhotos())
        .primaryPhoto(primaryPhoto)
        .photoGallery(photoGallery)
        .phone(place.getPhone())
        .website(place.getWebsite())
        .socials(place.getSocials() == null ? List.of() : place.getSocials())
        .openingHours(place.getOpeningHours())
        .businessStatus(place.getBusinessStatus())
        .description(place.getDescription())
        .source("LOCAL")
        .fetchedAt(place.getLastFetchedAt())
        .freshness(freshness(place.getLastFetchedAt()))
        .reviews(reviews)
        .build();
  }

  private Place newPlace(PlaceDto dto, String provider) {
    return Place.builder()
        .provider(provider)
        .providerPlaceId(dto.getProviderPlaceId())
        .name(dto.getName())
        .normalizedName(normalize(dto.getName()))
        .city(StringUtils.hasText(dto.getCity()) ? dto.getCity() : properties.getDefaultCity())
        .categories(new ArrayList<>())
        .photos(new ArrayList<>())
        .socials(new ArrayList<>())
        .reviews(new ArrayList<>())
        .build();
  }

  private void applyProviderData(Place entity, PlaceDto dto) {
    if (StringUtils.hasText(dto.getName())) {
      entity.setName(dto.getName());
      entity.setNormalizedName(normalize(dto.getName()));
    }
    if (dto.getLocation() != null) {
      entity.setLocation(new GeoJsonPoint(dto.getLocation().getLng(), dto.getLocation().getLat()));
    }
    if (StringUtils.hasText(dto.getAddress())) entity.setAddress(dto.getAddress());
    if (StringUtils.hasText(dto.getOldAddress())) entity.setOldAddress(dto.getOldAddress());
    if (StringUtils.hasText(dto.getCity())) entity.setCity(dto.getCity());
    if (StringUtils.hasText(dto.getDistrict())) entity.setDistrict(dto.getDistrict());
    if (dto.getCategories() != null && !dto.getCategories().isEmpty())
      entity.setCategories(new ArrayList<>(dto.getCategories()));
    if (dto.getRating() != null) entity.setRating(dto.getRating());
    if (dto.getUserRatingCount() != null) entity.setUserRatingCount(dto.getUserRatingCount());
    if (dto.getPhotos() != null && !dto.getPhotos().isEmpty())
      entity.setPhotos(new ArrayList<>(dto.getPhotos()));
    if (StringUtils.hasText(dto.getPhone())) entity.setPhone(dto.getPhone());
    if (StringUtils.hasText(dto.getWebsite())) entity.setWebsite(dto.getWebsite());
    if (dto.getSocials() != null && !dto.getSocials().isEmpty())
      entity.setSocials(new ArrayList<>(dto.getSocials()));
    if (StringUtils.hasText(dto.getOpeningHours())) entity.setOpeningHours(dto.getOpeningHours());
    if (StringUtils.hasText(dto.getBusinessStatus()))
      entity.setBusinessStatus(dto.getBusinessStatus());
    if (StringUtils.hasText(dto.getDescription())) entity.setDescription(dto.getDescription());
    if (dto.getReviews() != null && !dto.getReviews().isEmpty()) {
      entity.setReviews(dto.getReviews().stream().map(this::toReviewEntity).toList());
    }
    entity.setLastFetchedAt(Instant.now());
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private String freshness(Instant fetchedAt) {
    if (fetchedAt == null) return "UNKNOWN";
    return Instant.now().isAfter(fetchedAt.plusSeconds(properties.getCache().getProviderTtlSeconds()))
        ? "STALE"
        : "FRESH";
  }

  private PlaceReview toReviewEntity(PlaceReviewDto review) {
    return PlaceReview.builder()
        .authorName(review.getAuthorName())
        .profilePhotoUrl(review.getProfilePhotoUrl())
        .rating(review.getRating())
        .text(review.getText())
        .relativeTimeDescription(review.getRelativeTimeDescription())
        .time(review.getTime())
        .build();
  }

  private PlaceReviewDto toReviewDto(PlaceReview review) {
    return PlaceReviewDto.builder()
        .authorName(review.getAuthorName())
        .profilePhotoUrl(review.getProfilePhotoUrl())
        .rating(review.getRating())
        .text(review.getText())
        .relativeTimeDescription(review.getRelativeTimeDescription())
        .time(review.getTime())
        .build();
  }
}
