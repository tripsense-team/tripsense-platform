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
class PartnerBusinessServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerReviewAuditRepository auditRepository;
  @Mock private PartnerInvitationRepository invitationRepository;
  @Mock private PartnerOutboxService outboxService;

  @InjectMocks private PartnerBusinessService businessService;

  private AuthenticatedUser ownerUser;
  private UUID ownerId;
  private UUID businessId;

  @BeforeEach
  void setUp() {
    ownerId = UUID.randomUUID();
    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    businessId = UUID.randomUUID();
  }

  @Test
  @DisplayName("createDraft: creates business and owner membership")
  void createDraft_success() {
    CreateBusinessDraftRequest request =
        new CreateBusinessDraftRequest(
            BusinessKind.HOTEL, "My Test Hotel", Map.of("destination", "Hoi An", "address", "123 Tran Phu"));

    when(businessRepository.save(any(PartnerBusiness.class)))
        .thenAnswer(inv -> {
          PartnerBusiness b = inv.getArgument(0);
          b.setId(businessId);
          b.setVersion(0L);
          return b;
        });

    BusinessDetailDto result = businessService.createDraft(ownerUser, request);

    assertThat(result).isNotNull();
    assertThat(result.id()).isEqualTo(businessId);
    assertThat(result.kind()).isEqualTo(BusinessKind.HOTEL);
    assertThat(result.displayName()).isEqualTo("My Test Hotel");
    assertThat(result.approvalValidity()).isEqualTo(ApprovalValidity.NONE);
    assertThat(result.publicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(result.acceptingNew()).isFalse();
    assertThat(result.requiresReverification()).isFalse();

    verify(memberRepository).save(any(PartnerBusinessMember.class));
    verify(auditRepository).save(any(PartnerReviewAudit.class));
  }

  @Test
  @DisplayName("createDraft: prevents duplicate TOUR_GUIDE profile for same owner")
  void createDraft_duplicateGuide_conflict() {
    CreateBusinessDraftRequest request =
        new CreateBusinessDraftRequest(BusinessKind.TOUR_GUIDE, "Guide John", Map.of());

    when(businessRepository.existsByOwnerUserIdAndKind(ownerId, BusinessKind.TOUR_GUIDE)).thenReturn(true);

    assertThatThrownBy(() -> businessService.createDraft(ownerUser, request))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("GUIDE_ALREADY_EXISTS");
          assertThat(tse.status()).isEqualTo(HttpStatus.CONFLICT);
        });

    verify(businessRepository, never()).save(any());
  }

  @Test
  @DisplayName("updatePublication: throws 409 REVERIFICATION_REQUIRED when requiresReverification is true")
  void updatePublication_reverificationRequired_throws409() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(ownerId)
            .kind(BusinessKind.HOTEL)
            .approvalValidity(ApprovalValidity.VALID)
            .operationState(OperationState.ACTIVE)
            .publicationState(PublicationState.HIDDEN)
            .requiresReverification(true)
            .version(1L)
            .build();

    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PublicationRequest req = new PublicationRequest(1L, "PUBLISHED");

    assertThatThrownBy(() -> businessService.updatePublication(ownerUser, businessId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("REVERIFICATION_REQUIRED");
          assertThat(tse.status()).isEqualTo(HttpStatus.CONFLICT);
        });
  }

  @Test
  @DisplayName("updateIntake: throws 409 REVERIFICATION_REQUIRED when requiresReverification is true")
  void updateIntake_reverificationRequired_throws409() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(ownerId)
            .kind(BusinessKind.HOTEL)
            .approvalValidity(ApprovalValidity.VALID)
            .operationState(OperationState.ACTIVE)
            .publicationState(PublicationState.PUBLISHED)
            .requiresReverification(true)
            .version(1L)
            .build();

    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    IntakeRequest req = new IntakeRequest(1L, true);

    assertThatThrownBy(() -> businessService.updateIntake(ownerUser, businessId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("REVERIFICATION_REQUIRED");
          assertThat(tse.status()).isEqualTo(HttpStatus.CONFLICT);
        });
  }

  @Test
  @DisplayName("declareMaterialChange: sets requiresReverification=true and immediately hides and pauses intake")
  void declareMaterialChange_locksAndHides() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(ownerId)
            .kind(BusinessKind.HOTEL)
            .approvalValidity(ApprovalValidity.VALID)
            .operationState(OperationState.ACTIVE)
            .publicationState(PublicationState.PUBLISHED)
            .acceptingNew(true)
            .requiresReverification(false)
            .version(1L)
            .build();

    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(businessRepository.save(any(PartnerBusiness.class))).thenAnswer(inv -> inv.getArgument(0));

    UUID revAppId = UUID.randomUUID();
    MaterialChangeRequest req = new MaterialChangeRequest(1L, "LOCATION", "Moved to new premises", revAppId);

    BusinessDetailDto result = businessService.declareMaterialChange(ownerUser, businessId, req);

    assertThat(result.requiresReverification()).isTrue();
    assertThat(result.reverificationApplicationId()).isEqualTo(revAppId);
    assertThat(result.publicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(result.acceptingNew()).isFalse();

    verify(auditRepository).save(any(PartnerReviewAudit.class));
  }

  @Test
  @DisplayName("submitApplication: creates immutable snapshot and transitions state")
  void submitApplication_validHotel_submits() {
    PartnerBusiness business =
        PartnerBusiness.builder()
            .id(businessId)
            .ownerUserId(ownerId)
            .kind(BusinessKind.HOTEL)
            .draftProfileJson(Map.of("destination", "Da Nang", "address", "456 Vo Nguyen Giap"))
            .version(1L)
            .build();

    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(applicationRepository.existsByBusinessIdAndState(businessId, ApplicationState.SUBMITTED)).thenReturn(false);
    when(applicationRepository.findTopByBusinessIdOrderByRevisionDesc(businessId)).thenReturn(Optional.empty());

    when(applicationRepository.save(any(PartnerApplication.class))).thenAnswer(inv -> {
      PartnerApplication app = inv.getArgument(0);
      app.setId(UUID.randomUUID());
      return app;
    });

    SubmitApplicationRequest req =
        new SubmitApplicationRequest(
            1L,
            "CHK-HOTEL-V1",
            "1.0",
            List.of(PartnerCapability.HOTEL_LISTING, PartnerCapability.HOTEL_INVENTORY),
            Map.of("destination", "Da Nang", "address", "456 Vo Nguyen Giap"),
            List.of(UUID.randomUUID()));

    ApplicationDetailDto appDto = businessService.submitApplication(ownerUser, businessId, req);

    assertThat(appDto).isNotNull();
    assertThat(appDto.revision()).isEqualTo(1);
    assertThat(appDto.state()).isEqualTo(ApplicationState.SUBMITTED);
    assertThat(appDto.requestedCapabilities()).contains("HOTEL_LISTING");
  }

  @Test
  @DisplayName("acceptInvitation: requires email matching and unexpired token")
  void acceptInvitation_success() throws Exception {
    String token = "valid-secret-token";
    String tokenHash = Base64.getUrlEncoder().withoutPadding().encodeToString(
        java.security.MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

    PartnerInvitation invitation =
        PartnerInvitation.builder()
            .id(UUID.randomUUID())
            .businessId(businessId)
            .recipientEmail("owner@example.com")
            .role(MembershipRole.MANAGER)
            .tokenHash(tokenHash)
            .state(InvitationState.PENDING)
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();

    when(invitationRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(invitation));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(
        PartnerBusiness.builder().id(businessId).ownerUserId(UUID.randomUUID()).kind(BusinessKind.HOTEL).build()));

    BusinessDetailDto result = businessService.acceptInvitation(ownerUser, token);

    assertThat(result).isNotNull();
    assertThat(invitation.getState()).isEqualTo(InvitationState.ACCEPTED);
    verify(memberRepository).save(any(PartnerBusinessMember.class));
  }

  @Test
  @DisplayName("getApplications: returns revisions for owner")
  void getApplications_success() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    PartnerApplication app =
        PartnerApplication.builder()
            .id(UUID.randomUUID())
            .businessId(businessId)
            .revision(1)
            .state(ApplicationState.SUBMITTED)
            .profileSnapshot(Map.of("destination", "Hoi An"))
            .requestedCapabilities(List.of("HOTEL_LISTING"))
            .build();

    when(applicationRepository.findByBusinessIdOrderByRevisionDesc(businessId)).thenReturn(List.of(app));

    List<ApplicationDetailDto> list = businessService.getApplications(ownerUser, businessId);

    assertThat(list).hasSize(1);
    assertThat(list.getFirst().revision()).isEqualTo(1);
    assertThat(list.getFirst().state()).isEqualTo(ApplicationState.SUBMITTED);
  }

  @Test
  @DisplayName("getCapabilities: returns active unrevoked capabilities")
  void getCapabilities_success() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.HOTEL_LISTING))
            .grantedAt(Instant.now())
            .grantedBy(UUID.randomUUID())
            .build();

    when(capabilityRepository.findByIdBusinessId(businessId)).thenReturn(List.of(cap));

    List<PartnerCapability> caps = businessService.getCapabilities(ownerUser, businessId);

    assertThat(caps).containsExactly(PartnerCapability.HOTEL_LISTING);
  }

  @Test
  @DisplayName("getBusinessKindConfig: returns kinds and submitEnabled for region")
  void getBusinessKindConfig_success() {
    BusinessKindConfigDto supported = businessService.getBusinessKindConfig("Hoi An");
    assertThat(supported.schemaVersion()).isEqualTo(1);
    assertThat(supported.submitEnabled()).isTrue();
    assertThat(supported.kinds()).hasSize(3);

    BusinessKindConfigDto unsupported = businessService.getBusinessKindConfig("Mars");
    assertThat(unsupported.submitEnabled()).isFalse();
  }
}
