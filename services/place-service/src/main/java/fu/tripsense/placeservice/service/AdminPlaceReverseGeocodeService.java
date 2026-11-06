package fu.tripsense.placeservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.providers.mapvina.config.MapVinaProperties;
import java.util.Locale;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class AdminPlaceReverseGeocodeService {
  private static final double MAX_DISTANCE_METERS = 100;
  private static final int MAX_RESPONSE_BYTES = 65536;
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private final RestClient client;
  private final ApiKeyPoolService keyPool;
  private final MapVinaProperties properties;

  public record Result(boolean matched, String address, Double distanceMeters, String source) {}

  public AdminPlaceReverseGeocodeService(
      @Qualifier("mapVinaRestClient") RestClient client,
      ApiKeyPoolService keyPool,
      MapVinaProperties properties) {
    this.client = client;
    this.keyPool = keyPool;
    this.properties = properties;
  }

  public Result lookup(double lat, double lng) {
    if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new PlaceActionException(HttpStatus.BAD_REQUEST, "INVALID_COORDINATES", "Invalid coordinates");
    }
    String activeKey = keyPool.getActiveKey(ApiKeyProvider.MAPVINA);
    String key = activeKey == null && keyPool.listKeys(ApiKeyProvider.MAPVINA).isEmpty()
        ? properties.getApiKey() : activeKey;
    if (key == null || key.isBlank()) {
      throw new PlaceActionException(HttpStatus.SERVICE_UNAVAILABLE, "MAPVINA_UNAVAILABLE", "Address lookup unavailable");
    }
    try {
      JsonNode response = client.get()
          .uri(builder -> builder.path("/api/v2/geocode/json")
              .queryParam("latlng", String.format(Locale.ROOT, "%s,%s", lat, lng))
              .queryParam("result_type", "street_address")
              .queryParam("new_admin", true)
              .queryParam("size", 5)
              .queryParam("radius", 100)
              .queryParam("key", key)
              .build())
          .exchange((request, upstream) -> {
            if (upstream.getStatusCode().value() == 429) {
              throw new PlaceActionException(HttpStatus.TOO_MANY_REQUESTS, "MAPVINA_RATE_LIMITED", "Address lookup rate limited");
            }
            if (!upstream.getStatusCode().is2xxSuccessful()) throw unavailable();
            try {
              byte[] body = upstream.getBody().readNBytes(MAX_RESPONSE_BYTES + 1);
              if (body.length > MAX_RESPONSE_BYTES) throw unavailable();
              return MAPPER.readTree(body);
            } catch (IOException invalidResponse) {
              throw unavailable();
            }
          });
      if (response == null) return noMatch();
      String status = response.path("status").asText();
      if ("ZERO_RESULTS".equals(status)) return noMatch();
      if ("OVER_QUERY_LIMIT".equals(status)) {
        throw new PlaceActionException(HttpStatus.TOO_MANY_REQUESTS, "MAPVINA_RATE_LIMITED", "Address lookup rate limited");
      }
      if (!"OK".equals(status)) throw unavailable();
      JsonNode results = response.path("results");
      if (!results.isArray()) return noMatch();
      Result nearest = noMatch();
      for (JsonNode candidate : results) {
        String address = candidate.path("formatted_address").asText("").trim();
        JsonNode types = candidate.path("types");
        JsonNode location = candidate.path("geometry").path("location");
        JsonNode candidateLat = location.path("lat");
        JsonNode candidateLng = location.path("lng");
        if (address.isEmpty() || address.length() > 500 || candidate.path("partial_match").asBoolean(false) || !types.isArray()
            || !hasStreetAddressType(types) || !candidateLat.isNumber() || !candidateLng.isNumber()) continue;
        double distance = distanceMeters(lat, lng, candidateLat.asDouble(), candidateLng.asDouble());
        if (distance <= MAX_DISTANCE_METERS && (!nearest.matched() || distance < nearest.distanceMeters())) {
          nearest = new Result(true, address, Math.round(distance * 10.0) / 10.0, "MAPVINA");
        }
      }
      return nearest;
    } catch (PlaceActionException expected) {
      throw expected;
    } catch (RestClientException providerFailure) {
      throw unavailable();
    }
  }

  private boolean hasStreetAddressType(JsonNode types) {
    for (JsonNode type : types) if ("street_address".equals(type.asText())) return true;
    return false;
  }

  private double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
    double latDelta = Math.toRadians(lat2 - lat1);
    double lngDelta = Math.toRadians(lng2 - lng1);
    double a = Math.pow(Math.sin(latDelta / 2), 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
        * Math.pow(Math.sin(lngDelta / 2), 2);
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  private Result noMatch() { return new Result(false, null, null, "MAPVINA"); }

  private PlaceActionException unavailable() {
    return new PlaceActionException(HttpStatus.SERVICE_UNAVAILABLE, "MAPVINA_UNAVAILABLE", "Address lookup unavailable");
  }
}
