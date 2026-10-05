package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminCapabilityRevocationRequest;
import fu.tripsense.tripservice.partner.dto.AdminReinstatementRequest;
import fu.tripsense.tripservice.partner.dto.AdminReviewDecisionRequest;
import fu.tripsense.tripservice.partner.dto.AdminSuspensionRequest;
import fu.tripsense.tripservice.partner.dto.ApplicationDetailDto;
import fu.tripsense.tripservice.partner.dto.ManagementClaimDecisionRequest;
import fu.tripsense.tripservice.partner.dto.ManagementClaimDto;
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
public class PartnerAdminService {
  private final PartnerChecklistService checklistService;

  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerChecklistResultRepository checklistResultRepository;
  private final PartnerReviewAuditRepository auditRepository;
  private final PartnerManagementClaimRepository claimRepository;
  private final PartnerOutboxService outboxService;

  @Transactional
  public ApplicationDetailDto reviewDecision(
      AuthenticatedUser admin, UUID applicationId, AdminReviewDecisionRequest request) {
    requireAdmin(admin);

    PartnerApplication application =
        applicationRepository
            .findById(applicationId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "APPLICATION_NOT_FOUND", "Application not found", HttpStatus.NOT_FOUND));

    UUID businessId = application.getBusinessId();
    PartnerBusiness business =
        businessRepository
            .findById(businessId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "BUSINESS_NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND));

    // Self-review check: Admin cannot be owner or active member of the business
    if (memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
        businessId, admin.id(), MembershipState.ACTIVE)) {
      throw new TripServiceException(
          "SELF_REVIEW_NOT_ALLOWED",
          "Self-review is strictly forbidden: Reviewer is a member of the business being reviewed",
          HttpStatus.FORBIDDEN);
    }

    if ((request.expectedBusinessVersion() != null
            && !Objects.equals(business.getVersion(), request.expectedBusinessVersion()))
        || !Objects.equals(application.getVersion(), request.expectedApplicationVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Version conflict on business or application", HttpStatus.CONFLICT);
    }

    if (application.getState() != ApplicationState.SUBMITTED) {
      throw new TripServiceException(
          "INVALID_APPLICATION_STATE",
          "Application is not in SUBMITTED state",
          HttpStatus.CONFLICT);
    }

    if ("APPROVE".equalsIgnoreCase(request.decision())) checklistService.validateApproval(application,business,request);
    // Save checklist results only after approval invariants pass.
    if (request.checklistResults() != null) {
      for (AdminReviewDecisionRequest.ChecklistResultDto res : request.checklistResults()) {
        checklistResultRepository.save(
            PartnerChecklistResult.builder()
                .id(new ChecklistResultId(applicationId, res.code()))
                .result(res.result())
                .reason(res.reason())
                .actorId(admin.id())
                .build());
      }
    }

    String decision = request.decision().toUpperCase(Locale.ROOT);
    Instant now = Instant.now();

    if ("APPROVE".equals(decision)) {
      application.setState(ApplicationState.APPROVED);
      application.setDecidedAt(now);

      // Validate and grant requested capabilities
      Set<PartnerCapability> grantedCaps = new HashSet<>();
      if (request.capabilityDecisions() != null) {
        for (AdminReviewDecisionRequest.CapabilityDecisionDto capDec : request.capabilityDecisions()) {
          if (capDec.grant()) {
            grantedCaps.add(capDec.capability());
          }
        }
      }

      validateCapabilityDependencies(grantedCaps);

      // Persist capabilities
      for (PartnerCapability cap : grantedCaps) {
        PartnerBusinessCapability capability =
            PartnerBusinessCapability.builder()
                .id(new PartnerBusinessCapabilityId(businessId, cap))
                .applicationId(applicationId)
                .grantedAt(now)
                .grantedBy(admin.id())
                .build();
        capabilityRepository.save(capability);
      }

      business.setApprovalValidity(ApprovalValidity.VALID);
      business.setApprovedRevisionId(application.getId());

      if (application.isReverification()) {
        business.setRequiresReverification(false);
        business.setReverificationApplicationId(null);
      }

    } else if ("REQUEST_CHANGES".equals(decision)) {
      if (request.reason() == null || request.reason().isBlank()) {
        throw new TripServiceException(
            "REASON_REQUIRED", "Reason is required when requesting changes", HttpStatus.BAD_REQUEST);
      }
      application.setState(ApplicationState.CHANGES_REQUIRED);
      application.setDecidedAt(now);

    } else if ("REJECT".equals(decision)) {
      if (request.reason() == null || request.reason().isBlank()) {
        throw new TripServiceException(
            "REASON_REQUIRED", "Reason is required when rejecting application", HttpStatus.BAD_REQUEST);
      }
      application.setState(ApplicationState.REJECTED);
      application.setDecidedAt(now);

    } else {
      throw new TripServiceException(
          "INVALID_DECISION", "Decision must be APPROVE, REQUEST_CHANGES, or REJECT", HttpStatus.BAD_REQUEST);
    }

    application = applicationRepository.save(application);
    business = businessRepository.save(business);

    recordAudit(
        businessId,
        applicationId,
        admin.id(),
        "APPLICATION_" + decision,
        request.reason(),
        "SUBMITTED",
        application.getState().name(),
        business.getVersion());

    String outboxType =
        switch (decision) {
          case "APPROVE" -> "PartnerApplicationApproved";
          case "REQUEST_CHANGES" -> "PartnerChangesRequested";
          default -> "PartnerApplicationRejected";
        };

    outboxService.publish(
        "PARTNER_APPLICATION",
        applicationId,
        outboxType,
        Map.of(
            "businessId", businessId.toString(),
            "ownerId", business.getOwnerUserId() != null ? business.getOwnerUserId().toString() : "",
            "applicationId", applicationId.toString(),
            "decision", decision,
            "reason", request.reason() != null ? request.reason() : ""));

    return toApplicationDetailDto(application);
  }

  @Transactional
  public void suspendBusiness(AuthenticatedUser admin, UUID businessId, AdminSuspensionRequest request) {
    requireAdmin(admin);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    business.setOperationState(OperationState.SUSPENDED);
    business.setSuspensionVersion(business.getSuspensionVersion() + 1);
    business.setSuspendedAt(Instant.now());
    business.setPublicationState(PublicationState.HIDDEN);
    business.setAcceptingNew(false);

    businessRepository.save(business);

    recordAudit(
        businessId,
        null,
        admin.id(),
        "BUSINESS_SUSPENDED",
        request.reason(),
        "ACTIVE",
        "SUSPENDED",
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerBusinessSuspended",
        Map.of(
            "businessId", businessId.toString(),
            "ownerId", business.getOwnerUserId() != null ? business.getOwnerUserId().toString() : "",
            "suspensionVersion", business.getSuspensionVersion(),
            "suspendedAt", business.getSuspendedAt().toString(),
            "reason", request.reason()));
  }

  @Transactional
  public void reinstateBusiness(
      AuthenticatedUser admin, UUID businessId, AdminReinstatementRequest request) {
    requireAdmin(admin);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    business.setOperationState(OperationState.ACTIVE);
    business.setReinstatedAt(Instant.now());
    // Keeps publicationState = HIDDEN and acceptingNew = false (Owner must republish when ready)
    business.setPublicationState(PublicationState.HIDDEN);
    business.setAcceptingNew(false);

    businessRepository.save(business);

    recordAudit(
        businessId,
        request.remediationApplicationId(),
        admin.id(),
        "BUSINESS_REINSTATED",
        request.reason(),
        "SUSPENDED",
        "ACTIVE",
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerBusinessReinstated",
        Map.of(
            "businessId", businessId.toString(),
            "ownerId", business.getOwnerUserId() != null ? business.getOwnerUserId().toString() : "",
            "reinstatedAt", business.getReinstatedAt().toString(),
            "reason", request.reason()));
  }

  @Transactional
  public void revokeCapabilities(
      AuthenticatedUser admin, UUID businessId, AdminCapabilityRevocationRequest request) {
    requireAdmin(admin);
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    Set<PartnerCapability> toRevoke = new HashSet<>(request.capabilities());
    // Cascade revocations:
    if (toRevoke.contains(PartnerCapability.HOTEL_LISTING)) {
      toRevoke.add(PartnerCapability.HOTEL_INVENTORY);
      toRevoke.add(PartnerCapability.HOTEL_BOOKING);
    }
    if (toRevoke.contains(PartnerCapability.HOTEL_INVENTORY)) {
      toRevoke.add(PartnerCapability.HOTEL_BOOKING);
    }
    if (toRevoke.contains(PartnerCapability.RESTAURANT_LISTING)) {
      toRevoke.add(PartnerCapability.RESTAURANT_MENU);
    }
    if (toRevoke.contains(PartnerCapability.GUIDE_LISTING)) {
      toRevoke.add(PartnerCapability.GUIDE_PROMOTION);
      toRevoke.add(PartnerCapability.GUIDE_INQUIRY);
    }

    Instant now = Instant.now();
    for (PartnerCapability cap : toRevoke) {
      capabilityRepository
          .findByIdBusinessIdAndIdCapability(businessId, cap)
          .ifPresent(
              c -> {
                c.setRevokedAt(now);
                capabilityRepository.save(c);
              });
    }

    boolean listingRevoked =
        toRevoke.contains(PartnerCapability.HOTEL_LISTING)
            || toRevoke.contains(PartnerCapability.RESTAURANT_LISTING)
            || toRevoke.contains(PartnerCapability.GUIDE_LISTING);

    if (listingRevoked) {
      business.setPublicationState(PublicationState.HIDDEN);
      business.setAcceptingNew(false);
      businessRepository.save(business);
    } else {
      boolean intakeRevoked =
          toRevoke.contains(PartnerCapability.HOTEL_BOOKING)
              || toRevoke.contains(PartnerCapability.RESTAURANT_MENU)
              || toRevoke.contains(PartnerCapability.GUIDE_INQUIRY);
      if (intakeRevoked) {
        business.setAcceptingNew(false);
        businessRepository.save(business);
      }
    }

    recordAudit(
        businessId,
        null,
        admin.id(),
        "CAPABILITIES_REVOKED",
        request.reason() + " [Revoked: " + toRevoke + "]",
        null,
        null,
        business.getVersion());

    outboxService.publish(
        "PARTNER_BUSINESS",
        businessId,
        "PartnerCapabilitiesRevoked",
        Map.of(
            "businessId", businessId.toString(),
            "ownerId", business.getOwnerUserId() != null ? business.getOwnerUserId().toString() : "",
            "reason", request.reason(),
            "revokedCapabilities", toRevoke.stream().map(Enum::name).toList()));
  }

  @Transactional
  public ManagementClaimDto reviewManagementClaim(
      AuthenticatedUser admin, UUID claimId, ManagementClaimDecisionRequest request) {
    requireAdmin(admin);

    PartnerManagementClaim claim =
        claimRepository
            .findById(claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));

    // Self check: Admin cannot be the claimant or a member of the target business
    if (claim.getApplicantUserId().equals(admin.id())
        || memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
            claim.getTargetBusinessId(), admin.id(), MembershipState.ACTIVE)) {
      throw new TripServiceException(
          "SELF_REVIEW_NOT_ALLOWED",
          "Admin has a conflict of interest with the claim or target business",
          HttpStatus.FORBIDDEN);
    }

    if (!Objects.equals(claim.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Claim version conflict", HttpStatus.CONFLICT);
    }

    ManagementClaimState targetState = ManagementClaimState.valueOf(request.outcome());
    claim.setState(targetState);
    claim.setDecisionOutcome(request.outcome());
    claim.setDecisionReason(request.reason());
    claim.setDecidedBy(admin.id());
    claim.setDecidedAt(Instant.now());

    claim = claimRepository.save(claim);

    recordAudit(
        claim.getTargetBusinessId(),
        null,
        admin.id(),
        "MANAGEMENT_CLAIM_" + request.outcome(),
        request.reason(),
        "SUBMITTED",
        targetState.name(),
        0L);

    return toManagementClaimDto(claim);
  }

  private void validateCapabilityDependencies(Set<PartnerCapability> caps) {
    if (caps.contains(PartnerCapability.HOTEL_BOOKING)) {
      if (!caps.contains(PartnerCapability.HOTEL_LISTING)
          || !caps.contains(PartnerCapability.HOTEL_INVENTORY)) {
        throw new TripServiceException(
            "CAPABILITY_DEPENDENCY_MISSING",
            "HOTEL_BOOKING requires both HOTEL_LISTING and HOTEL_INVENTORY",
            HttpStatus.BAD_REQUEST);
      }
    }
    if (caps.contains(PartnerCapability.RESTAURANT_MENU)
        && !caps.contains(PartnerCapability.RESTAURANT_LISTING)) {
      throw new TripServiceException(
          "CAPABILITY_DEPENDENCY_MISSING",
          "RESTAURANT_MENU requires RESTAURANT_LISTING",
          HttpStatus.BAD_REQUEST);
    }
    if (caps.contains(PartnerCapability.GUIDE_PROMOTION)
        && !caps.contains(PartnerCapability.GUIDE_LISTING)) {
      throw new TripServiceException(
          "CAPABILITY_DEPENDENCY_MISSING",
          "GUIDE_PROMOTION requires GUIDE_LISTING",
          HttpStatus.BAD_REQUEST);
    }
    if (caps.contains(PartnerCapability.GUIDE_INQUIRY)
        && !caps.contains(PartnerCapability.GUIDE_LISTING)) {
      throw new TripServiceException(
          "CAPABILITY_DEPENDENCY_MISSING",
          "GUIDE_INQUIRY requires GUIDE_LISTING",
          HttpStatus.BAD_REQUEST);
    }
  }

  private PartnerBusiness getBusiness(UUID businessId) {
    return businessRepository
        .findById(businessId)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "BUSINESS_NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND));
  }

  public void requireAdmin(AuthenticatedUser user) {
    if (user == null || !user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "Admin permissions required", HttpStatus.FORBIDDEN);
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

  private ManagementClaimDto toManagementClaimDto(PartnerManagementClaim c) {
    return ManagementClaimDto.builder()
        .id(c.getId())
        .applicantUserId(c.getApplicantUserId())
        .targetBusinessId(c.getTargetBusinessId())
        .reason(c.getReason())
        .state(c.getState())
        .version(c.getVersion())
        .decisionOutcome(c.getDecisionOutcome())
        .decisionReason(c.getDecisionReason())
        .decidedBy(c.getDecidedBy())
        .decidedAt(c.getDecidedAt())
        .createdAt(c.getCreatedAt())
        .updatedAt(c.getUpdatedAt())
        .build();
  }
}
