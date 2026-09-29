package fu.tripsense.tripservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
@Slf4j
public class SocialServiceClient {

  private final RestClient.Builder restClientBuilder;

  @Value("${social-service.url:http://localhost:8086}")
  private String socialServiceUrl;

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record CommunityGuidePromotionAck(UUID postId, Long appliedVersion, String deliveryState) {}

  public CommunityGuidePromotionAck syncGuidePromotion(
      UUID promotionId,
      UUID eventId,
      Long distributionVersion,
      UUID businessId,
      UUID ownerUserId,
      UUID approvedRevisionId,
      boolean enabled) {
    try {
      return restClientBuilder
          .build()
          .put()
          .uri(socialServiceUrl + "/internal/community/guide-promotions/{promotionId}", promotionId)
          .contentType(MediaType.APPLICATION_JSON)
          .body(
              Map.of(
                  "eventId", eventId,
                  "distributionVersion", distributionVersion,
                  "businessId", businessId,
                  "ownerUserId", ownerUserId,
                  "approvedRevisionId", approvedRevisionId,
                  "enabled", enabled))
          .retrieve()
          .body(CommunityGuidePromotionAck.class);
    } catch (Exception ex) {
      log.warn("Failed to sync guide promotion {} to social service: {}", promotionId, ex.getMessage());
      return null;
    }
  }
}
