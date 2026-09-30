package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.socialservice.exception.SocialException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@RequiredArgsConstructor
public class PlaceClient {
  private final RestClient.Builder restClientBuilder;

  @Value("${place-service.url:http://localhost:8083}")
  private String placeServiceUrl;

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Envelope(boolean success, PlaceData data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceData(String id, String name) {}

  public void requireCanonical(String placeRef) {
    if (placeRef == null || !placeRef.matches("[A-Za-z0-9._:-]{1,200}")) {
      throw new SocialException(
          HttpStatus.UNPROCESSABLE_ENTITY, "PLACE_NOT_CANONICAL", "Place could not be resolved");
    }
    try {
      Envelope response =
          restClientBuilder
              .build()
              .get()
              .uri(placeServiceUrl + "/api/places/{placeRef}", placeRef)
              .retrieve()
              .body(Envelope.class);
      if (response == null
          || !response.success()
          || response.data() == null
          || !placeRef.equals(response.data().id())) {
        throw new SocialException(
            HttpStatus.UNPROCESSABLE_ENTITY, "PLACE_NOT_CANONICAL", "Place could not be resolved");
      }
    } catch (RestClientResponseException exception) {
      if (exception.getStatusCode().is4xxClientError()) {
        throw new SocialException(
            HttpStatus.UNPROCESSABLE_ENTITY, "PLACE_NOT_CANONICAL", "Place could not be resolved");
      }
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "PLACE_VALIDATION_UNAVAILABLE",
          "Place validation is temporarily unavailable");
    } catch (SocialException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "PLACE_VALIDATION_UNAVAILABLE",
          "Place validation is temporarily unavailable");
    }
  }
}
