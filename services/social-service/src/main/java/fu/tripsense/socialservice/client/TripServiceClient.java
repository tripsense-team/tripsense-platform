package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.socialservice.exception.SocialException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
@Slf4j
public class TripServiceClient {

  private final RestClient.Builder restClientBuilder;

  @Value("${trip-service.url:http://localhost:8084}")
  private String tripServiceUrl;

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ApiResponseEnvelope<T>(boolean success, String message, T data) {}

  public TripPublicationClientResponse fetchPublicationSnapshot(UUID tripId, String bearerToken) {
    if (tripId == null) {
      throw new SocialException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "tripId is required");
    }
    try {
      var requestSpec =
          restClientBuilder
              .build()
              .post()
              .uri(tripServiceUrl + "/api/trips/{tripId}/publication-snapshot", tripId);
      if (bearerToken != null && !bearerToken.isBlank()) {
        requestSpec.header(
            "Authorization",
            bearerToken.startsWith("Bearer ") ? bearerToken : "Bearer " + bearerToken);
      }
      ApiResponseEnvelope<TripPublicationClientResponse> response =
          requestSpec
              .retrieve()
              .body(
                  new ParameterizedTypeReference<
                      ApiResponseEnvelope<TripPublicationClientResponse>>() {});
      if (response == null || response.data() == null || response.data().snapshot() == null) {
        throw new SocialException(
            HttpStatus.BAD_GATEWAY,
            "INVALID_TRIP_SNAPSHOT",
            "Trip service returned an invalid public snapshot");
      }
      return response.data();
    } catch (HttpClientErrorException.NotFound ex) {
      throw new SocialException(
          HttpStatus.NOT_FOUND,
          "TRIP_NOT_FOUND",
          "Trip not found or you do not have permission to publish it");
    } catch (HttpClientErrorException.Forbidden ex) {
      throw new SocialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not own this trip");
    } catch (HttpClientErrorException.Unauthorized ex) {
      throw new SocialException(
          HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required");
    } catch (SocialException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error(
          "Failed to retrieve publication snapshot from trip-service for trip {}: {}",
          tripId,
          ex.getMessage());
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "TRIP_SERVICE_UNAVAILABLE",
          "Trip service is currently unavailable");
    }
  }
}
