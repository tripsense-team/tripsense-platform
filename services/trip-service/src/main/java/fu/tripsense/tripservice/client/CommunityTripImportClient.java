package fu.tripsense.tripservice.client;

import fu.tripsense.tripservice.exception.TripServiceException;
import java.util.UUID;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Component
public class CommunityTripImportClient {
  private final RestClient client;
  private final String internalKey;

  public CommunityTripImportClient(
      RestClient.Builder builder,
      @Value("${social-service.url:http://localhost:8086}") String socialServiceUrl,
      @Value("${social-service.import-internal-key:}") String internalKey,
      @Value("${social-service.connect-timeout:2s}") Duration connectTimeout,
      @Value("${social-service.read-timeout:5s}") Duration readTimeout) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(connectTimeout);
    factory.setReadTimeout(readTimeout);
    this.client = builder.baseUrl(socialServiceUrl).requestFactory(factory).build();
    this.internalKey = internalKey;
  }

  public CommunityTripImportProjection fetch(UUID postId, String bearerToken) {
    try {
      return client
          .get()
          .uri("/internal/community/trip-shares/{postId}/import-projection", postId)
          .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
          .header("X-TripSense-Service-Auth", internalKey)
          .retrieve()
          .body(CommunityTripImportProjection.class);
    } catch (HttpClientErrorException.NotFound exception) {
      throw new TripServiceException("SHARE_NOT_FOUND", "Shared trip was not found", HttpStatus.NOT_FOUND);
    } catch (HttpClientErrorException.Conflict exception) {
      throw new TripServiceException(
          "SHARE_REPUBLISH_REQUIRED",
          "Shared trip must be republished before import",
          HttpStatus.CONFLICT);
    } catch (HttpClientErrorException.UnprocessableEntity exception) {
      throw new TripServiceException(
          "SHARE_NOT_IMPORTABLE",
          "Shared trip cannot be imported",
          HttpStatus.UNPROCESSABLE_ENTITY);
    } catch (HttpClientErrorException.TooManyRequests exception) {
      throw new TripServiceException(
          "RATE_LIMITED", "Too many import requests", HttpStatus.TOO_MANY_REQUESTS);
    } catch (HttpClientErrorException.Unauthorized exception) {
      throw new TripServiceException(
          "COMMUNITY_SHARE_UNAVAILABLE",
          "Community import is temporarily unavailable",
          HttpStatus.SERVICE_UNAVAILABLE);
    } catch (RestClientException exception) {
      throw new TripServiceException(
          "COMMUNITY_SHARE_UNAVAILABLE",
          "Community import is temporarily unavailable",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
