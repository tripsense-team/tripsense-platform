package fu.tripsense.placeservice.providers.ziomap;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapAutocompleteResponse;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapPhotoDetailsResponse;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapPhotoResponse;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapPlaceResult;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapTextSearchPlace;
import fu.tripsense.placeservice.providers.ziomap.dto.ZioMapTextSearchResponse;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import fu.tripsense.placeservice.service.VietnameseAdministrativeAreaNormalizer;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Component("zioMapProvider")
public class ZioMapProvider implements PlaceProvider, PlaceEnrichmentProvider {

  public static final String PROVIDER_NAME = "ziomap";
  private final ZioMapProperties properties;
  private final RestClient restClient;
  private final ApiKeyPoolService apiKeyPoolService;

  private volatile boolean lastCallQuotaExceeded = false;
  private volatile String lastQuotaErrorMessage = "";
  private final ExecutorService photoExecutor =
      Executors.newFixedThreadPool(8, new CustomizableThreadFactory("ziomap-photo-"));

  @Autowired
  public ZioMapProvider(
      ZioMapProperties properties,
      @Qualifier("zioMapRestClient") RestClient restClient,
      @Autowired(required = false) ApiKeyPoolService apiKeyPoolService) {
    this.properties = properties;
    this.restClient = restClient;
    this.apiKeyPoolService = apiKeyPoolService;
  }

  public ZioMapProvider(ZioMapProperties properties, RestClient restClient) {
    this(properties, restClient, null);
  }

  @PreDestroy
  public void destroy() {
    photoExecutor.shutdown();
    try {
      if (!photoExecutor.awaitTermination(3, TimeUnit.SECONDS)) {
        photoExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      photoExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  public String getEffectiveApiKey() {
    if (apiKeyPoolService != null) {
      String key = apiKeyPoolService.getActiveKey(ApiKeyProvider.ZIOMAP);
      if (StringUtils.hasText(key)) return key;
    }
    return properties.getApiKey();
  }

  private boolean handleQuotaErrorAndRotate(Exception ex) {
    if (isQuotaOrAuthError(ex)) {
      if (apiKeyPoolService != null) {
        String failedKey = getEffectiveApiKey();
        java.util.Optional<ApiKeyPoolItem> nextKey =
            apiKeyPoolService.markExhaustedAndRotate(
                ApiKeyProvider.ZIOMAP, failedKey, ex.getMessage());
        if (nextKey.isPresent()) {
          properties.setApiKey(nextKey.get().getRawKey());
          lastCallQuotaExceeded = false;
          log.info(
              "[ZioMapProvider] Key exhausted. Auto-rotated to next key: {}",
              nextKey.get().getMaskedKey());
          return true;
        }
      }
      lastCallQuotaExceeded = true;
      lastQuotaErrorMessage = "ZioMap API báo lỗi hết token/quota: " + ex.getMessage();
      log.error("ZioMap quota exceeded or all keys in pool exhausted: {}", ex.getMessage());
    }
    return false;
  }

  private void recordSuccess() {
    if (apiKeyPoolService != null) {
      apiKeyPoolService.recordSuccess(ApiKeyProvider.ZIOMAP, getEffectiveApiKey());
    }
  }

  @Override
  public String getProviderName() {
    return PROVIDER_NAME;
  }

  @Override
  public List<PlaceDto> textSearch(
      String query, Double lat, Double lng, Integer radiusMeters, Integer limit) {
    if (!StringUtils.hasText(query)) {
      return Collections.emptyList();
    }

    try {
      int maxCount = (limit != null && limit > 0) ? Math.min(limit, 20) : 10;

      UriComponentsBuilder uriBuilder =
          UriComponentsBuilder.fromPath("/api/place/text-search")
              .queryParam("query", query)
              .queryParam("languageCode", "vi")
              .queryParam("regionCode", "vn")
              .queryParam("maxResultCount", maxCount)
              .queryParam("rankPreference", "RELEVANCE")
              .queryParam(
                  "fieldMask",
                  "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.types,places.primaryType");

      if (lat != null && lng != null) {
        uriBuilder.queryParam("location", lat + "," + lng);
      }

      if (radiusMeters != null && radiusMeters > 0) {
        uriBuilder.queryParam("radius", String.valueOf(radiusMeters));
      }

      RestClient.RequestHeadersSpec<?> requestSpec =
          restClient.get().uri(uriBuilder.build().toUriString());

      String effectiveKey = getEffectiveApiKey();
      if (StringUtils.hasText(effectiveKey)) {
        requestSpec.header("x-api-key", effectiveKey);
      }

      ZioMapTextSearchResponse response =
          requestSpec.retrieve().body(ZioMapTextSearchResponse.class);

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
      recordSuccess();
      return results;
    } catch (Exception ex) {
      if (handleQuotaErrorAndRotate(ex)) {
        log.info("[ZioMapProvider] Key exhausted during textSearch. Auto-rotated to next key");
      }
      log.error("Failed to execute ZioMap text search for query '{}': {}", query, ex.getMessage());
      throw new PlaceProviderException("ZioMap text search is unavailable", ex);
    }
  }

  @Override
  public List<AutocompleteSuggestionDto> autocomplete(
      String query, Double lat, Double lng, Integer radiusMeters, Integer limit) {
    if (!StringUtils.hasText(query)) {
      return Collections.emptyList();
    }

    try {
      UriComponentsBuilder uriBuilder =
          UriComponentsBuilder.fromPath("/api/place/autocomplete")
              .queryParam("input", query)
              .queryParam("language", "vi")
              .queryParam("region", "vn");

      if (lat != null && lng != null) {
        uriBuilder.queryParam("location", lat + "," + lng);
      }
      if (radiusMeters != null && radiusMeters > 0) {
        uriBuilder.queryParam("radius", String.valueOf(radiusMeters));
      }

      RestClient.RequestHeadersSpec<?> requestSpec =
          restClient.get().uri(uriBuilder.build().toUriString());

      String effectiveKey = getEffectiveApiKey();
      if (StringUtils.hasText(effectiveKey)) {
        requestSpec.header("x-api-key", effectiveKey);
      }

      ZioMapAutocompleteResponse response =
          requestSpec.retrieve().body(ZioMapAutocompleteResponse.class);

      if (response == null || response.getPredictions() == null) {
        return Collections.emptyList();
      }

      int maxCount = (limit != null && limit > 0) ? limit : 5;
      List<AutocompleteSuggestionDto> suggestions = new ArrayList<>();

      for (ZioMapAutocompleteResponse.ZioMapAutocompletePrediction pred :
          response.getPredictions()) {
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

        String category =
            (pred.getTypes() != null && !pred.getTypes().isEmpty())
                ? pred.getTypes().get(0)
                : "place";

        suggestions.add(
            AutocompleteSuggestionDto.builder()
                .id(pred.getPlaceId())
                .title(title)
                .subtitle(subtitle)
                .category(category)
                .build());
      }

      return suggestions;
    } catch (Exception ex) {
      log.warn(
          "ZioMap autocomplete failed for query '{}' ({}), falling back to textSearch",
          query,
          ex.getMessage());
      List<PlaceDto> searchResults = textSearch(query, lat, lng, radiusMeters, limit);
      List<AutocompleteSuggestionDto> suggestions = new ArrayList<>();
      for (PlaceDto p : searchResults) {
        suggestions.add(
            AutocompleteSuggestionDto.builder()
                .id(p.getProviderPlaceId() != null ? p.getProviderPlaceId() : p.getId())
                .title(p.getName())
                .subtitle(p.getAddress() != null ? p.getAddress() : "")
                .category(
                    p.getCategories() != null && !p.getCategories().isEmpty()
                        ? p.getCategories().get(0)
                        : "place")
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
    return fetchPlaceDetailsWithRetry(providerPlaceId, 0);
  }

  private Optional<PlaceDto> fetchPlaceDetailsWithRetry(String providerPlaceId, int retryCount) {
    try {
      UriComponentsBuilder uriBuilder =
          UriComponentsBuilder.fromPath("/api/place/details")
              .queryParam("place_id", providerPlaceId)
              .queryParam("language", "vi");

      RestClient.RequestHeadersSpec<?> requestSpec =
          restClient.get().uri(uriBuilder.build().toUriString());

      String apiKey = getEffectiveApiKey();
      if (StringUtils.hasText(apiKey)) {
        requestSpec.header("x-api-key", apiKey);
      }

      ZioMapPlaceResult response = requestSpec.retrieve().body(ZioMapPlaceResult.class);

      if (response == null || !StringUtils.hasText(response.getPlaceId())) {
        return Optional.empty();
      }

      recordSuccess();
      return Optional.ofNullable(mapPlaceResultToDto(response));
    } catch (Exception ex) {
      if (retryCount < 2 && handleQuotaErrorAndRotate(ex)) {
        log.info(
            "[ZioMapProvider] Retrying place details for '{}' with newly rotated key",
            providerPlaceId);
        return fetchPlaceDetailsWithRetry(providerPlaceId, retryCount + 1);
      }
      log.error(
          "Failed to execute ZioMap place details for id '{}': {}",
          providerPlaceId,
          ex.getMessage());
      throw new PlaceProviderException("ZioMap place details are unavailable", ex);
    }
  }

  @Override
  public Optional<PlacePhotoDto> getPrimaryPhoto(String providerPlaceId) {
    return getPhotoGallery(providerPlaceId, 1).stream().findFirst();
  }

  @Override
  public List<PlacePhotoDto> getPhotoGallery(String providerPlaceId, int limit) {
    String effectiveKey = getEffectiveApiKey();
    if (!properties.isPhotoDisplayApproved()
        || !StringUtils.hasText(effectiveKey)
        || providerPlaceId == null
        || !providerPlaceId.matches("[A-Za-z0-9._:-]{1,200}")
        || limit <= 0) {
      return List.of();
    }
    try {
      String detailsUri =
          UriComponentsBuilder.fromPath("/api/v1/places/{id}")
              .queryParam("fields", "photos")
              .buildAndExpand(providerPlaceId)
              .encode()
              .toUriString();
      ZioMapPhotoDetailsResponse details =
          restClient
              .get()
              .uri(detailsUri)
              .header("x-api-key", effectiveKey)
              .retrieve()
              .body(ZioMapPhotoDetailsResponse.class);
      if (details == null || details.photos() == null || details.photos().isEmpty()) {
        return List.of();
      }
      List<ZioMapPhotoDetailsResponse.Photo> candidatePhotos = new ArrayList<>();
      Set<String> seenNames = new HashSet<>();
      for (ZioMapPhotoDetailsResponse.Photo photo : details.photos()) {
        if (candidatePhotos.size() >= Math.min(limit, 5)) {
          break;
        }
        if (photo == null
            || photo.name() == null
            || !photo.name().startsWith("places/" + providerPlaceId + "/photos/")
            || !seenNames.add(photo.name())) {
          continue;
        }
        candidatePhotos.add(photo);
      }

      if (candidatePhotos.isEmpty()) {
        return List.of();
      }

      List<CompletableFuture<Optional<PlacePhotoDto>>> futures =
          candidatePhotos.stream()
              .map(
                  photo ->
                      CompletableFuture.supplyAsync(() -> fetchSinglePhoto(photo), photoExecutor))
              .toList();

      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

      List<PlacePhotoDto> gallery = new ArrayList<>();
      Set<String> seenUrls = new HashSet<>();
      for (CompletableFuture<Optional<PlacePhotoDto>> future : futures) {
        try {
          Optional<PlacePhotoDto> opt = future.join();
          if (opt.isPresent() && seenUrls.add(opt.get().url())) {
            gallery.add(opt.get());
          }
        } catch (Exception ex) {
          log.debug("ZioMap gallery image future completed exceptionally: {}", ex.getMessage());
        }
      }
      recordSuccess();
      return List.copyOf(gallery);
    } catch (Exception ex) {
      if (handleQuotaErrorAndRotate(ex)) {
        return getPhotoGallery(providerPlaceId, limit);
      }
      log.warn("ZioMap photo unavailable for place; type={}", ex.getClass().getSimpleName());
      return List.of();
    }
  }

  private Optional<PlacePhotoDto> fetchSinglePhoto(ZioMapPhotoDetailsResponse.Photo photo) {
    try {
      String photoUri =
          UriComponentsBuilder.fromPath("/api/place/photos")
              .queryParam("name", photo.name())
              .queryParam(
                  "maxWidthPx", Math.max(1, Math.min(1200, properties.getPhotoMaxWidthPx())))
              .build()
              .encode()
              .toUriString();
      ZioMapPhotoResponse response =
          restClient
              .get()
              .uri(photoUri)
              .header("x-api-key", getEffectiveApiKey())
              .retrieve()
              .body(ZioMapPhotoResponse.class);
      if (response == null || !safePhotoUrl(response.photoUri())) {
        return Optional.empty();
      }
      List<PlacePhotoDto.Attribution> attribution =
          photo.authorAttributions() == null
              ? List.of()
              : photo.authorAttributions().stream()
                  .filter(item -> item != null && StringUtils.hasText(item.displayName()))
                  .limit(4)
                  .map(
                      item ->
                          new PlacePhotoDto.Attribution(
                              item.displayName(),
                              safeAttributionUrl(item.uri()) ? item.uri() : null))
                  .toList();
      return Optional.of(
          new PlacePhotoDto(response.photoUri(), PROVIDER_NAME, attribution, Instant.now(), true));
    } catch (Exception ex) {
      log.debug("One ZioMap gallery image unavailable; type={}", ex.getClass().getSimpleName());
      return Optional.empty();
    }
  }

  private boolean safePhotoUrl(String value) {
    if (!StringUtils.hasText(value) || value.length() > 2048) {
      return false;
    }
    try {
      URI uri = URI.create(value);
      if (!"https".equalsIgnoreCase(uri.getScheme())
          || uri.getUserInfo() != null
          || uri.getHost() == null) {
        return false;
      }
      String query = uri.getRawQuery();
      if (query != null) {
        for (String parameter : query.split("&")) {
          String name = parameter.split("=", 2)[0];
          if (name.matches("(?i)key|api_key|token|secret")) {
            return false;
          }
        }
      }
      String host = uri.getHost().toLowerCase(Locale.ROOT);
      for (String allowed : properties.getPhotoAllowedHosts().split(",")) {
        if (host.equals(allowed.trim().toLowerCase(Locale.ROOT))) {
          return true;
        }
      }
      return false;
    } catch (IllegalArgumentException ex) {
      return false;
    }
  }

  private boolean safeAttributionUrl(String value) {
    if (!StringUtils.hasText(value) || value.length() > 2048) {
      return false;
    }
    try {
      URI uri = URI.create(value);
      return "https".equalsIgnoreCase(uri.getScheme())
          && uri.getHost() != null
          && uri.getUserInfo() == null;
    } catch (IllegalArgumentException ex) {
      return false;
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
    if (item.getLocation() != null
        && item.getLocation().getLatitude() != null
        && item.getLocation().getLongitude() != null) {
      location =
          LocationDto.builder()
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
    if (item.getRegularOpeningHours() != null
        && item.getRegularOpeningHours().getWeekdayDescriptions() != null
        && !item.getRegularOpeningHours().getWeekdayDescriptions().isEmpty()) {
      openingHours = String.join("; ", item.getRegularOpeningHours().getWeekdayDescriptions());
    }

    List<String> photoUrls = Collections.emptyList();

    if (categories.isEmpty()) {
      categories = inferCategoriesFromName(name);
    }

    String district =
        VietnameseAdministrativeAreaNormalizer.district(
            textSearchComponent(item, "administrative_area_level_2"), item.getFormattedAddress());
    String city =
        VietnameseAdministrativeAreaNormalizer.city(
            firstNonBlank(
                textSearchComponent(item, "locality"),
                textSearchComponent(item, "administrative_area_level_1")),
            item.getFormattedAddress());

    return PlaceDto.builder()
        .id(item.getId())
        .provider(PROVIDER_NAME)
        .providerPlaceId(item.getId())
        .name(name)
        .location(location)
        .address(item.getFormattedAddress())
        .city(city)
        .district(district)
        .categories(categories)
        .rating(item.getRating())
        .userRatingCount(item.getUserRatingCount())
        .photos(photoUrls)
        .phone(
            StringUtils.hasText(item.getInternationalPhoneNumber())
                ? item.getInternationalPhoneNumber()
                : item.getNationalPhoneNumber())
        .website(item.getWebsiteUri())
        .openingHours(openingHours)
        .businessStatus(item.getBusinessStatus())
        .build();
  }

  private List<String> inferCategoriesFromName(String name) {
    String lower = name != null ? name.toLowerCase(Locale.ROOT) : "";
    List<String> list = new ArrayList<>();
    if (lower.contains("nha khoa")
        || lower.contains("dental")
        || lower.contains("răng")
        || lower.contains("niềng")) {
      list.add("nha khoa");
      list.add("y tế");
    } else if (lower.contains("bệnh viện")
        || lower.contains("phòng khám")
        || lower.contains("clinic")
        || lower.contains("y tế")
        || lower.contains("dược")
        || lower.contains("nhà thuốc")) {
      list.add("y tế");
      list.add("phòng khám");
    } else if (lower.contains("hotel")
        || lower.contains("khách sạn")
        || lower.contains("resort")
        || lower.contains("homestay")
        || lower.contains("villa")
        || lower.contains("hostel")) {
      list.add("khách sạn");
      list.add("lưu trú");
    } else if (lower.contains("cafe")
        || lower.contains("coffee")
        || lower.contains("cà phê")
        || lower.contains("tea")
        || lower.contains("trà sữa")) {
      list.add("quán cafe");
      list.add("đồ uống");
    } else if (lower.contains("ốc") || lower.contains("hải sản") || lower.contains("seafood")) {
      list.add("hải sản");
      list.add("quán ốc");
    } else if (lower.contains("nướng")
        || lower.contains("bbq")
        || lower.contains("yakiniku")
        || lower.contains("buffet")) {
      list.add("buffet nướng");
      list.add("nhà hàng");
    } else if (lower.contains("pizza") || lower.contains("pasta") || lower.contains("steak")) {
      list.add("món âu");
      list.add("nhà hàng");
    } else if (lower.contains("bánh")
        || lower.contains("cuốn")
        || lower.contains("bún")
        || lower.contains("mì")
        || lower.contains("hủ tiếu")
        || lower.contains("phở")) {
      list.add("đặc sản đà nẵng");
      list.add("ẩm thực truyền thống");
    } else if (lower.contains("cơm")
        || lower.contains("quán")
        || lower.contains("nhà hàng")
        || lower.contains("ẩm thực")) {
      list.add("ẩm thực việt");
      list.add("nhà hàng");
    } else if (lower.contains("chợ")
        || lower.contains("siêu thị")
        || lower.contains("mall")
        || lower.contains("shop")
        || lower.contains("store")
        || lower.contains("plaza")) {
      list.add("mua sắm");
      list.add("trung tâm thương mại");
    } else if (lower.contains("du lịch")
        || lower.contains("tour")
        || lower.contains("bà nà")
        || lower.contains("bana")
        || lower.contains("chùa")
        || lower.contains("đền")
        || lower.contains("cầu")
        || lower.contains("bãi biển")
        || lower.contains("núi")) {
      list.add("điểm tham quan");
      list.add("du lịch");
    } else {
      list.add("địa điểm khám phá");
    }
    return list;
  }

  private PlaceDto mapPlaceResultToDto(ZioMapPlaceResult item) {
    if (item == null
        || !StringUtils.hasText(item.getPlaceId())
        || !StringUtils.hasText(item.getName())) {
      return null;
    }
    LocationDto location = null;
    if (item.getGeometry() != null && item.getGeometry().getLocation() != null) {
      location =
          LocationDto.builder()
              .lat(item.getGeometry().getLocation().getLat())
              .lng(item.getGeometry().getLocation().getLng())
              .build();
    }

    String openingHours = null;
    if (item.getOpeningHours() != null
        && item.getOpeningHours().getWeekdayText() != null
        && !item.getOpeningHours().getWeekdayText().isEmpty()) {
      openingHours = String.join("; ", item.getOpeningHours().getWeekdayText());
    } else if (item.getSecondaryOpeningHours() != null
        && !item.getSecondaryOpeningHours().isEmpty()) {
      for (ZioMapPlaceResult.OpeningHours oh : item.getSecondaryOpeningHours()) {
        if (oh.getWeekdayText() != null && !oh.getWeekdayText().isEmpty()) {
          openingHours = String.join("; ", oh.getWeekdayText());
          break;
        }
      }
    }

    List<String> photoUrls = Collections.emptyList();

    List<String> categories =
        item.getTypes() != null ? new ArrayList<>(item.getTypes()) : new ArrayList<>();
    if (categories.isEmpty()) {
      categories = inferCategoriesFromName(item.getName());
    }

    Double rating = item.getRating();
    Integer userRatingCount = item.getUserRatingsTotal();

    List<fu.tripsense.placeservice.dto.PlaceReviewDto> reviewDtos = new ArrayList<>();
    if (item.getReviews() != null) {
      for (ZioMapPlaceResult.PlaceReview r : item.getReviews()) {
        reviewDtos.add(
            fu.tripsense.placeservice.dto.PlaceReviewDto.builder()
                .authorName(r.getAuthorName())
                .profilePhotoUrl(r.getProfilePhotoUrl())
                .rating(r.getRating())
                .text(r.getText())
                .relativeTimeDescription(r.getRelativeTimeDescription())
                .time(r.getTime())
                .build());
      }
    }

    String district =
        VietnameseAdministrativeAreaNormalizer.district(
            detailsComponent(item, "administrative_area_level_2"), item.getFormattedAddress());
    String city =
        VietnameseAdministrativeAreaNormalizer.city(
            firstNonBlank(
                detailsComponent(item, "locality"),
                detailsComponent(item, "administrative_area_level_1")),
            item.getFormattedAddress());

    return PlaceDto.builder()
        .id(item.getPlaceId())
        .provider(PROVIDER_NAME)
        .providerPlaceId(item.getPlaceId())
        .name(item.getName())
        .location(location)
        .address(item.getFormattedAddress())
        .city(city)
        .district(district)
        .categories(categories)
        .rating(rating)
        .userRatingCount(userRatingCount)
        .photos(photoUrls)
        .phone(
            StringUtils.hasText(item.getInternationalPhoneNumber())
                ? item.getInternationalPhoneNumber()
                : item.getFormattedPhoneNumber())
        .website(item.getWebsite())
        .openingHours(openingHours)
        .businessStatus(item.getBusinessStatus())
        .reviews(reviewDtos)
        .build();
  }

  private String textSearchComponent(ZioMapTextSearchPlace item, String type) {
    if (item.getAddressComponents() == null) return null;
    return item.getAddressComponents().stream()
        .filter(component -> component != null && component.getTypes() != null)
        .filter(component -> component.getTypes().contains(type))
        .map(component -> firstNonBlank(component.getLongText(), component.getShortText()))
        .filter(StringUtils::hasText)
        .findFirst()
        .orElse(null);
  }

  private String detailsComponent(ZioMapPlaceResult item, String type) {
    if (item.getAddressComponents() == null) return null;
    return item.getAddressComponents().stream()
        .filter(component -> component != null && component.getTypes() != null)
        .filter(component -> component.getTypes().contains(type))
        .map(component -> firstNonBlank(component.getLongName(), component.getShortName()))
        .filter(StringUtils::hasText)
        .findFirst()
        .orElse(null);
  }

  private String firstNonBlank(String first, String second) {
    return StringUtils.hasText(first) ? first : second;
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
    String query =
        cleanName.toLowerCase().contains("đà nẵng") || cleanName.toLowerCase().contains("da nang")
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

  public boolean validateAndApplyApiKey(String newApiKey) {
    if (!StringUtils.hasText(newApiKey)) {
      return false;
    }
    String trimmed = newApiKey.trim();
    try {
      UriComponentsBuilder uriBuilder =
          UriComponentsBuilder.fromPath("/api/place/autocomplete")
              .queryParam("input", "test")
              .queryParam("language", "vi")
              .queryParam("region", "vn");

      RestClient.RequestHeadersSpec<?> requestSpec =
          restClient.get().uri(uriBuilder.build().toUriString());
      requestSpec.header("x-api-key", trimmed);

      var response = requestSpec.retrieve().toBodilessEntity();
      if (response.getStatusCode().is2xxSuccessful()) {
        properties.setApiKey(trimmed);
        properties.setPhotoDisplayApproved(true);
        lastCallQuotaExceeded = false;
        lastQuotaErrorMessage = "";
        if (apiKeyPoolService != null) {
          apiKeyPoolService.addKeys(ApiKeyProvider.ZIOMAP, List.of(trimmed));
        }
        log.info("ZioMap API key updated and verified successfully");
        return true;
      }
      return false;
    } catch (Exception ex) {
      log.warn("Failed to validate ZioMap API key: {}", ex.getMessage());
      return false;
    }
  }

  public boolean isLastCallQuotaExceeded() {
    return lastCallQuotaExceeded;
  }

  public String getLastQuotaErrorMessage() {
    return lastQuotaErrorMessage;
  }

  public void clearQuotaExceeded() {
    lastCallQuotaExceeded = false;
    lastQuotaErrorMessage = "";
  }

  private boolean isQuotaOrAuthError(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof org.springframework.web.client.RestClientResponseException restEx) {
        int status = restEx.getStatusCode().value();
        if (status == 401 || status == 402 || status == 403 || status == 429) {
          return true;
        }
      }
      String msg = current.getMessage();
      if (msg != null) {
        String lower = msg.toLowerCase();
        if (lower.contains("401")
            || lower.contains("402")
            || lower.contains("403")
            || lower.contains("429")
            || lower.contains("quota")
            || lower.contains("unauthorized")
            || lower.contains("payment required")
            || lower.contains("too many requests")
            || lower.contains("rate limit")
            || lower.contains("credit")) {
          return true;
        }
      }
      current = current.getCause();
    }
    return false;
  }

  public String getMaskedApiKey() {
    String key = getEffectiveApiKey();
    if (!StringUtils.hasText(key)) {
      return "";
    }
    String trimmed = key.trim();
    if (trimmed.length() <= 12) {
      return "***";
    }
    return trimmed.substring(0, 8) + "..." + trimmed.substring(trimmed.length() - 4);
  }

  public boolean isApiKeyConfigured() {
    return StringUtils.hasText(getEffectiveApiKey());
  }
}
