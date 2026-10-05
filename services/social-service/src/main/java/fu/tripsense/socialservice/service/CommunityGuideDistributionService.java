package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.request.CommunityGuidePromotionSyncRequest;
import fu.tripsense.socialservice.dto.response.CommunityGuidePromotionAck;
import fu.tripsense.socialservice.dto.response.CommunityGuidePromotionStatusItem;
import fu.tripsense.socialservice.entity.SocialGuidePromotion;
import fu.tripsense.socialservice.entity.SocialIntegrationReceipt;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.repository.SocialGuidePromotionRepository;
import fu.tripsense.socialservice.repository.SocialIntegrationReceiptRepository;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommunityGuideDistributionService {

  private final SocialGuidePromotionRepository guidePromotions;
  private final SocialPostRepository posts;
  private final SocialIntegrationReceiptRepository receipts;

  @Transactional
  public CommunityGuidePromotionAck syncGuidePromotion(
      UUID sourcePromotionId, CommunityGuidePromotionSyncRequest request) {

    // Idempotent receipt check
    if (receipts.existsById(request.eventId())) {
      SocialGuidePromotion existing = guidePromotions.findBySourcePromotionId(sourcePromotionId).orElse(null);
      return new CommunityGuidePromotionAck(
          existing != null ? existing.getPostId() : null,
          request.distributionVersion(),
          existing != null && existing.isDistributionEnabled() ? "DISTRIBUTED" : "HIDDEN");
    }

    Optional<SocialGuidePromotion> existingOpt = guidePromotions.findBySourcePromotionId(sourcePromotionId);
    Instant now = Instant.now();
    UUID postId;
    String deliveryState;

    if (existingOpt.isPresent()) {
      SocialGuidePromotion promo = existingOpt.get();
      postId = promo.getPostId();

      // If removed by moderation or author, tombstone cannot be resurrected by sync
      if (promo.getRemovedAt() != null) {
        deliveryState = "REMOVED";
      } else if (request.distributionVersion() < promo.getDistributionVersion()) {
        deliveryState = promo.isDistributionEnabled() ? "DISTRIBUTED" : "HIDDEN";
      } else {
        promo.setDistributionVersion(request.distributionVersion());
        promo.setDistributionEnabled(request.enabled());
        promo.setApprovedRevisionId(request.approvedRevisionId());
        promo.setUpdatedAt(now);
        guidePromotions.save(promo);
        deliveryState = request.enabled() ? "DISTRIBUTED" : "HIDDEN";
      }
    } else {
      postId = UUID.randomUUID();
      SocialPost post =
          SocialPost.builder()
              .id(postId)
              .authorId(request.ownerUserId())
              .authorDisplayName("Tour Guide")
              .content("")
              .postType("GUIDE_PROMOTION")
              .likeCount(0)
              .commentCount(0)
              .createdAt(now)
              .updatedAt(now)
              .build();
      posts.save(post);

      SocialGuidePromotion promo =
          SocialGuidePromotion.builder()
              .postId(postId)
              .sourcePromotionId(sourcePromotionId)
              .sourceBusinessId(request.businessId())
              .sourceOwnerId(request.ownerUserId())
              .approvedRevisionId(request.approvedRevisionId())
              .distributionVersion(request.distributionVersion())
              .distributionEnabled(request.enabled())
              .createdAt(now)
              .updatedAt(now)
              .build();
      guidePromotions.save(promo);
      deliveryState = request.enabled() ? "DISTRIBUTED" : "HIDDEN";
    }

    SocialIntegrationReceipt receipt =
        SocialIntegrationReceipt.builder()
            .eventId(request.eventId())
            .source("TRIP_SERVICE")
            .payloadHash(Integer.toHexString(request.hashCode()))
            .sourcePromotionId(sourcePromotionId)
            .appliedVersion(request.distributionVersion())
            .receivedAt(now)
            .build();
    receipts.save(receipt);

    return new CommunityGuidePromotionAck(postId, request.distributionVersion(), deliveryState);
  }

  @Transactional(readOnly = true)
  public List<CommunityGuidePromotionStatusItem> getStatusBatch(List<UUID> promotionIds) {
    if (promotionIds == null || promotionIds.isEmpty()) {
      return List.of();
    }
    List<SocialGuidePromotion> list = guidePromotions.findBySourcePromotionIdIn(promotionIds);
    return list.stream()
        .map(
            p ->
                new CommunityGuidePromotionStatusItem(
                    p.getSourcePromotionId(),
                    p.getPostId(),
                    p.getDistributionVersion(),
                    p.getRemovedAt() != null
                        ? "REMOVED"
                        : (p.isDistributionEnabled() ? "DISTRIBUTED" : "HIDDEN"),
                    p.getRemovedAt(),
                    p.getRemovalReason()))
        .toList();
  }
}
