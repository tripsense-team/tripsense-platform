package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerBusinessService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerReviewAuditRepository auditRepository;
  private final PartnerInvitationRepository invitationRepository;
  private final PartnerOutboxService outboxService;

  @Transactional
  public BusinessDetailDto createDraft(AuthenticatedUser user, CreateBusinessDraftRequest request) {
    if (request.kind() == BusinessKind.TOUR_GUIDE
        && businessRepository.existsByOwnerUserIdAndKind(user.id(), BusinessKind.TOUR_GUIDE)) {
      throw new TripServiceException(
          "GUIDE_ALREADY_EXISTS",
          "A tour guide profile already exists for this owner",
          HttpStatus.CONFLICT);
    }

    PartnerBusiness business =
        PartnerBusiness.builder()
            .kind(request.kind())
            .ownerUserId(user.id())
            .displayName(request.displayName())
            .draftProfileJson(request.draftProfile() != null ? request.draftProfile() : Map.of())
            .draftSchemaVersion(1)
            .approvalValidity(ApprovalValidity.NONE)
            .operationState(OperationState.ACTIVE)
            .publicationState(PublicationState.HIDDEN)
            .acceptingNew(false)
            .requiresReverification(false)
            .suspensionVersion(0)
            .build();

    business = businessRepository.save(business);

    PartnerBusinessMember member =
        PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(business.getId(), user.id()))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build();
    memberRepository.save(member);

    recordAudit(
        business.getId(), null, user.id(), "DRAFT_CREATED", "Initial draft created", null, "DRAFT", business.getVersion());

    return toBusinessDetailDto(business, MembershipRole.OWNER);
  }

  @Transactional
  public BusinessDetailDto updateDraft(
      AuthenticatedUser user, UUID businessId, UpdateBusinessDraftRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business draft version conflict", HttpStatus.CONFLICT);
    }

    if (request.displayName() != null && !request.displayName().isBlank()) {
      business.setDisplayName(request.displayName().trim());
    }
    if (request.draftProfile() != null) {
      business.setDraftProfileJson(request.draftProfile());
    }

    business = businessRepository.save(business);
    return toBusinessDetailDto(business, MembershipRole.OWNER);
  }

  @Transactional
  public ApplicationDetailDto submitApplication(
      AuthenticatedUser user, UUID businessId, SubmitApplicationRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict during submission", HttpStatus.CONFLICT);
    }

    if (applicationRepository.existsByBusinessIdAndState(businessId, ApplicationState.SUBMITTED)) {
      throw new TripServiceException(
          "APPLICATION_ALREADY_SUBMITTED",
          "There is already a pending submitted application for this business",
          HttpStatus.CONFLICT);
    }

    validateRequestedCapabilities(business.getKind(), request.requestedCapabilities());

    Integer nextRevision =
        applicationRepository
            .findTopByBusinessIdOrderByRevisionDesc(businessId)
            .map(a -> a.getRevision() + 1)
            .orElse(1);

    Map<String, Object> snapshot =
        request.profileSnapshot() != null ? request.profileSnapshot() : business.getDraftProfileJson();
    if (snapshot == null || snapshot.isEmpty()) {
      throw new TripServiceException(
          "INVALID_BUSINESS_PROFILE", "Profile snapshot cannot be empty", HttpStatus.BAD_REQUEST);
    }

    PartnerApplication application =
        PartnerApplication.builder()
            .businessId(businessId)
            .revision(nextRevision)
            .profileSnapshot(snapshot)
            .checklistId(request.checklistId())
            .checklistVersion(request.checklistVersion())
            .requestedCapabilities(
                request.requestedCapabilities().stream().map(Enum::name).toList())
            .state(ApplicationState.SUBMITTED)
            .isReverification(business.isRequiresReverification())
            .build();

    application = applicationRepository.save(application);

    if (business.isRequiresReverification()) {
      business.setReverificationApplicationId(application.getId());
      businessRepository.save(business);
    }

    recordAudit(
        businessId,
        application.getId(),
        user.id(),
        "APPLICATION_SUBMITTED",
        "Application submitted for review (revision " + nextRevision + ")",
        null,
        "SUBMITTED",
        business.getVersion());

    outboxService.publish(
        "PARTNER_APPLICATION",
        application.getId(),
        "PartnerApplicationSubmitted",
        Map.of(
            "businessId", businessId.toString(),
            "revision", nextRevision,
            "ownerId", user.id().toString()));

    return toApplicationDetailDto(application);
  }

  @Transactional
  public ApplicationDetailDto withdrawApplication(
      AuthenticatedUser user, UUID businessId, UUID applicationId) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    PartnerApplication application =
        applicationRepository
            .findById(applicationId)
            .filter(a -> a.getBusinessId().equals(businessId))
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "APPLICATION_NOT_FOUND", "Application not found", HttpStatus.NOT_FOUND));

    if (application.getState() != ApplicationState.SUBMITTED) {
      throw new TripServiceException(
          "INVALID_APPLICATION_STATE",
          "Only SUBMITTED applications can be withdrawn",
          HttpStatus.CONFLICT);
    }

    application.setState(ApplicationState.WITHDRAWN);
    application = applicationRepository.save(application);

    recordAudit(
        businessId,
        applicationId,
        user.id(),
        "APPLICATION_WITHDRAWN",
        "Application withdrawn by owner",
        "SUBMITTED",
        "WITHDRAWN",
        business.getVersion());

    outboxService.publish(
        "PARTNER_APPLICATION",
        application.getId(),
        "PartnerApplicationWithdrawn",
        Map.of(
            "businessId", businessId.toString(),
            "ownerId", user.id().toString()));

    return toApplicationDetailDto(application);
  }

  @Transactional(readOnly = true)
  public BusinessReadinessDto getReadiness(AuthenticatedUser user, UUID businessId) {
    MembershipRole role = getMemberRole(businessId, user.id());
    if (role != MembershipRole.OWNER && role != MembershipRole.MANAGER) {
      throw new TripServiceException(
          "FORBIDDEN", "Only OWNER or MANAGER can view readiness", HttpStatus.FORBIDDEN);
    }

    PartnerBusiness business = getBusiness(businessId);
    List<String> missing = new ArrayList<>();

    boolean hasListingCap = hasActiveCapability(businessId, getListingCapability(business.getKind()));
    boolean hasIntakeCap = hasActiveCapability(businessId, getIntakeCapability(business.getKind()));

    if (business.getApprovalValidity() != ApprovalValidity.VALID) {
      missing.add("PROFILE_NOT_APPROVED");
    }
    if (business.getApprovedRevisionId() == null) {
      missing.add("APPROVED_REVISION_MISSING");
    }
    if (business.isRequiresReverification()) {
      missing.add("REVERIFICATION_REQUIRED");
    }
    if (business.getOperationState() != OperationState.ACTIVE) {
      missing.add("BUSINESS_SUSPENDED");
    }
    if (!hasListingCap) {
      missing.add("LISTING_CAPABILITY_NOT_GRANTED");
    }

    boolean canPublish = missing.isEmpty();

    if (!canPublish) {
      // If cannot publish, cannot accept new
      return new BusinessReadinessDto(businessId, false, false, missing);
    }

    if (!hasIntakeCap) {
      missing.add("INTAKE_CAPABILITY_NOT_GRANTED");
    }

    boolean canAcceptNew = missing.isEmpty();
    return new BusinessReadinessDto(businessId, canPublish, canAcceptNew, missing);
  }

  @Transactional
  public BusinessDetailDto updatePublication(
      AuthenticatedUser user, UUID businessId, PublicationRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    PublicationState targetState = PublicationState.valueOf(request.state());

    if (targetState == PublicationState.PUBLISHED) {
      if (business.isRequiresReverification()) {
        throw new TripServiceException(
            "REVERIFICATION_REQUIRED",
            "Cannot publish business while reverification is required for material changes",
            HttpStatus.CONFLICT);
      }
      boolean hasListingCap = hasActiveCapability(businessId, getListingCapability(business.getKind()));
      if (!business.canPublish(hasListingCap)) {
        throw new TripServiceException(
            "READINESS_INCOMPLETE",
            "Business does not meet publication readiness criteria",
            HttpStatus.CONFLICT);
      }
      business.setPublicationState(PublicationState.PUBLISHED);
    } else {
      business.setPublicationState(PublicationState.HIDDEN);
      business.setAcceptingNew(false);
    }

    business = businessRepository.save(business);
    recordAudit(
        businessId,
        null,
        user.id(),
        "PUBLICATION_UPDATED",
        "Publication state changed to " + targetState,
        null,
        targetState.name(),
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerPublicationChanged",
        Map.of(
            "businessId", businessId.toString(),
            "state", targetState.name(),
            "ownerId", user.id().toString()));

    return toBusinessDetailDto(business, MembershipRole.OWNER);
  }

  @Transactional
  public BusinessDetailDto updateIntake(
      AuthenticatedUser user, UUID businessId, IntakeRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    if (request.acceptingNew()) {
      if (business.isRequiresReverification()) {
        throw new TripServiceException(
            "REVERIFICATION_REQUIRED",
            "Cannot open intake while reverification is required for material changes",
            HttpStatus.CONFLICT);
      }
      boolean hasListingCap = hasActiveCapability(businessId, getListingCapability(business.getKind()));
      boolean hasIntakeCap = hasActiveCapability(businessId, getIntakeCapability(business.getKind()));
      boolean publicEligible = business.isPublicEligible(hasListingCap);

      if (!publicEligible || !hasIntakeCap) {
        throw new TripServiceException(
            "READINESS_INCOMPLETE",
            "Business is not eligible to accept new bookings or inquiries",
            HttpStatus.CONFLICT);
      }
      business.setAcceptingNew(true);
    } else {
      business.setAcceptingNew(false);
    }

    business = businessRepository.save(business);
    recordAudit(
        businessId,
        null,
        user.id(),
        "INTAKE_UPDATED",
        "Accepting new intake set to " + request.acceptingNew(),
        null,
        String.valueOf(request.acceptingNew()),
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerIntakeChanged",
        Map.of(
            "businessId", businessId.toString(),
            "acceptingNew", request.acceptingNew(),
            "ownerId", user.id().toString()));

    return toBusinessDetailDto(business, MembershipRole.OWNER);
  }

  @Transactional
  public BusinessDetailDto declareMaterialChange(
      AuthenticatedUser user, UUID businessId, MaterialChangeRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    business.setRequiresReverification(true);
    business.setPublicationState(PublicationState.HIDDEN);
    business.setAcceptingNew(false);

    if (request.reverificationApplicationId() != null) {
      business.setReverificationApplicationId(request.reverificationApplicationId());
    }

    business = businessRepository.save(business);

    recordAudit(
        businessId,
        request.reverificationApplicationId(),
        user.id(),
        "MATERIAL_CHANGE_DECLARED",
        "Material change declared [" + request.kind() + "]: " + request.reason(),
        "PUBLISHED",
        "HIDDEN",
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerMaterialChangeDeclared",
        Map.of(
            "businessId", businessId.toString(),
            "kind", request.kind(),
            "reason", request.reason(),
            "ownerId", user.id().toString()));

    return toBusinessDetailDto(business, MembershipRole.OWNER);
  }

  @Transactional
  public InvitationDto inviteMember(
      AuthenticatedUser user, UUID businessId, MemberInvitationRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    if (request.role() == MembershipRole.OWNER) {
      throw new TripServiceException(
          "INVALID_ROLE", "Cannot invite OWNER via member invitation", HttpStatus.BAD_REQUEST);
    }

    String token = UUID.randomUUID().toString().replace("-", "") + generateRandomSecret(16);
    String tokenHash = hashToken(token);
    int days = request.expiryDays() != null && request.expiryDays() > 0 ? request.expiryDays() : 7;
    Instant expiresAt = Instant.now().plus(days, ChronoUnit.DAYS);

    PartnerInvitation invitation =
        PartnerInvitation.builder()
            .businessId(businessId)
            .recipientEmail(request.email().trim().toLowerCase(Locale.ROOT))
            .role(request.role())
            .tokenHash(tokenHash)
            .state(InvitationState.PENDING)
            .expiresAt(expiresAt)
            .build();

    invitation = invitationRepository.save(invitation);

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerMemberInvited",
        Map.of(
            "businessId", businessId.toString(),
            "recipientEmail", invitation.getRecipientEmail(),
            "role", invitation.getRole().name(),
            "invitationId", invitation.getId().toString(),
            "token", token));

    return InvitationDto.builder()
        .id(invitation.getId())
        .businessId(businessId)
        .recipientEmail(invitation.getRecipientEmail())
        .role(invitation.getRole())
        .state(invitation.getState())
        .expiresAt(invitation.getExpiresAt())
        .createdAt(invitation.getCreatedAt())
        .token(token)
        .build();
  }

  @Transactional
  public BusinessDetailDto acceptInvitation(AuthenticatedUser user, String token) {
    String tokenHash = hashToken(token);
    PartnerInvitation invitation =
        invitationRepository
            .findByTokenHash(tokenHash)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "INVITATION_NOT_FOUND", "Invitation not found", HttpStatus.NOT_FOUND));

    if (invitation.getState() != InvitationState.PENDING || invitation.isExpired()) {
      invitation.setState(InvitationState.EXPIRED);
      invitationRepository.save(invitation);
      throw new TripServiceException(
          "INVITATION_EXPIRED", "Invitation is no longer valid", HttpStatus.CONFLICT);
    }

    if (!user.email().trim().equalsIgnoreCase(invitation.getRecipientEmail().trim())) {
      throw new TripServiceException(
          "EMAIL_MISMATCH",
          "Authenticated email does not match invitation recipient email",
          HttpStatus.FORBIDDEN);
    }

    invitation.setState(InvitationState.ACCEPTED);
    invitationRepository.save(invitation);

    PartnerBusinessMember member =
        PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(invitation.getBusinessId(), user.id()))
            .role(invitation.getRole())
            .state(MembershipState.ACTIVE)
            .build();
    memberRepository.save(member);

    PartnerBusiness business = getBusiness(invitation.getBusinessId());
    return toBusinessDetailDto(business, invitation.getRole());
  }

  @Transactional
  public void removeMember(AuthenticatedUser user, UUID businessId, UUID targetUserId) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerBusiness business = getBusiness(businessId);

    if (business.getOwnerUserId().equals(targetUserId)) {
      throw new TripServiceException(
          "CANNOT_REMOVE_OWNER", "Cannot remove owner of business", HttpStatus.BAD_REQUEST);
    }

    PartnerBusinessMemberId memberId = new PartnerBusinessMemberId(businessId, targetUserId);
    memberRepository
        .findById(memberId)
        .ifPresent(
            m -> {
              m.setState(MembershipState.REVOKED);
              memberRepository.save(m);
              outboxService.publish(
                  "PARTNER_BUSINESS",
                  businessId,
                  "PartnerMembershipRevoked",
                  Map.of(
                      "businessId", businessId.toString(),
                      "targetUserId", targetUserId.toString(),
                      "ownerId", user.id().toString()));
            });
  }

  @Transactional(readOnly = true)
  public PartnerContextDto getPartnerContext(AuthenticatedUser user) {
    List<PartnerBusinessMember> memberships =
        memberRepository.findByIdUserIdAndState(user.id(), MembershipState.ACTIVE);

    List<BusinessDetailDto> list = new ArrayList<>();
    for (PartnerBusinessMember m : memberships) {
      businessRepository
          .findById(m.getId().getBusinessId())
          .ifPresent(b -> list.add(toBusinessDetailDto(b, m.getRole())));
    }

    return new PartnerContextDto(user.role(), user.roles(), list);
  }

  @Transactional(readOnly = true)
  public BusinessDetailDto getBusinessDetail(AuthenticatedUser user, UUID businessId) {
    MembershipRole role = getMemberRole(businessId, user.id());
    PartnerBusiness business = getBusiness(businessId);
    return toBusinessDetailDto(business, role);
  }

  @Transactional(readOnly = true)
  public List<ApplicationDetailDto> getApplications(AuthenticatedUser user, UUID businessId) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    return applicationRepository.findByBusinessIdOrderByRevisionDesc(businessId).stream()
        .map(this::toApplicationDetailDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<PartnerCapability> getCapabilities(AuthenticatedUser user, UUID businessId) {
    getMemberRole(businessId, user.id());
    Instant now = Instant.now();
    return capabilityRepository.findByIdBusinessId(businessId).stream()
        .filter(c -> c.getRevokedAt() == null && (c.getExpiresAt() == null || c.getExpiresAt().isAfter(now)))
        .map(c -> c.getId().getCapability())
        .toList();
  }

  public BusinessKindConfigDto getBusinessKindConfig(String region) {
    String reg =
        (region != null && !region.isBlank())
            ? region.trim().toUpperCase(Locale.ROOT).replace(" ", "_").replace("-", "_")
            : "GLOBAL";
    Set<String> supportedRegions =
        Set.of("GLOBAL", "VN", "VIETNAM", "HOI_AN", "DA_NANG", "HA_NOI", "HO_CHI_MINH");
    boolean submitEnabled = supportedRegions.contains(reg);

    var hotel =
        BusinessKindConfigDto.KindDescriptorDto.builder()
            .kind(BusinessKind.HOTEL)
            .title("Khách sạn / Cơ sở lưu trú")
            .description("Đăng thông tin cơ sở lưu trú, quản lý phòng và tiếp nhận đặt phòng trực tiếp.")
            .checklistId("CHK-HOTEL-V1")
            .checklistVersion("1.0")
            .goalBundles(
                List.of(
                    new BusinessKindConfigDto.GoalBundleDto(
                        "LISTING",
                        "Đăng thông tin",
                        "Hiển thị thông tin cơ sở trên nền tảng TripSense",
                        List.of(PartnerCapability.HOTEL_LISTING)),
                    new BusinessKindConfigDto.GoalBundleDto(
                        "BOOKING",
                        "Nhận đặt phòng",
                        "Quản lý tồn kho phòng và tiếp nhận đặt phòng từ khách",
                        List.of(PartnerCapability.HOTEL_INVENTORY, PartnerCapability.HOTEL_BOOKING))))
            .supportedCapabilities(
                List.of(
                    PartnerCapability.HOTEL_LISTING,
                    PartnerCapability.HOTEL_INVENTORY,
                    PartnerCapability.HOTEL_BOOKING))
            .build();

    var restaurant =
        BusinessKindConfigDto.KindDescriptorDto.builder()
            .kind(BusinessKind.RESTAURANT)
            .title("Quán ăn / Nhà hàng / Café")
            .description("Giới thiệu ẩm thực, thực đơn, giờ mở cửa và thông tin liên hệ.")
            .checklistId("CHK-RESTAURANT-V1")
            .checklistVersion("1.0")
            .goalBundles(
                List.of(
                    new BusinessKindConfigDto.GoalBundleDto(
                        "LISTING",
                        "Đăng thông tin",
                        "Hiển thị thông tin quán ăn trên nền tảng",
                        List.of(PartnerCapability.RESTAURANT_LISTING)),
                    new BusinessKindConfigDto.GoalBundleDto(
                        "MENU",
                        "Quản lý thực đơn",
                        "Công khai thực đơn món ăn và mức giá tham khảo",
                        List.of(PartnerCapability.RESTAURANT_MENU))))
            .supportedCapabilities(
                List.of(PartnerCapability.RESTAURANT_LISTING, PartnerCapability.RESTAURANT_MENU))
            .build();

    var guide =
        BusinessKindConfigDto.KindDescriptorDto.builder()
            .kind(BusinessKind.TOUR_GUIDE)
            .title("Hướng dẫn viên du lịch")
            .description("Hồ sơ cá nhân chuyên môn, đăng bài quảng bá dịch vụ và tiếp nhận yêu cầu tư vấn.")
            .checklistId("CHK-GUIDE-V1")
            .checklistVersion("1.0")
            .goalBundles(
                List.of(
                    new BusinessKindConfigDto.GoalBundleDto(
                        "PROMOTION",
                        "Giới thiệu chuyên môn",
                        "Xây dựng hồ sơ năng lực và đăng bài dịch vụ trên Community",
                        List.of(PartnerCapability.GUIDE_LISTING, PartnerCapability.GUIDE_PROMOTION)),
                    new BusinessKindConfigDto.GoalBundleDto(
                        "INQUIRY",
                        "Tiếp nhận tư vấn",
                        "Nhận và phản hồi các yêu cầu tư vấn từ khách du lịch",
                        List.of(PartnerCapability.GUIDE_INQUIRY))))
            .supportedCapabilities(
                List.of(
                    PartnerCapability.GUIDE_LISTING,
                    PartnerCapability.GUIDE_PROMOTION,
                    PartnerCapability.GUIDE_INQUIRY))
            .build();

    return BusinessKindConfigDto.builder()
        .schemaVersion(1)
        .region(reg)
        .submitEnabled(submitEnabled)
        .kinds(List.of(hotel, restaurant, guide))
        .build();
  }

  public PartnerBusiness getBusiness(UUID businessId) {
    return businessRepository
        .findById(businessId)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "BUSINESS_NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND));
  }

  private void requireMemberRole(UUID businessId, UUID userId, MembershipRole requiredRole) {
    MembershipRole actualRole = getMemberRole(businessId, userId);
    if (actualRole != requiredRole && actualRole != MembershipRole.OWNER) {
      throw new TripServiceException(
          "FORBIDDEN", "Insufficient membership permissions for this business", HttpStatus.FORBIDDEN);
    }
  }

  private MembershipRole getMemberRole(UUID businessId, UUID userId) {
    return memberRepository
        .findByIdBusinessIdAndIdUserId(businessId, userId)
        .filter(m -> m.getState() == MembershipState.ACTIVE)
        .map(PartnerBusinessMember::getRole)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));
  }

  private boolean hasActiveCapability(UUID businessId, PartnerCapability capability) {
    if (capability == null) return false;
    return capabilityRepository.existsByIdBusinessIdAndIdCapabilityAndRevokedAtIsNull(
        businessId, capability);
  }

  private PartnerCapability getListingCapability(BusinessKind kind) {
    return switch (kind) {
      case HOTEL -> PartnerCapability.HOTEL_LISTING;
      case RESTAURANT -> PartnerCapability.RESTAURANT_LISTING;
      case TOUR_GUIDE -> PartnerCapability.GUIDE_LISTING;
    };
  }

  private PartnerCapability getIntakeCapability(BusinessKind kind) {
    return switch (kind) {
      case HOTEL -> PartnerCapability.HOTEL_BOOKING;
      case RESTAURANT -> PartnerCapability.RESTAURANT_MENU;
      case TOUR_GUIDE -> PartnerCapability.GUIDE_INQUIRY;
    };
  }

  private void validateRequestedCapabilities(
      BusinessKind kind, List<PartnerCapability> capabilities) {
    if (capabilities == null || capabilities.isEmpty()) {
      throw new TripServiceException(
          "CAPABILITIES_EMPTY", "Must request at least one capability", HttpStatus.BAD_REQUEST);
    }
    for (PartnerCapability cap : capabilities) {
      boolean valid =
          switch (kind) {
            case HOTEL -> cap == PartnerCapability.HOTEL_LISTING
                || cap == PartnerCapability.HOTEL_INVENTORY
                || cap == PartnerCapability.HOTEL_BOOKING;
            case RESTAURANT -> cap == PartnerCapability.RESTAURANT_LISTING
                || cap == PartnerCapability.RESTAURANT_MENU;
            case TOUR_GUIDE -> cap == PartnerCapability.GUIDE_LISTING
                || cap == PartnerCapability.GUIDE_PROMOTION
                || cap == PartnerCapability.GUIDE_INQUIRY;
          };
      if (!valid) {
        throw new TripServiceException(
            "INVALID_CAPABILITY_FOR_KIND",
            "Capability " + cap + " is not valid for business kind " + kind,
            HttpStatus.BAD_REQUEST);
      }
    }
  }

  private void recordAudit(
      UUID businessId,
      UUID applicationId,
      UUID actorId,
      String action,
      String reason,
      String fromState,
      String toState,
      Long businessVersion) {
    auditRepository.save(
        PartnerReviewAudit.builder()
            .businessId(businessId)
            .applicationId(applicationId)
            .actorId(actorId)
            .action(action)
            .reason(reason)
            .fromState(fromState)
            .toState(toState)
            .businessVersion(businessVersion != null ? businessVersion : 0L)
            .occurredAt(Instant.now())
            .build());
  }

  private BusinessDetailDto toBusinessDetailDto(PartnerBusiness b, MembershipRole myRole) {
    List<PartnerCapability> caps =
        capabilityRepository.findByIdBusinessId(b.getId()).stream()
            .filter(PartnerBusinessCapability::isActive)
            .map(c -> c.getId().getCapability())
            .toList();

    ApplicationState latestState =
        applicationRepository
            .findTopByBusinessIdOrderByRevisionDesc(b.getId())
            .map(PartnerApplication::getState)
            .orElse(null);

    boolean listingCap = caps.contains(getListingCapability(b.getKind()));
    boolean intakeCap = caps.contains(getIntakeCapability(b.getKind()));
    boolean publicEligible = b.isPublicEligible(listingCap);
    boolean newIntakeEligible = b.isNewIntakeEligible(publicEligible, intakeCap, true);

    return BusinessDetailDto.builder()
        .id(b.getId())
        .kind(b.getKind())
        .ownerUserId(b.getOwnerUserId())
        .displayName(b.getDisplayName())
        .draftProfile(b.getDraftProfileJson())
        .draftSchemaVersion(b.getDraftSchemaVersion())
        .approvalValidity(b.getApprovalValidity())
        .operationState(b.getOperationState())
        .publicationState(b.getPublicationState())
        .acceptingNew(b.isAcceptingNew())
        .requiresReverification(b.isRequiresReverification())
        .reverificationApplicationId(b.getReverificationApplicationId())
        .suspensionVersion(b.getSuspensionVersion())
        .suspendedAt(b.getSuspendedAt())
        .reinstatedAt(b.getReinstatedAt())
        .approvedRevisionId(b.getApprovedRevisionId())
        .version(b.getVersion())
        .contactConsentVersion(b.getContactConsentVersion())
        .myRole(myRole)
        .capabilities(caps)
        .latestApplicationState(latestState)
        .publicEligible(publicEligible)
        .newIntakeEligible(newIntakeEligible)
        .createdAt(b.getCreatedAt())
        .updatedAt(b.getUpdatedAt())
        .build();
  }

  private ApplicationDetailDto toApplicationDetailDto(PartnerApplication a) {
    Long bizVer =
        businessRepository.findById(a.getBusinessId()).map(PartnerBusiness::getVersion).orElse(0L);
    return ApplicationDetailDto.builder()
        .id(a.getId())
        .businessId(a.getBusinessId())
        .revision(a.getRevision())
        .profileSnapshot(a.getProfileSnapshot())
        .checklistId(a.getChecklistId())
        .checklistVersion(a.getChecklistVersion())
        .requestedCapabilities(a.getRequestedCapabilities())
        .state(a.getState())
        .isReverification(a.isReverification())
        .version(a.getVersion())
        .businessVersion(bizVer)
        .submittedAt(a.getSubmittedAt())
        .decidedAt(a.getDecidedAt())
        .createdAt(a.getCreatedAt())
        .updatedAt(a.getUpdatedAt())
        .build();
  }

  private String hashToken(String token) {
    try {
      java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
      byte[] hash = md.digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    } catch (Exception e) {
      throw new RuntimeException("Error hashing token", e);
    }
  }

  private String generateRandomSecret(int length) {
    byte[] bytes = new byte[length];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).substring(0, length);
  }
}
