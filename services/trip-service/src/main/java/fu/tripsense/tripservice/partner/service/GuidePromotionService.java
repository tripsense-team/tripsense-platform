package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GuidePromotionService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerGuidePromotionRepository promotionRepository;
  private final PartnerGuidePromotionRevisionRepository revisionRepository;
  private final PartnerGuidePromotionMediaRepository mediaRepository;
  private final PartnerOutboxService outboxService;
  private final ObjectMapper objectMapper;

  @Transactional(readOnly = true)
  public List<GuidePromotionDto> listPromotions(AuthenticatedUser user, UUID businessId) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    List<PartnerGuidePromotion> list = promotionRepository.findByBusinessId(businessId);
    return list.stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public GuidePromotionDto getPromotion(AuthenticatedUser user, UUID businessId, UUID promotionId) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promotionId);
    return toDto(promo);
  }

  @Transactional
  public GuidePromotionDto createDraft(
      AuthenticatedUser user, UUID businessId, CreateGuidePromotionDraftRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerBusiness business = getBusiness(businessId);

    if (business.getKind() != BusinessKind.TOUR_GUIDE) {
      throw new TripServiceException(
          "INVALID_BUSINESS_KIND", "Guide promotions are only available for TOUR_GUIDE businesses", HttpStatus.BAD_REQUEST);
    }

    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException(
          "BUSINESS_SUSPENDED", "Cannot create promotions while business is suspended", HttpStatus.FORBIDDEN);
    }

    UUID promoId = UUID.randomUUID();
    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder()
            .id(promoId)
            .businessId(businessId)
            .publicationState(PublicationState.HIDDEN)
            .version(0L)
            .distributionVersion(0L)
            .build();
    promo = promotionRepository.save(promo);

    UUID approvedProfileRevId =
        business.getApprovedRevisionId() != null ? business.getApprovedRevisionId() : UUID.randomUUID();

    PartnerGuidePromotionRevision rev =
        PartnerGuidePromotionRevision.builder()
            .id(UUID.randomUUID())
            .promotionId(promoId)
            .revisionNumber(1)
            .approvedProfileRevisionId(approvedProfileRevId)
            .title(request.title())
            .summary(request.summary())
            .areaId(request.areaId())
            .topicIds(request.topicIds())
            .skillIds(request.skillIds())
            .experienceDuration(request.experienceDuration())
            .inclusions(request.inclusions() != null ? request.inclusions() : List.of())
            .exclusions(request.exclusions() != null ? request.exclusions() : List.of())
            .indicativePriceAmount(request.indicativePriceAmount())
            .indicativePriceCurrency(request.indicativePriceCurrency() != null ? request.indicativePriceCurrency() : "VND")
            .indicativePriceUnit(request.indicativePriceUnit())
            .coverImageRef(request.coverImageRef())
            .galleryImageRefs(request.galleryImageRefs() != null ? request.galleryImageRefs() : List.of())
            .state(ApplicationState.DRAFT)
            .build();
    rev = revisionRepository.save(rev);

    return toDto(promo, rev);
  }

  @Transactional
  public GuidePromotionDto updateDraft(
      AuthenticatedUser user, UUID businessId, UUID promotionId, UpdateGuidePromotionDraftRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promotionId);

    if (!Objects.equals(promo.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Promotion version conflict", HttpStatus.CONFLICT);
    }

    PartnerGuidePromotionRevision latest =
        revisionRepository
            .findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId)
            .orElseThrow(
                () -> new TripServiceException("REVISION_NOT_FOUND", "No revision found", HttpStatus.NOT_FOUND));

    PartnerBusiness business = getBusiness(businessId);
    UUID approvedProfileRevId =
        business.getApprovedRevisionId() != null ? business.getApprovedRevisionId() : latest.getApprovedProfileRevisionId();

    PartnerGuidePromotionRevision targetRev;
    if (latest.getState() == ApplicationState.DRAFT) {
      targetRev = latest;
      targetRev.setTitle(request.title());
      targetRev.setSummary(request.summary());
      targetRev.setAreaId(request.areaId());
      targetRev.setTopicIds(request.topicIds());
      targetRev.setSkillIds(request.skillIds());
      targetRev.setExperienceDuration(request.experienceDuration());
      targetRev.setInclusions(request.inclusions() != null ? request.inclusions() : List.of());
      targetRev.setExclusions(request.exclusions() != null ? request.exclusions() : List.of());
      targetRev.setIndicativePriceAmount(request.indicativePriceAmount());
      targetRev.setIndicativePriceCurrency(request.indicativePriceCurrency() != null ? request.indicativePriceCurrency() : "VND");
      targetRev.setIndicativePriceUnit(request.indicativePriceUnit());
      targetRev.setCoverImageRef(request.coverImageRef());
      targetRev.setGalleryImageRefs(request.galleryImageRefs() != null ? request.galleryImageRefs() : List.of());
      targetRev.setApprovedProfileRevisionId(approvedProfileRevId);
    } else {
      // Latest was reviewed/submitted, spawn new DRAFT revision
      targetRev =
          PartnerGuidePromotionRevision.builder()
              .id(UUID.randomUUID())
              .promotionId(promotionId)
              .revisionNumber(latest.getRevisionNumber() + 1)
              .approvedProfileRevisionId(approvedProfileRevId)
              .title(request.title())
              .summary(request.summary())
              .areaId(request.areaId())
              .topicIds(request.topicIds())
              .skillIds(request.skillIds())
              .experienceDuration(request.experienceDuration())
              .inclusions(request.inclusions() != null ? request.inclusions() : List.of())
              .exclusions(request.exclusions() != null ? request.exclusions() : List.of())
              .indicativePriceAmount(request.indicativePriceAmount())
              .indicativePriceCurrency(request.indicativePriceCurrency() != null ? request.indicativePriceCurrency() : "VND")
              .indicativePriceUnit(request.indicativePriceUnit())
              .coverImageRef(request.coverImageRef())
              .galleryImageRefs(request.galleryImageRefs() != null ? request.galleryImageRefs() : List.of())
              .state(ApplicationState.DRAFT)
              .build();
    }

    targetRev = revisionRepository.save(targetRev);
    promo.setVersion(promo.getVersion() + 1);
    promo = promotionRepository.save(promo);

    return toDto(promo, targetRev);
  }

  @Transactional
  public GuidePromotionDto submit(
      AuthenticatedUser user, UUID businessId, UUID promotionId, SubmitGuidePromotionRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promotionId);

    if (!Objects.equals(promo.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Promotion version conflict", HttpStatus.CONFLICT);
    }

    requireCapability(businessId, PartnerCapability.GUIDE_PROMOTION);
    PartnerBusiness business = getBusiness(businessId);

    if (business.getApprovedRevisionId() == null) {
      throw new TripServiceException(
          "PROFILE_NOT_APPROVED", "Cannot submit promotion without an approved guide profile", HttpStatus.CONFLICT);
    }

    PartnerApplication approvedProfile =
        applicationRepository
            .findById(business.getApprovedRevisionId())
            .orElseThrow(
                () -> new TripServiceException("PROFILE_NOT_FOUND", "Approved profile not found", HttpStatus.NOT_FOUND));

    PartnerGuidePromotionRevision latest =
        revisionRepository
            .findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId)
            .orElseThrow(
                () -> new TripServiceException("REVISION_NOT_FOUND", "No revision found", HttpStatus.NOT_FOUND));

    if (latest.getState() != ApplicationState.DRAFT) {
      throw new TripServiceException(
          "INVALID_STATE", "Only DRAFT revision can be submitted", HttpStatus.CONFLICT);
    }

    // Validate expertise and skills against approved profile
    Map<String, Object> snapshot = approvedProfile.getProfileSnapshot() != null ? approvedProfile.getProfileSnapshot() : Map.of();
    validateRevisionAgainstProfile(latest, snapshot);

    PartnerGuidePromotionRevision latestDraft = latest;
    if (promo.getApprovedRevisionId() != null) {
      revisionRepository.findById(promo.getApprovedRevisionId()).ifPresent(prev -> {
        if (!Objects.equals(prev.getAreaId(), latestDraft.getAreaId())) {
          throw new TripServiceException(
              "MATERIAL_CHANGE_REQUIRES_NEW_PROMOTION",
              "Changing core area requires creating a new promotion instead of editing an existing one",
              HttpStatus.CONFLICT);
        }
      });
    }

    latest.setState(ApplicationState.SUBMITTED);
    latest.setApprovedProfileRevisionId(business.getApprovedRevisionId());
    latest = revisionRepository.save(latest);

    promo.setVersion(promo.getVersion() + 1);
    promo = promotionRepository.save(promo);

    outboxService.publish(
        "GUIDE_PROMOTION",
        promo.getId(),
        "GuidePromotionSubmitted",
        Map.of(
            "businessId", businessId.toString(),
            "promotionId", promo.getId().toString(),
            "revisionId", latest.getId().toString(),
            "revisionNumber", latest.getRevisionNumber(),
            "title", latest.getTitle(),
            "actorId", user.id().toString()));

    return toDto(promo, latest);
  }

  @Transactional
  public GuidePromotionDto withdraw(
      AuthenticatedUser user, UUID businessId, UUID promotionId, SubmitGuidePromotionRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promotionId);

    if (!Objects.equals(promo.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Promotion version conflict", HttpStatus.CONFLICT);
    }

    PartnerGuidePromotionRevision latest =
        revisionRepository
            .findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId)
            .orElseThrow(
                () -> new TripServiceException("REVISION_NOT_FOUND", "No revision found", HttpStatus.NOT_FOUND));

    if (latest.getState() != ApplicationState.SUBMITTED) {
      throw new TripServiceException(
          "INVALID_STATE", "Only SUBMITTED revision can be withdrawn", HttpStatus.CONFLICT);
    }

    latest.setState(ApplicationState.WITHDRAWN);
    latest = revisionRepository.save(latest);

    promo.setVersion(promo.getVersion() + 1);
    promo = promotionRepository.save(promo);

    return toDto(promo, latest);
  }

  @Transactional
  public GuidePromotionDto updatePublication(
      AuthenticatedUser user, UUID businessId, UUID promotionId, GuidePromotionPublicationRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promotionId);

    if (!Objects.equals(promo.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Promotion version conflict", HttpStatus.CONFLICT);
    }

    if (promo.getPublicationState() == PublicationState.ARCHIVED) {
      throw new TripServiceException(
          "INVALID_STATE", "Archived promotion cannot be updated", HttpStatus.CONFLICT);
    }

    if (request.state() == PublicationState.PUBLISHED) {
      if (promo.getApprovedRevisionId() == null) {
        throw new TripServiceException(
            "NOT_APPROVED", "Cannot publish promotion without an approved revision", HttpStatus.CONFLICT);
      }
      PartnerBusiness business = getBusiness(businessId);
      boolean hasListingCap =
          capabilityRepository
              .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_LISTING)
              .filter(c -> c.getRevokedAt() == null)
              .isPresent();

      if (!business.isPublicEligible(hasListingCap)) {
        throw new TripServiceException(
            "BUSINESS_NOT_ELIGIBLE", "Business is not public eligible", HttpStatus.CONFLICT);
      }
      requireCapability(businessId, PartnerCapability.GUIDE_PROMOTION);
    }

    promo.setPublicationState(request.state());
    promo.setVersion(promo.getVersion() + 1);
    promo.setDistributionVersion(promo.getDistributionVersion() + 1);
    promo = promotionRepository.save(promo);

    PartnerGuidePromotionRevision current =
        promo.getApprovedRevisionId() != null
            ? revisionRepository.findById(promo.getApprovedRevisionId()).orElse(null)
            : revisionRepository.findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId).orElse(null);

    return toDto(promo, current);
  }

  @Transactional(readOnly = true)
  public List<GuidePromotionRevisionDto> listAdminRevisions(ApplicationState state, String cursor) {
    List<PartnerGuidePromotionRevision> revs =
        state != null
            ? revisionRepository.findByStateOrderByCreatedAtDesc(state)
            : revisionRepository.findByStateOrderByCreatedAtDesc(ApplicationState.SUBMITTED);
    return revs.stream().map(this::toRevisionDto).toList();
  }

  @Transactional
  public GuidePromotionRevisionDto reviewDecision(
      AuthenticatedUser admin, UUID revisionId, GuidePromotionRevisionDecisionRequest request) {
    requireAdmin(admin);

    PartnerGuidePromotionRevision rev =
        revisionRepository
            .findById(revisionId)
            .orElseThrow(
                () -> new TripServiceException("REVISION_NOT_FOUND", "Revision not found", HttpStatus.NOT_FOUND));

    PartnerGuidePromotion promo =
        promotionRepository
            .findById(rev.getPromotionId())
            .orElseThrow(
                () -> new TripServiceException("PROMOTION_NOT_FOUND", "Promotion not found", HttpStatus.NOT_FOUND));

    PartnerBusiness business = getBusiness(promo.getBusinessId());

    // Strict self-review fencing
    boolean isMember =
        memberRepository
            .findByIdBusinessIdAndIdUserId(business.getId(), admin.id())
            .isPresent();
    if (isMember || admin.id().equals(business.getOwnerUserId())) {
      throw new TripServiceException(
          "SELF_REVIEW_NOT_ALLOWED",
          "Self-review is strictly forbidden: Reviewer is a member of the business",
          HttpStatus.FORBIDDEN);
    }

    if (!Objects.equals(business.getVersion(), request.expectedBusinessVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }
    if (!Objects.equals(promo.getVersion(), request.expectedPromotionVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Promotion version conflict", HttpStatus.CONFLICT);
    }

    rev.setState(request.decision());
    rev.setReviewDecisionReason(request.reason());
    rev.setReviewedBy(admin.id());
    rev.setReviewedAt(Instant.now());
    rev = revisionRepository.save(rev);

    if (request.decision() == ApplicationState.APPROVED) {
      promo.setApprovedRevisionId(rev.getId());
      promo.setVersion(promo.getVersion() + 1);
      promo.setDistributionVersion(promo.getDistributionVersion() + 1);
      promo = promotionRepository.save(promo);
    }

    outboxService.publish(
        "GUIDE_PROMOTION",
        promo.getId(),
        "GuidePromotionReviewed",
        Map.of(
            "businessId", business.getId().toString(),
            "promotionId", promo.getId().toString(),
            "revisionId", rev.getId().toString(),
            "decision", request.decision().name(),
            "reason", request.reason(),
            "actorId", admin.id().toString()));

    return toRevisionDto(rev);
  }

  @Transactional(readOnly = true)
  public GuidePromotionSummaryDto getPublicPromotion(UUID promotionId) {
    PartnerGuidePromotion promo =
        promotionRepository
            .findById(promotionId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "PROMOTION_NOT_FOUND", "Guide promotion not found", HttpStatus.NOT_FOUND));

    if (promo.getPublicationState() != PublicationState.PUBLISHED || promo.getApprovedRevisionId() == null) {
      throw new TripServiceException(
          "PROMOTION_NOT_FOUND", "Guide promotion is not public eligible", HttpStatus.NOT_FOUND);
    }

    PartnerBusiness business = getBusiness(promo.getBusinessId());
    boolean hasListingCap =
        capabilityRepository
            .findByIdBusinessIdAndIdCapability(business.getId(), PartnerCapability.GUIDE_LISTING)
            .filter(c -> c.getRevokedAt() == null)
            .isPresent();

    if (!business.isPublicEligible(hasListingCap)) {
      throw new TripServiceException(
          "PROMOTION_NOT_FOUND", "Guide is not public eligible", HttpStatus.NOT_FOUND);
    }

    PartnerGuidePromotionRevision rev =
        revisionRepository
            .findById(promo.getApprovedRevisionId())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "PROMOTION_NOT_FOUND", "Approved revision not found", HttpStatus.NOT_FOUND));

    return toSummaryDto(promo, rev);
  }

  @Transactional(readOnly = true)
  public List<GuidePromotionSummaryDto> searchPublicPromotions(
      String areaId, List<String> topicIds, List<String> skillIds, String language, String cursor) {
    List<PartnerGuidePromotion> promos =
        promotionRepository.findByPublicationState(PublicationState.PUBLISHED);

    List<GuidePromotionSummaryDto> results = new ArrayList<>();
    for (PartnerGuidePromotion promo : promos) {
      if (promo.getApprovedRevisionId() == null) continue;

      PartnerBusiness business = businessRepository.findById(promo.getBusinessId()).orElse(null);
      if (business == null) continue;

      boolean hasListingCap =
          capabilityRepository
              .findByIdBusinessIdAndIdCapability(business.getId(), PartnerCapability.GUIDE_LISTING)
              .filter(c -> c.getRevokedAt() == null)
              .isPresent();

      if (!business.isPublicEligible(hasListingCap)) continue;

      Optional<PartnerGuidePromotionRevision> revOpt =
          revisionRepository.findById(promo.getApprovedRevisionId());
      if (revOpt.isEmpty()) continue;
      PartnerGuidePromotionRevision rev = revOpt.get();

      if (areaId != null && !areaId.isBlank() && !areaId.equalsIgnoreCase(rev.getAreaId())) {
        continue;
      }

      if (topicIds != null && !topicIds.isEmpty()) {
        Set<String> promoTopics = new HashSet<>(rev.getTopicIds().stream().map(String::toUpperCase).toList());
        boolean matchesAny = false;
        for (String t : topicIds) {
          if (promoTopics.contains(t.toUpperCase())) {
            matchesAny = true;
            break;
          }
        }
        if (!matchesAny) continue;
      }

      if (skillIds != null && !skillIds.isEmpty()) {
        Set<String> promoSkills = new HashSet<>(rev.getSkillIds().stream().map(String::toUpperCase).toList());
        boolean matchesAll = true;
        for (String s : skillIds) {
          if (!promoSkills.contains(s.toUpperCase())) {
            matchesAll = false;
            break;
          }
        }
        if (!matchesAll) continue;
      }

      results.add(toSummaryDto(promo, rev));
      if (results.size() >= 50) break;
    }
    return results;
  }

  @Transactional
  public PromotionMediaUploadIntentDto createMediaUploadIntent(
      AuthenticatedUser user, UUID businessId, PromotionMediaUploadIntentRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    getBusiness(businessId);

    UUID mediaId = UUID.randomUUID();
    String objectKey = "businesses/" + businessId + "/promotions/media/" + mediaId + "_" + request.fileName();

    PartnerGuidePromotionMedia media =
        PartnerGuidePromotionMedia.builder()
            .id(mediaId)
            .businessId(businessId)
            .promotionId(request.promotionId())
            .objectKey(objectKey)
            .mimeType(request.mimeType())
            .fileSize(request.fileSize())
            .state(PromotionMediaState.PENDING_UPLOAD)
            .build();
    mediaRepository.save(media);

    return PromotionMediaUploadIntentDto.builder()
        .mediaId(mediaId)
        .objectKey(objectKey)
        .uploadUrl("/api/partners/businesses/" + businessId + "/promotion-media/" + mediaId + "/mock-upload")
        .expiresInSeconds(600)
        .build();
  }

  @Transactional
  public void completeMediaUpload(AuthenticatedUser user, UUID businessId, UUID mediaId) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotionMedia media =
        mediaRepository
            .findByIdAndBusinessId(mediaId, businessId)
            .orElseThrow(
                () -> new TripServiceException("MEDIA_NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND));

    media.setState(PromotionMediaState.READY);
    mediaRepository.save(media);
  }

  @Transactional
  public CommunityPublicationDto updateCommunityPublication(
      AuthenticatedUser user,
      UUID businessId,
      UUID promoId,
      CommunityPublicationRequest request,
      String idempotencyKey) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promoId);

    if (!Objects.equals(promo.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Promotion version does not match expected version", HttpStatus.CONFLICT);
    }
    if (!Objects.equals(promo.getApprovedRevisionId(), request.expectedRevisionId())) {
      throw new TripServiceException(
          "REVISION_MISMATCH", "Promotion approved revision does not match expected revision", HttpStatus.CONFLICT);
    }

    PartnerBusiness business = getBusiness(businessId);
    if (request.enabled()) {
      boolean eligible =
          promo.getPublicationState() == PublicationState.PUBLISHED
              && promo.getApprovedRevisionId() != null
              && business.getApprovalValidity() == ApprovalValidity.VALID
              && business.getOperationState() == OperationState.ACTIVE;
      if (!eligible) {
        throw new TripServiceException(
            "NOT_PUBLIC_ELIGIBLE",
            "Promotion is not eligible for community publication",
            HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    long newDistVer = promo.getDistributionVersion() + 1;
    promo.setCommunityEnabled(request.enabled());
    promo.setDistributionVersion(newDistVer);
    promo.setVersion(promo.getVersion() + 1);
    promo = promotionRepository.save(promo);

    outboxService.publish(
        "PartnerGuidePromotion",
        promo.getId(),
        "GuideCommunityDistributionChanged",
        Map.of(
            "promotionId", promo.getId().toString(),
            "businessId", businessId.toString(),
            "ownerUserId", user.id().toString(),
            "approvedRevisionId", promo.getApprovedRevisionId() != null ? promo.getApprovedRevisionId().toString() : "",
            "distributionVersion", newDistVer,
            "enabled", promo.isCommunityEnabled()));

    String syncState =
        promo.getCommunityPostId() != null
            ? "DISTRIBUTED"
            : (promo.isCommunityEnabled() ? "PENDING" : "DISABLED");
    return new CommunityPublicationDto(
        promo.getId(),
        promo.getDistributionVersion(),
        promo.isCommunityEnabled(),
        syncState,
        promo.getCommunityPostId());
  }

  @Transactional(readOnly = true)
  public CommunityPublicationDto getCommunityPublication(
      AuthenticatedUser user, UUID businessId, UUID promoId) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerGuidePromotion promo = getPromotionEntity(businessId, promoId);
    String syncState =
        promo.getCommunityPostId() != null
            ? "DISTRIBUTED"
            : (promo.isCommunityEnabled() ? "PENDING" : "DISABLED");
    return new CommunityPublicationDto(
        promo.getId(),
        promo.getDistributionVersion(),
        promo.isCommunityEnabled(),
        syncState,
        promo.getCommunityPostId());
  }

  @Transactional(readOnly = true)
  public List<InternalGuideSummaryResponse> getGuideSummariesBatch(List<UUID> promotionIds) {
    if (promotionIds == null || promotionIds.isEmpty()) {
      return List.of();
    }
    if (promotionIds.size() > 50) {
      throw new TripServiceException(
          "LIMIT_EXCEEDED", "Batch size cannot exceed 50 promotion IDs", HttpStatus.BAD_REQUEST);
    }

    List<InternalGuideSummaryResponse> results = new ArrayList<>();
    for (UUID promoId : promotionIds) {
      PartnerGuidePromotion promo = promotionRepository.findById(promoId).orElse(null);
      if (promo == null) {
        results.add(
            new InternalGuideSummaryResponse(
                null, promoId, null, "UNAVAILABLE", 0L, false, null, null, null, List.of(), List.of(), List.of(), null, null, null, false));
        continue;
      }

      PartnerBusiness business = businessRepository.findById(promo.getBusinessId()).orElse(null);
      if (business == null || business.getApprovalValidity() != ApprovalValidity.VALID) {
        results.add(
            new InternalGuideSummaryResponse(
                promo.getBusinessId(), promoId, promo.getApprovedRevisionId(), "UNAVAILABLE", promo.getDistributionVersion(), promo.isCommunityEnabled(), null, null, null, List.of(), List.of(), List.of(), null, null, null, false));
        continue;
      }

      if (business.getOperationState() == OperationState.SUSPENDED) {
        results.add(
            new InternalGuideSummaryResponse(
                promo.getBusinessId(), promoId, promo.getApprovedRevisionId(), "TEMPORARILY_UNAVAILABLE", promo.getDistributionVersion(), promo.isCommunityEnabled(), null, null, null, List.of(), List.of(), List.of(), null, null, null, false));
        continue;
      }

      if (promo.getPublicationState() != PublicationState.PUBLISHED || promo.getApprovedRevisionId() == null) {
        results.add(
            new InternalGuideSummaryResponse(
                promo.getBusinessId(), promoId, promo.getApprovedRevisionId(), "UNAVAILABLE", promo.getDistributionVersion(), promo.isCommunityEnabled(), null, null, null, List.of(), List.of(), List.of(), null, null, null, false));
        continue;
      }

      PartnerGuidePromotionRevision rev = revisionRepository.findById(promo.getApprovedRevisionId()).orElse(null);
      if (rev == null) {
        results.add(
            new InternalGuideSummaryResponse(
                promo.getBusinessId(), promoId, promo.getApprovedRevisionId(), "UNAVAILABLE", promo.getDistributionVersion(), promo.isCommunityEnabled(), null, null, null, List.of(), List.of(), List.of(), null, null, null, false));
        continue;
      }

      String availability = "AVAILABLE";
      boolean canInquiry = business.isAcceptingNew();
      List<String> areaTopics = new ArrayList<>();
      if (rev.getAreaId() != null) areaTopics.add(rev.getAreaId());
      if (rev.getTopicIds() != null) areaTopics.addAll(rev.getTopicIds());

      Map<String, Object> price = null;
      if (rev.getIndicativePriceAmount() != null) {
        price =
            Map.of(
                "amount", rev.getIndicativePriceAmount(),
                "currency", rev.getIndicativePriceCurrency() != null ? rev.getIndicativePriceCurrency() : "VND",
                "unit", rev.getIndicativePriceUnit() != null ? rev.getIndicativePriceUnit() : "PER_GROUP");
      }

      results.add(
          new InternalGuideSummaryResponse(
              promo.getBusinessId(),
              promo.getId(),
              promo.getApprovedRevisionId(),
              availability,
              promo.getDistributionVersion(),
              promo.isCommunityEnabled(),
              rev.getTitle(),
              rev.getSummary(),
              rev.getCoverImageRef(),
              areaTopics,
              rev.getSkillIds() != null ? rev.getSkillIds() : List.of(),
              List.of(),
              price,
              "/partners/" + promo.getBusinessId(),
              "/partners/" + promo.getBusinessId() + "/promotions/" + promo.getId(),
              canInquiry));
    }
    return results;
  }

  private void validateRevisionAgainstProfile(
      PartnerGuidePromotionRevision rev, Map<String, Object> profileSnapshot) {
    Object expObj = profileSnapshot.get("expertise");
    boolean areaMatched = false;
    Set<String> allowedTopicsForArea = new HashSet<>();

    if (expObj instanceof List<?> list) {
      for (Object item : list) {
        if (item instanceof Map<?, ?> map) {
          String aId = Objects.toString(map.get("areaId"), "");
          String tId = Objects.toString(map.get("topicId"), "");
          if (aId.equalsIgnoreCase(rev.getAreaId())) {
            areaMatched = true;
            allowedTopicsForArea.add(tId.toUpperCase());
          }
        }
      }
    }

    if (!areaMatched) {
      throw new TripServiceException(
          "INVALID_EXPERTISE", "Area " + rev.getAreaId() + " is not part of guide's approved expertise", HttpStatus.BAD_REQUEST);
    }

    for (String t : rev.getTopicIds()) {
      if (!allowedTopicsForArea.contains(t.toUpperCase())) {
        throw new TripServiceException(
            "INVALID_EXPERTISE", "Topic " + t + " is not approved for area " + rev.getAreaId(), HttpStatus.BAD_REQUEST);
      }
    }

    Object skillsObj = profileSnapshot.get("skillIds");
    Set<String> allowedSkills = new HashSet<>();
    if (skillsObj instanceof List<?> list) {
      for (Object s : list) {
        if (s != null) allowedSkills.add(s.toString().toUpperCase());
      }
    }

    for (String s : rev.getSkillIds()) {
      if (!allowedSkills.contains(s.toUpperCase())) {
        throw new TripServiceException(
            "INVALID_SKILL", "Skill " + s + " is not part of guide's approved profile", HttpStatus.BAD_REQUEST);
      }
    }
  }

  private PartnerGuidePromotion getPromotionEntity(UUID businessId, UUID promoId) {
    return promotionRepository
        .findByIdAndBusinessId(promoId, businessId)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "PROMOTION_NOT_FOUND", "Guide promotion not found", HttpStatus.NOT_FOUND));
  }

  private PartnerBusiness getBusiness(UUID id) {
    return businessRepository
        .findById(id)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "BUSINESS_NOT_FOUND", "Partner business not found", HttpStatus.NOT_FOUND));
  }

  private void requireMember(AuthenticatedUser user, UUID businessId, Set<MembershipRole> allowedRoles) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerBusinessMember member =
        memberRepository
            .findByIdBusinessIdAndIdUserId(businessId, user.id())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));

    if (member.getState() != MembershipState.ACTIVE || !allowedRoles.contains(member.getRole())) {
      throw new TripServiceException(
          "FORBIDDEN", "Insufficient membership permissions", HttpStatus.FORBIDDEN);
    }
  }

  private void requireCapability(UUID businessId, PartnerCapability capability) {
    boolean active =
        capabilityRepository
            .findByIdBusinessIdAndIdCapability(businessId, capability)
            .filter(c -> c.getRevokedAt() == null)
            .isPresent();
    if (!active) {
      throw new TripServiceException(
          "CAPABILITY_REQUIRED",
          "Business does not have active capability: " + capability,
          HttpStatus.FORBIDDEN);
    }
  }

  private void requireAdmin(AuthenticatedUser user) {
    if (user == null || (!"ADMIN".equals(user.role()) && !"ROLE_ADMIN".equals(user.role()))) {
      throw new TripServiceException("FORBIDDEN", "Admin access required", HttpStatus.FORBIDDEN);
    }
  }

  private GuidePromotionDto toDto(PartnerGuidePromotion promo) {
    PartnerGuidePromotionRevision latest =
        promo.getApprovedRevisionId() != null
            ? revisionRepository.findById(promo.getApprovedRevisionId()).orElse(null)
            : revisionRepository.findFirstByPromotionIdOrderByRevisionNumberDesc(promo.getId()).orElse(null);
    return toDto(promo, latest);
  }

  private GuidePromotionDto toDto(PartnerGuidePromotion promo, PartnerGuidePromotionRevision rev) {
    return GuidePromotionDto.builder()
        .id(promo.getId())
        .businessId(promo.getBusinessId())
        .approvedRevisionId(promo.getApprovedRevisionId())
        .publicationState(promo.getPublicationState())
        .communityEnabled(promo.isCommunityEnabled())
        .communityPostId(promo.getCommunityPostId())
        .distributionVersion(promo.getDistributionVersion())
        .version(promo.getVersion())
        .currentRevision(rev != null ? toRevisionDto(rev) : null)
        .createdAt(promo.getCreatedAt())
        .updatedAt(promo.getUpdatedAt())
        .build();
  }

  private GuidePromotionRevisionDto toRevisionDto(PartnerGuidePromotionRevision rev) {
    return GuidePromotionRevisionDto.builder()
        .id(rev.getId())
        .promotionId(rev.getPromotionId())
        .revisionNumber(rev.getRevisionNumber())
        .approvedProfileRevisionId(rev.getApprovedProfileRevisionId())
        .title(rev.getTitle())
        .summary(rev.getSummary())
        .areaId(rev.getAreaId())
        .topicIds(rev.getTopicIds())
        .skillIds(rev.getSkillIds())
        .experienceDuration(rev.getExperienceDuration())
        .inclusions(rev.getInclusions())
        .exclusions(rev.getExclusions())
        .indicativePriceAmount(rev.getIndicativePriceAmount())
        .indicativePriceCurrency(rev.getIndicativePriceCurrency())
        .indicativePriceUnit(rev.getIndicativePriceUnit())
        .coverImageRef(rev.getCoverImageRef())
        .galleryImageRefs(rev.getGalleryImageRefs())
        .state(rev.getState())
        .reviewDecisionReason(rev.getReviewDecisionReason())
        .reviewedBy(rev.getReviewedBy())
        .reviewedAt(rev.getReviewedAt())
        .createdAt(rev.getCreatedAt())
        .updatedAt(rev.getUpdatedAt())
        .build();
  }

  private GuidePromotionSummaryDto toSummaryDto(
      PartnerGuidePromotion promo, PartnerGuidePromotionRevision rev) {
    return GuidePromotionSummaryDto.builder()
        .id(promo.getId())
        .businessId(promo.getBusinessId())
        .title(rev.getTitle())
        .summary(rev.getSummary())
        .areaId(rev.getAreaId())
        .topicIds(rev.getTopicIds())
        .skillIds(rev.getSkillIds())
        .experienceDuration(rev.getExperienceDuration())
        .indicativePriceAmount(rev.getIndicativePriceAmount())
        .indicativePriceCurrency(rev.getIndicativePriceCurrency())
        .indicativePriceUnit(rev.getIndicativePriceUnit())
        .coverImageRef(rev.getCoverImageRef())
        .build();
  }
}
