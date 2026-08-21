package fu.tripsense.placeservice.providers.ziomap;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapAutocompleteResponse;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapPlaceResult;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapTextSearchPlace;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapTextSearchResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Slf4j
@Component("zioMapProvider")
public class ZioMapProvider implements PlaceProvider, PlaceEnrichmentProvider {

    public static final String PROVIDER_NAME = "ziomap";

    private final ZioMapProperties properties;
    private final RestClient restClient;

    public ZioMapProvider(
            ZioMapProperties properties,
            @Qualifier("zioMapRestClient") RestClient restClient
    ) {
        this.properties = properties;
        this.restClient = restClient;
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public List<PlaceDto> textSearch(String query, Double lat, Double lng, Integer radiusMeters, Integer limit) {
        if (!StringUtils.hasText(query)) {
            return Collections.emptyList();
        }

        try {
            int maxCount = (limit != null && limit > 0) ? Math.min(limit, 20) : 10;

            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromPath("/api/place/text-search")
                    .queryParam("query", query)
                    .queryParam("languageCode", "vi")
                    .queryParam("regionCode", "vn")
                    .queryParam("maxResultCount", maxCount)
                    .queryParam("rankPreference", "RELEVANCE")
                    .queryParam("fieldMask", "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus");

            if (lat != null && lng != null) {
                uriBuilder.queryParam("location", lat + "," + lng);
            }

            if (radiusMeters != null && radiusMeters > 0) {
                uriBuilder.queryParam("radius", String.valueOf(radiusMeters));
            }

            RestClient.RequestHeadersSpec<?> requestSpec = restClient.get()
                    .uri(uriBuilder.build().toUriString());

            if (StringUtils.hasText(properties.getApiKey())) {
                requestSpec.header("x-api-key", properties.getApiKey());
            }

            ZioMapTextSearchResponse response = requestSpec.retrieve()
                    .body(ZioMapTextSearchResponse.class);

            if (response == null || response.getPlaces() == null) {
                return Collections.emptyList();
            }

            List<PlaceDto> results = new ArrayList<>();
            for (ZioMapTextSearchPlace item : response.getPlaces()) {
                PlaceDto dto = mapTextSearchPlaceToDto(item);
                if (dto != null) {
                    results.add(dto);
                }
            }
            return results;
        } catch (Exception ex) {
            log.error("Failed to execute ZioMap text search for query '{}': {}", query, ex.getMessage());
            throw new PlaceProviderException("ZioMap text search is unavailable", ex);
        }
    }

    @Override
    public List<AutocompleteSuggestionDto> autocomplete(String query, Double lat, Double lng, Integer radiusMeters, Integer limit) {
        if (!StringUtils.hasText(query)) {
            return Collections.emptyList();
        }

        try {
            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromPath("/api/place/autocomplete")
                    .queryParam("input", query)
                    .queryParam("language", "vi")
                    .queryParam("region", "vn");

            if (lat != null && lng != null) {
                uriBuilder.queryParam("location", lat + "," + lng);
            }
            if (radiusMeters != null && radiusMeters > 0) {
                uriBuilder.queryParam("radius", String.valueOf(radiusMeters));
            }

            RestClient.RequestHeadersSpec<?> requestSpec = restClient.get()
                    .uri(uriBuilder.build().toUriString());

            if (StringUtils.hasText(properties.getApiKey())) {
                requestSpec.header("x-api-key", properties.getApiKey());
            }

            ZioMapAutocompleteResponse response = requestSpec.retrieve()
                    .body(ZioMapAutocompleteResponse.class);

            if (response == null || response.getPredictions() == null) {
                return Collections.emptyList();
            }

            int maxCount = (limit != null && limit > 0) ? limit : 5;
            List<AutocompleteSuggestionDto> suggestions = new ArrayList<>();

            for (ZioMapAutocompleteResponse.ZioMapAutocompletePrediction pred : response.getPredictions()) {
                if (suggestions.size() >= maxCount) {
                    break;
                }

                String title = pred.getDescription();
                String subtitle = "";

                if (pred.getStructuredFormatting() != null) {
                    if (StringUtils.hasText(pred.getStructuredFormatting().getMainText())) {
                        title = pred.getStructuredFormatting().getMainText();
                    }
                    if (StringUtils.hasText(pred.getStructuredFormatting().getSecondaryText())) {
                        subtitle = pred.getStructuredFormatting().getSecondaryText();
                    }
                }

                String category = (pred.getTypes() != null && !pred.getTypes().isEmpty())
                        ? pred.getTypes().get(0)
                        : "place";

                suggestions.add(AutocompleteSuggestionDto.builder()
                        .id(pred.getPlaceId())
                        .title(title)
                        .subtitle(subtitle)
                        .category(category)
                        .build());
            }

            return suggestions;
        } catch (Exception ex) {
            log.warn("ZioMap autocomplete failed for query '{}' ({}), falling back to textSearch", query, ex.getMessage());
            List<PlaceDto> searchResults = textSearch(query, lat, lng, radiusMeters, limit);
            List<AutocompleteSuggestionDto> suggestions = new ArrayList<>();
            for (PlaceDto p : searchResults) {
                suggestions.add(AutocompleteSuggestionDto.builder()
                        .id(p.getProviderPlaceId() != null ? p.getProviderPlaceId() : p.getId())
                        .title(p.getName())
                        .subtitle(p.getAddress() != null ? p.getAddress() : "")
                        .category(p.getCategories() != null && !p.getCategories().isEmpty() ? p.getCategories().get(0) : "place")
                        .build());
            }
            return suggestions;
        }
    }

    @Override
    public Optional<PlaceDto> getPlaceDetails(String providerPlaceId) {
        if (!StringUtils.hasText(providerPlaceId)) {
            return Optional.empty();
        }

        try {
            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromPath("/api/place/details")
                    .queryParam("place_id", providerPlaceId)
                    .queryParam("language", "vi");

            RestClient.RequestHeadersSpec<?> requestSpec = restClient.get()
                    .uri(uriBuilder.build().toUriString());

            if (StringUtils.hasText(properties.getApiKey())) {
                requestSpec.header("x-api-key", properties.getApiKey());
            }

            ZioMapPlaceResult response = requestSpec.retrieve()
                    .body(ZioMapPlaceResult.class);

            if (response == null || !StringUtils.hasText(response.getPlaceId())) {
                return Optional.empty();
            }

            return Optional.ofNullable(mapPlaceResultToDto(response));
        } catch (Exception ex) {
            log.error("Failed to execute ZioMap place details for id '{}': {}", providerPlaceId, ex.getMessage());
            throw new PlaceProviderException("ZioMap place details are unavailable", ex);
        }
    }

    private PlaceDto mapTextSearchPlaceToDto(ZioMapTextSearchPlace item) {
        if (item == null || !StringUtils.hasText(item.getId())) {
            return null;
        }

        if (item.getDisplayName() == null || !StringUtils.hasText(item.getDisplayName().getText())) {
            return null;
        }
        String name = item.getDisplayName().getText();

        LocationDto location = null;
        if (item.getLocation() != null && item.getLocation().getLatitude() != null && item.getLocation().getLongitude() != null) {
            location = LocationDto.builder()
                    .lat(item.getLocation().getLatitude())
                    .lng(item.getLocation().getLongitude())
                    .build();
        }

        List<String> categories = new ArrayList<>();
        if (StringUtils.hasText(item.getPrimaryType())) {
            categories.add(item.getPrimaryType());
        }
        if (item.getTypes() != null) {
            for (String t : item.getTypes()) {
                if (!categories.contains(t)) {
                    categories.add(t);
                }
            }
        }

        String openingHours = null;
        if (item.getRegularOpeningHours() != null && item.getRegularOpeningHours().getWeekdayDescriptions() != null && !item.getRegularOpeningHours().getWeekdayDescriptions().isEmpty()) {
            openingHours = String.join("; ", item.getRegularOpeningHours().getWeekdayDescriptions());
        }

        List<String> photoUrls = Collections.emptyList();

        if (categories.isEmpty()) {
            categories = inferCategoriesFromName(name);
        }

        return PlaceDto.builder()
                .provider(PROVIDER_NAME)
                .providerPlaceId(item.getId())
                .name(name)
                .location(location)
                .address(item.getFormattedAddress())
                .categories(categories)
                .rating(item.getRating())
                .userRatingCount(item.getUserRatingCount())
                .photos(photoUrls)
                .phone(StringUtils.hasText(item.getInternationalPhoneNumber()) ? item.getInternationalPhoneNumber() : item.getNationalPhoneNumber())
                .website(item.getWebsiteUri())
                .openingHours(openingHours)
                .businessStatus(item.getBusinessStatus())
                .build();
    }

    private List<String> inferCategoriesFromName(String name) {
        String lower = name != null ? name.toLowerCase(Locale.ROOT) : "";
        List<String> list = new ArrayList<>();
        if (lower.contains("cafe") || lower.contains("coffee") || lower.contains("cà phê")) {
            list.add("quán cafe");
            list.add("đồ uống");
        } else if (lower.contains("ốc") || lower.contains("hải sản") || lower.contains("seafood")) {
            list.add("hải sản");
            list.add("quán ốc");
        } else if (lower.contains("nướng") || lower.contains("bbq") || lower.contains("yakiniku") || lower.contains("buffet")) {
            list.add("buffet nướng");
            list.add("nhà hàng");
        } else if (lower.contains("pizza") || lower.contains("pasta") || lower.contains("steak")) {
            list.add("món âu");
            list.add("nhà hàng");
        } else if (lower.contains("bánh") || lower.contains("cuốn") || lower.contains("bún") || lower.contains("mì") || lower.contains("hủ tiếu") || lower.contains("phở")) {
            list.add("đặc sản đà nẵng");
            list.add("ẩm thực truyền thống");
        } else if (lower.contains("cơm") || lower.contains("quán") || lower.contains("nhà hàng")) {
            list.add("ẩm thực việt");
            list.add("nhà hàng");
        } else {
            list.add("ẩm thực đà nẵng");
        }
        return list;
    }

    private PlaceDto mapPlaceResultToDto(ZioMapPlaceResult item) {
        if (item == null || !StringUtils.hasText(item.getPlaceId()) || !StringUtils.hasText(item.getName())) {
            return null;
        }
        LocationDto location = null;
        if (item.getGeometry() != null && item.getGeometry().getLocation() != null) {
            location = LocationDto.builder()
                    .lat(item.getGeometry().getLocation().getLat())
                    .lng(item.getGeometry().getLocation().getLng())
                    .build();
        }

        String openingHours = null;
        if (item.getOpeningHours() != null && item.getOpeningHours().getWeekdayText() != null && !item.getOpeningHours().getWeekdayText().isEmpty()) {
            openingHours = String.join("; ", item.getOpeningHours().getWeekdayText());
        } else if (item.getSecondaryOpeningHours() != null && !item.getSecondaryOpeningHours().isEmpty()) {
            for (ZioMapPlaceResult.OpeningHours oh : item.getSecondaryOpeningHours()) {
                if (oh.getWeekdayText() != null && !oh.getWeekdayText().isEmpty()) {
                    openingHours = String.join("; ", oh.getWeekdayText());
                    break;
                }
            }
        }

        List<String> photoUrls = Collections.emptyList();

        List<String> categories = item.getTypes() != null ? new ArrayList<>(item.getTypes()) : new ArrayList<>();
        if (categories.isEmpty()) {
            categories = inferCategoriesFromName(item.getName());
        }

        Double rating = item.getRating();
        Integer userRatingCount = item.getUserRatingsTotal();

        List<fu.tripsense.placeservice.dto.PlaceReviewDto> reviewDtos = new ArrayList<>();
        if (item.getReviews() != null) {
            for (ZioMapPlaceResult.PlaceReview r : item.getReviews()) {
                reviewDtos.add(fu.tripsense.placeservice.dto.PlaceReviewDto.builder()
                        .authorName(r.getAuthorName())
                        .profilePhotoUrl(r.getProfilePhotoUrl())
                        .rating(r.getRating())
                        .text(r.getText())
                        .relativeTimeDescription(r.getRelativeTimeDescription())
                        .time(r.getTime())
                        .build());
            }
        }

        return PlaceDto.builder()
                .provider(PROVIDER_NAME)
                .providerPlaceId(item.getPlaceId())
                .name(item.getName())
                .location(location)
                .address(item.getFormattedAddress())
                .categories(categories)
                .rating(rating)
                .userRatingCount(userRatingCount)
                .photos(photoUrls)
                .phone(StringUtils.hasText(item.getInternationalPhoneNumber()) ? item.getInternationalPhoneNumber() : item.getFormattedPhoneNumber())
                .website(item.getWebsite())
                .openingHours(openingHours)
                .businessStatus(item.getBusinessStatus())
                .reviews(reviewDtos)
                .build();
    }

    @Override
    public Optional<PlaceDto> enrichPlace(String placeName, Double lat, Double lng) {
        if (!StringUtils.hasText(placeName)) {
            return Optional.empty();
        }
        String cleanName = placeName.trim();
        if (cleanName.contains(",")) {
            String[] parts = cleanName.split(",");
            if (parts.length > 0 && StringUtils.hasText(parts[0])) {
                cleanName = parts[0].trim();
            }
        }
        String query = cleanName.toLowerCase().contains("đà nẵng") || cleanName.toLowerCase().contains("da nang")
                ? cleanName
                : cleanName + " Đà Nẵng";

        List<PlaceDto> places = textSearch(query, lat, lng, 5000, 1);
        if (!places.isEmpty()) {
            PlaceDto matched = places.get(0);
            String zioPlaceId = matched.getProviderPlaceId();
            if (StringUtils.hasText(zioPlaceId)) {
                Optional<PlaceDto> details = getPlaceDetails(zioPlaceId);
                if (details.isPresent()) {
                    return details;
                }
            }
            return Optional.of(matched);
        }
        return Optional.empty();
    }

}
