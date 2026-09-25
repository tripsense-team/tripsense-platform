package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import fu.tripsense.socialservice.exception.SocialException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserPublicProfileClient {

  private final RestClient.Builder restClientBuilder;

  @Value("${user-service.url:http://localhost:8081}")
  private String userServiceUrl;

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ApiResponseEnvelope<T>(boolean success, String message, T data) {}

  public record BatchRequest(Collection<UUID> userIds) {}

  public PublicProfileClientResponse requireEnabled(UUID userId, String bearerToken) {
    try {
      ApiResponseEnvelope<PublicProfileClientResponse> response = restClientBuilder.build()
          .get().uri(userServiceUrl + "/api/users/public-profiles/" + userId)
          .headers(headers -> headers.setBearerAuth(bearerToken))
          .retrieve().body(new ParameterizedTypeReference<ApiResponseEnvelope<PublicProfileClientResponse>>() {});
      if (response == null || response.data() == null) {
        throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile lookup unavailable");
      }
      return response.data();
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 404) {
        throw new SocialException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");
      }
      throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile lookup unavailable");
    } catch (SocialException e) {
      throw e;
    } catch (Exception e) {
      throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile lookup unavailable");
    }
  }

  public List<PublicProfileClientResponse> search(String query, int limit, String bearerToken) {
    try {
      String uri = UriComponentsBuilder.fromUriString(userServiceUrl + "/api/users/public-profiles/search")
          .queryParam("query", query).queryParam("limit", limit).build().encode().toUriString();
      ApiResponseEnvelope<List<PublicProfileClientResponse>> response = restClientBuilder.build()
          .get().uri(uri).headers(headers -> headers.setBearerAuth(bearerToken))
          .retrieve().body(new ParameterizedTypeReference<ApiResponseEnvelope<List<PublicProfileClientResponse>>>() {});
      if (response == null || response.data() == null) {
        throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile search unavailable");
      }
      return response.data();
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 400) {
        throw new SocialException(HttpStatus.BAD_REQUEST, "INVALID_QUERY", "Invalid search query");
      }
      throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile search unavailable");
    } catch (SocialException e) {
      throw e;
    } catch (Exception e) {
      throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "PROFILE_UNAVAILABLE", "Profile search unavailable");
    }
  }

  public Map<UUID, PublicProfileClientResponse> fetchPublicProfiles(Collection<UUID> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      ApiResponseEnvelope<List<PublicProfileClientResponse>> response =
          restClientBuilder
              .build()
              .post()
              .uri(userServiceUrl + "/api/users/public-profiles:batch")
              .contentType(MediaType.APPLICATION_JSON)
              .body(new BatchRequest(userIds))
              .retrieve()
              .body(
                  new ParameterizedTypeReference<
                      ApiResponseEnvelope<List<PublicProfileClientResponse>>>() {});

      if (response == null || response.data() == null) {
        return Collections.emptyMap();
      }
      return response.data().stream()
          .filter(p -> p.userId() != null)
          .collect(
              Collectors.toMap(
                  PublicProfileClientResponse::userId, Function.identity(), (a, b) -> a));
    } catch (Exception ex) {
      log.warn("Failed to retrieve public profiles from user-service: {}", ex.getMessage());
      return Collections.emptyMap();
    }
  }
}
