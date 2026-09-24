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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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
