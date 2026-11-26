package fu.tripsense.tripservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
@Slf4j
public class PlaceClient {

  private static final int MAX_BATCH_IDS = 100;

  private final RestClient.Builder restClientBuilder;

  @Value("${place-service.url:http://place-service:8082}")
  private String placeServiceUrl;

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceApiResponse(boolean success, PlaceApiData data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceBatchApiResponse(boolean success, List<PlaceApiData> data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlacePhotoRef(String url) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceApiData(
      String id,
      String providerPlaceId,
      String name,
      PlaceLocation location,
      String address,
      PlacePhotoRef primaryPhoto,
      List<String> photos,
      List<PlacePhotoRef> photoGallery) {

    public String firstPhotoUrl() {
      if (primaryPhoto != null && isHttpUrl(primaryPhoto.url())) {
        return primaryPhoto.url().trim();
      }
      if (photos != null) {
        for (String photo : photos) {
          if (isHttpUrl(photo)) {
            return photo.trim();
          }
        }
      }
      if (photoGallery != null) {
        for (PlacePhotoRef photo : photoGallery) {
          if (photo != null && isHttpUrl(photo.url())) {
            return photo.url().trim();
          }
        }
      }
      return null;
    }

    private static boolean isHttpUrl(String value) {
      if (value == null) return false;
      String trimmed = value.trim();
      return trimmed.startsWith("https://") || trimmed.startsWith("http://");
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceLocation(BigDecimal lat, BigDecimal lng) {}

  /**
   * Batch-resolves primary photo URLs for canonical place IDs via a single internal call to
   * place-service (chunked at 100 IDs). Never fails the caller if place-service is unavailable.
   */
  public Map<String, String> fetchPlacePhotoUrls(Collection<String> placeIds) {
    if (placeIds == null || placeIds.isEmpty()) {
      return Map.of();
    }
    Set<String> uniqueIds = new LinkedHashSet<>();
    for (String id : placeIds) {
      if (id != null && !id.isBlank()) {
        uniqueIds.add(id.trim());
      }
    }
    if (uniqueIds.isEmpty()) {
      return Map.of();
    }

    List<String> allIds = new ArrayList<>(uniqueIds);
    Map<String, String> photoUrlsById = new LinkedHashMap<>();
    RestClient client = restClientBuilder.build();

    for (int start = 0; start < allIds.size(); start += MAX_BATCH_IDS) {
      List<String> chunk = allIds.subList(start, Math.min(start + MAX_BATCH_IDS, allIds.size()));
      try {
        PlaceBatchApiResponse envelope =
            client
                .post()
                .uri(placeServiceUrl + "/api/places/batch-snapshots?includePhoto=true")
                .contentType(MediaType.APPLICATION_JSON)
                .body(chunk)
                .retrieve()
                .body(PlaceBatchApiResponse.class);
        if (envelope != null && envelope.data() != null) {
          for (PlaceApiData place : envelope.data()) {
            if (place == null || place.id() == null || place.id().isBlank()) continue;
            String photoUrl = place.firstPhotoUrl();
            if (photoUrl != null) {
              photoUrlsById.put(place.id(), photoUrl);
            }
          }
        }
      } catch (Exception ex) {
        log.warn("Failed to batch-resolve place cover photos from place-service: {}", ex.getMessage());
      }
    }
    return photoUrlsById;
  }

  public PlaceSnapshot validatePlace(UUID placeId) {
    return placeId == null ? null : validatePlace(placeId.toString());
  }

  public PlaceSnapshot validatePlace(String placeId) {
    if (placeId == null) {
      return null;
    }

    try {
      PlaceApiResponse envelope =
          restClientBuilder
              .build()
              .get()
              .uri(placeServiceUrl + "/api/places/{placeId}", placeId)
              .retrieve()
              .body(PlaceApiResponse.class);

      if (envelope == null || envelope.data() == null) {
        log.warn("Place not found for placeId: {}", placeId);
        return new PlaceSnapshot(placeId, null, null, null, null);
      }

      PlaceApiData data = envelope.data();
      BigDecimal lat = data.location() != null ? data.location().lat() : null;
      BigDecimal lng = data.location() != null ? data.location().lng() : null;
      return new PlaceSnapshot(placeId, data.name(), data.address(), lat, lng);
    } catch (Exception ex) {
      log.warn(
          "Failed to validate place with place-service: {}. Continuing without snapshot.",
          ex.getMessage());
      return new PlaceSnapshot(placeId, null, null, null, null);
    }
  }

  /** Batch mutations must never persist an unresolved provider or fabricated place ID. */
  public PlaceSnapshot requireCanonicalPlace(String placeId) {
    if (placeId == null || placeId.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.UNPROCESSABLE_ENTITY, "Canonical place ID is required");
    }
    try {
      PlaceApiResponse envelope =
          restClientBuilder
              .build()
              .get()
              .uri(placeServiceUrl + "/api/places/{placeId}", placeId)
              .retrieve()
              .body(PlaceApiResponse.class);
      if (envelope == null
          || !envelope.success()
          || envelope.data() == null
          || !placeId.equals(envelope.data().id())) {
        throw new ResponseStatusException(
            HttpStatus.UNPROCESSABLE_ENTITY, "Canonical place could not be resolved");
      }
      PlaceApiData data = envelope.data();
      return new PlaceSnapshot(
          data.id(),
          data.name(),
          data.address(),
          data.location() == null ? null : data.location().lat(),
          data.location() == null ? null : data.location().lng());
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Place validation unavailable", exception);
    }
  }
}
