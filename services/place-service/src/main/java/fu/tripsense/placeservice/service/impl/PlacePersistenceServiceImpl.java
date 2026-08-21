package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceReview;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceReviewDto;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class PlacePersistenceServiceImpl implements PlacePersistenceService {

    private final PlaceRepository repository;
    private final TripSensePlaceProperties properties;

    public PlacePersistenceServiceImpl(PlaceRepository repository, TripSensePlaceProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    @Override
    public PlaceDto upsertProviderPlace(PlaceDto dto, String defaultProvider) {
        if (dto == null || !StringUtils.hasText(dto.getProviderPlaceId())) {
            throw new IllegalArgumentException("Provider place ID is required for persistence");
        }

        String provider = StringUtils.hasText(dto.getProvider()) ? dto.getProvider() : defaultProvider;
        Place entity = repository.findByProviderAndProviderPlaceId(provider, dto.getProviderPlaceId())
                .orElseGet(() -> newPlace(dto, provider));
        applyProviderData(entity, dto);
        return toDto(repository.save(entity));
    }

    @Override
    public PlaceDto enrichExistingPlace(Place entity, PlaceDto enrichment) {
        applyProviderData(entity, enrichment);
        return toDto(repository.save(entity));
    }

    @Override
    public PlaceDto toDto(Place place) {
        if (place == null) return null;

        LocationDto location = place.getLocation() == null
                ? null
                : LocationDto.builder()
                .lat(place.getLocation().getY())
                .lng(place.getLocation().getX())
                .build();

        List<PlaceReviewDto> reviews = place.getReviews() == null
                ? new ArrayList<>()
                : place.getReviews().stream().map(this::toReviewDto).toList();

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
                .phone(place.getPhone())
                .website(place.getWebsite())
                .socials(place.getSocials() == null ? List.of() : place.getSocials())
                .openingHours(place.getOpeningHours())
                .businessStatus(place.getBusinessStatus())
                .description(place.getDescription())
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
        if (dto.getCategories() != null && !dto.getCategories().isEmpty()) entity.setCategories(new ArrayList<>(dto.getCategories()));
        if (dto.getRating() != null) entity.setRating(dto.getRating());
        if (dto.getUserRatingCount() != null) entity.setUserRatingCount(dto.getUserRatingCount());
        if (dto.getPhotos() != null && !dto.getPhotos().isEmpty()) entity.setPhotos(new ArrayList<>(dto.getPhotos()));
        if (StringUtils.hasText(dto.getPhone())) entity.setPhone(dto.getPhone());
        if (StringUtils.hasText(dto.getWebsite())) entity.setWebsite(dto.getWebsite());
        if (dto.getSocials() != null && !dto.getSocials().isEmpty()) entity.setSocials(new ArrayList<>(dto.getSocials()));
        if (StringUtils.hasText(dto.getOpeningHours())) entity.setOpeningHours(dto.getOpeningHours());
        if (StringUtils.hasText(dto.getBusinessStatus())) entity.setBusinessStatus(dto.getBusinessStatus());
        if (StringUtils.hasText(dto.getDescription())) entity.setDescription(dto.getDescription());
        if (dto.getReviews() != null && !dto.getReviews().isEmpty()) {
            entity.setReviews(dto.getReviews().stream().map(this::toReviewEntity).toList());
        }
        entity.setLastFetchedAt(Instant.now());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
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
