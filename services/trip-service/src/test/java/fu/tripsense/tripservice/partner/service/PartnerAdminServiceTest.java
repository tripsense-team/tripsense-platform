package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class PartnerAdminServiceTest {

  @Mock private PartnerChecklistService checklistService;
  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerChecklistResultRepository checklistResultRepository;
  @Mock private PartnerReviewAuditRepository auditRepository;
  @Mock private PartnerManagementClaimRepository claimRepository;
  @Mock private PartnerOutboxService outboxService;

  @InjectMocks private PartnerAdminService adminService;

  private AuthenticatedUser adminUser;
  private UUID adminId;
  private UUID businessId;
  private UUID applicationId;

  @BeforeEach
  void setUp() {
    adminId = UUID.randomUUID();
    adminUser = new AuthenticatedUser(adminId, "admin@tripsense.com", "ROLE_ADMIN", List.of("ROLE_USER", "ROLE_ADMIN"));
    businessId = UUID.randomUUID();
    applicationId = UUID.randomUUID();
  }

  @Test
  @DisplayName("reviewDecision: blocks self-review if admin is a member of the business")
  void reviewDecision_selfReview_forbidden() {
    PartnerApplication app =
        PartnerApplication.builder()
            .id(applicationId)
            .businessId(businessId)
            .state(ApplicationState.SUBMITTED)
            .version(1L)
            .build();

    PartnerBusiness business =
        PartnerBusiness.builder().id(businessId).version(1L).build();

    when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(app));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, adminId, MembershipState.ACTIVE))
        .thenReturn(true);

    AdminReviewDecisionRequest request =
        new AdminReviewDecisionRequest(
            1L, 1L, "APPROVE", List.of(), List.of(), "Approved");

    assertThatThrownBy(() -> adminService.reviewDecision(adminUser, applicationId, request))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("SELF_REVIEW_NOT_ALLOWED");
          assertThat(tse.status()).isEqualTo(HttpStatus.FORBIDDEN);
        });

    verify(capabilityRepository, never()).save(any());
  }

  @Test
  @DisplayName("reviewDecision: fails if capability dependency is missing (HOTEL_BOOKING without HOTEL_INVENTORY)")
  void reviewDecision_missingCapabilityDependency_throwsBadRequest() {
    PartnerApplication app =
        PartnerApplication.builder()
            .id(applicationId)
            .businessId(businessId)
            .state(ApplicationState.SUBMITTED)
            .version(1L)
            .build();

    PartnerBusiness business =
        PartnerBusiness.builder().id(businessId).version(1L).build();

    when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(app));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, adminId, MembershipState.ACTIVE))
        .thenReturn(false);

    AdminReviewDecisionRequest request =
        new AdminReviewDecisionRequest(
            1L,
            1L,
            "APPROVE",
            List.of(),
            List.of(
                new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.HOTEL_LISTING, true, null),
                new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.HOTEL_BOOKING, true, null)),
            "Approved");

    assertThatThrownBy(() -> adminService.reviewDecision(adminUser, applicationId, request))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("CAPABILITY_DEPENDENCY_MISSING");
          assertThat(tse.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        });
  }

  @Test
  @DisplayName("reviewDecision: approving reverification application clears requiresReverification flag")
  void reviewDecision_approveReverification_clearsFlag() {
    PartnerApplication app =
        PartnerApplication.builder()
            .id(applicationId)
            .businessId(businessId)
            .state(ApplicationState.SUBMITTED)
            .isReverification(true)
            .version(1L)
            .build();

    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(UUID.randomUUID())
            .version(1L)
            .requiresReverification(true)
            .reverificationApplicationId(applicationId)
            .build();

    when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(app));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, adminId, MembershipState.ACTIVE))
        .thenReturn(false);
    when(applicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(businessRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    AdminReviewDecisionRequest request =
        new AdminReviewDecisionRequest(
            1L,
            1L,
            "APPROVE",
            List.of(),
            List.of(
                new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.HOTEL_LISTING, true, null),
                new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.HOTEL_INVENTORY, true, null),
                new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.HOTEL_BOOKING, true, null)),
            "Reverification verified");

    ApplicationDetailDto result = adminService.reviewDecision(adminUser, applicationId, request);

    assertThat(result.state()).isEqualTo(ApplicationState.APPROVED);
    assertThat(business.isRequiresReverification()).isFalse();
    assertThat(business.getReverificationApplicationId()).isNull();
    assertThat(business.getApprovalValidity()).isEqualTo(ApprovalValidity.VALID);
  }

  @Test
  @DisplayName("suspendBusiness: increments suspensionVersion monotonically, sets suspendedAt, hides and disables intake")
  void suspendBusiness_incrementsSuspensionVersionAndSetsSuspendedAt() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(UUID.randomUUID())
            .version(1L)
            .operationState(OperationState.ACTIVE)
            .publicationState(PublicationState.PUBLISHED)
            .acceptingNew(true)
            .suspensionVersion(0)
            .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    AdminSuspensionRequest request = new AdminSuspensionRequest(1L, "Regulatory investigation");

    adminService.suspendBusiness(adminUser, businessId, request);

    assertThat(business.getOperationState()).isEqualTo(OperationState.SUSPENDED);
    assertThat(business.getSuspensionVersion()).isEqualTo(1);
    assertThat(business.getSuspendedAt()).isNotNull();
    assertThat(business.getPublicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(business.isAcceptingNew()).isFalse();

    verify(businessRepository).save(business);
    verify(auditRepository).save(any(PartnerReviewAudit.class));
  }

  @Test
  @DisplayName("reinstateBusiness: sets ACTIVE, records reinstatedAt, keeps HIDDEN and intake false")
  void reinstateBusiness_setsActiveAndReinstatedAt() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(UUID.randomUUID())
            .version(1L)
            .operationState(OperationState.SUSPENDED)
            .publicationState(PublicationState.HIDDEN)
            .acceptingNew(false)
            .suspensionVersion(1)
            .suspendedAt(Instant.now().minusSeconds(3600))
            .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    AdminReinstatementRequest request =
        new AdminReinstatementRequest(1L, "Remediation verified", UUID.randomUUID());

    adminService.reinstateBusiness(adminUser, businessId, request);

    assertThat(business.getOperationState()).isEqualTo(OperationState.ACTIVE);
    assertThat(business.getReinstatedAt()).isNotNull();
    assertThat(business.getPublicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(business.isAcceptingNew()).isFalse();

    verify(businessRepository).save(business);
  }

  @Test
  @DisplayName("revokeCapabilities: cascades revocations correctly and unpublishes if listing capability is revoked")
  void revokeCapabilities_cascadesAndUnpublishes() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(UUID.randomUUID())
            .version(1L)
            .publicationState(PublicationState.PUBLISHED)
            .acceptingNew(true)
            .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability listingCap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.HOTEL_LISTING))
            .build();
    PartnerBusinessCapability invCap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.HOTEL_INVENTORY))
            .build();
    PartnerBusinessCapability bookCap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.HOTEL_BOOKING))
            .build();

    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.HOTEL_LISTING))
        .thenReturn(Optional.of(listingCap));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.HOTEL_INVENTORY))
        .thenReturn(Optional.of(invCap));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.HOTEL_BOOKING))
        .thenReturn(Optional.of(bookCap));

    AdminCapabilityRevocationRequest request =
        new AdminCapabilityRevocationRequest(1L, List.of(PartnerCapability.HOTEL_LISTING), "License expired");

    adminService.revokeCapabilities(adminUser, businessId, request);

    assertThat(listingCap.getRevokedAt()).isNotNull();
    assertThat(invCap.getRevokedAt()).isNotNull();
    assertThat(bookCap.getRevokedAt()).isNotNull();

    assertThat(business.getPublicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(business.isAcceptingNew()).isFalse();
    verify(businessRepository).save(business);
  }

  @Test
  @DisplayName("reviewManagementClaim: blocks review if admin is claimant or member of target business")
  void reviewManagementClaim_selfReview_forbidden() {
    UUID claimId = UUID.randomUUID();
    PartnerManagementClaim claim =
        PartnerManagementClaim.builder()
            .id(claimId)
            .applicantUserId(adminId)
            .targetBusinessId(businessId)
            .state(ManagementClaimState.SUBMITTED)
            .version(1L)
            .build();

    when(claimRepository.findById(claimId)).thenReturn(Optional.of(claim));

    ManagementClaimDecisionRequest request =
        new ManagementClaimDecisionRequest(1L, "RESOLVED_INVITATION", List.of(), "Invite issued");

    assertThatThrownBy(() -> adminService.reviewManagementClaim(adminUser, claimId, request))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("SELF_REVIEW_NOT_ALLOWED");
          assertThat(tse.status()).isEqualTo(HttpStatus.FORBIDDEN);
        });
  }
}
