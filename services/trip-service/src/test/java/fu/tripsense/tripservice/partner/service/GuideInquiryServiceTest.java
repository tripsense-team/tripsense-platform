package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class GuideInquiryServiceTest {

  @Mock private GuideInquiryRepository inquiryRepository;
  @Mock private GuideInquiryRequirementsRepository requirementsRepository;
  @Mock private GuideProposalRepository proposalRepository;
  @Mock private GuideInquiryEntryRepository entryRepository;
  @Mock private GuideInquiryBlockRepository blockRepository;
  @Mock private PartnerCustomerQuotaRepository quotaRepository;
  @Mock private PartnerInquiryContactConsentRepository consentRepository;
  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerGuidePromotionRepository promotionRepository;
  @Mock private PartnerOutboxService outboxService;

  @Spy
  private ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

  @InjectMocks private GuideInquiryService inquiryService;

  private AuthenticatedUser customerUser;
  private AuthenticatedUser guideOwnerUser;
  private UUID customerId;
  private UUID guideOwnerId;
  private UUID businessId;
  private UUID promotionId;
  private UUID approvedProfileRevId;
  private PartnerBusiness validBusiness;
  private PartnerGuidePromotion validPromotion;

  @BeforeEach
  void setUp() {
    customerId = UUID.randomUUID();
    guideOwnerId = UUID.randomUUID();
    businessId = UUID.randomUUID();
    promotionId = UUID.randomUUID();
    approvedProfileRevId = UUID.randomUUID();

    customerUser = new AuthenticatedUser(customerId, "customer@example.com", "ROLE_USER", List.of("ROLE_USER"));
    guideOwnerUser = new AuthenticatedUser(guideOwnerId, "guide@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));

    validBusiness = PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(guideOwnerId)
        .kind(BusinessKind.TOUR_GUIDE)
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(OperationState.ACTIVE)
        .publicationState(PublicationState.PUBLISHED)
        .acceptingNew(true)
        .requiresReverification(false)
        .approvedRevisionId(approvedProfileRevId)
        .suspensionVersion(0)
        .version(0L)
        .build();

    validPromotion = PartnerGuidePromotion.builder()
        .id(promotionId)
        .businessId(businessId)
        .approvedRevisionId(approvedProfileRevId)
        .publicationState(PublicationState.PUBLISHED)
        .version(0L)
        .build();
  }

  private GuideInquiryInput createValidInput() {
    return new GuideInquiryInput(
        promotionId,
        approvedProfileRevId,
        null,
        "area_hanoi",
        List.of("old_quarter"),
        List.of("walking"),
        "vi",
        LocalDate.now().plusDays(2),
        LocalDate.now().plusDays(3),
        "09:00",
        "Asia/Ho_Chi_Minh",
        180,
        2,
        0,
        "Explore Hanoi Old Quarter culinary and cultural spots",
        "Vegetarian food preferences",
        new BudgetRange(new BigDecimal("1000000"), new BigDecimal("2000000")));
  }

  @Test
  @DisplayName("Should successfully create inquiry and increment customer quota")
  void testCreateInquiry_Success() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_INQUIRY))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_INQUIRY)).build()));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, customerId)).thenReturn(Optional.empty());
    when(blockRepository.findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(businessId, customerId)).thenReturn(Optional.empty());
    when(inquiryRepository.findActiveInquiry(customerId, businessId)).thenReturn(Optional.empty());
    when(quotaRepository.findByIdCustomerIdAndIdQuotaDate(eq(customerId), any())).thenReturn(Optional.empty());
    when(promotionRepository.findById(promotionId)).thenReturn(Optional.of(validPromotion));

    GuideInquiryDto result = inquiryService.createInquiry(customerUser, businessId, createValidInput());

    assertThat(result).isNotNull();
    assertThat(result.state()).isEqualTo(GuideInquiryState.SUBMITTED);
    assertThat(result.guideBusinessId()).isEqualTo(businessId);
    assertThat(result.customerId()).isEqualTo(customerId);

    verify(inquiryRepository).save(any(GuideInquiry.class));
    verify(requirementsRepository).save(any(GuideInquiryRequirements.class));
    verify(entryRepository).save(any(GuideInquiryEntry.class));
    verify(quotaRepository).save(any(PartnerCustomerQuota.class));
    verify(outboxService).publish(eq("GUIDE_INQUIRY"), any(), eq("GuideInquirySubmitted"), any());
  }

  @Test
  @DisplayName("Should reject self-inquiry by guide owner or member")
  void testCreateInquiry_SelfInquiryBlocked() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_INQUIRY))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_INQUIRY)).build()));

    assertThatThrownBy(() -> inquiryService.createInquiry(guideOwnerUser, businessId, createValidInput()))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("SELF_INQUIRY_NOT_ALLOWED"));
  }

  @Test
  @DisplayName("Should reject duplicate active open inquiry for same customer and guide")
  void testCreateInquiry_DuplicateOpenInquiry() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_INQUIRY))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_INQUIRY)).build()));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, customerId)).thenReturn(Optional.empty());
    when(blockRepository.findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(businessId, customerId)).thenReturn(Optional.empty());

    GuideInquiry existing = GuideInquiry.builder().id(UUID.randomUUID()).state(GuideInquiryState.SUBMITTED).build();
    when(inquiryRepository.findActiveInquiry(customerId, businessId)).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> inquiryService.createInquiry(customerUser, businessId, createValidInput()))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("DUPLICATE_OPEN_INQUIRY"));
  }

  @Test
  @DisplayName("Should enforce daily quota limit of 5 new inquiries")
  void testCreateInquiry_DailyLimitReached() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_INQUIRY))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_INQUIRY)).build()));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, customerId)).thenReturn(Optional.empty());
    when(blockRepository.findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(businessId, customerId)).thenReturn(Optional.empty());
    when(inquiryRepository.findActiveInquiry(customerId, businessId)).thenReturn(Optional.empty());

    PartnerCustomerQuota fullQuota = PartnerCustomerQuota.builder()
        .id(new PartnerCustomerQuotaId(customerId, LocalDate.now(ZoneOffset.UTC)))
        .newInquiriesCount(5)
        .openInquiriesCount(3)
        .build();
    when(quotaRepository.findByIdCustomerIdAndIdQuotaDate(eq(customerId), any())).thenReturn(Optional.of(fullQuota));

    assertThatThrownBy(() -> inquiryService.createInquiry(customerUser, businessId, createValidInput()))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("INQUIRY_LIMIT_REACHED"));
  }

  @Test
  @DisplayName("Should reject inquiry if source revision changed")
  void testCreateInquiry_SourceRevisionMismatch() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_INQUIRY))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_INQUIRY)).build()));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, customerId)).thenReturn(Optional.empty());
    when(blockRepository.findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(businessId, customerId)).thenReturn(Optional.empty());
    when(inquiryRepository.findActiveInquiry(customerId, businessId)).thenReturn(Optional.empty());
    when(quotaRepository.findByIdCustomerIdAndIdQuotaDate(eq(customerId), any())).thenReturn(Optional.empty());

    PartnerGuidePromotion outdatedPromotion = PartnerGuidePromotion.builder()
        .id(promotionId)
        .businessId(businessId)
        .approvedRevisionId(UUID.randomUUID()) // different revision
        .publicationState(PublicationState.PUBLISHED)
        .build();
    when(promotionRepository.findById(promotionId)).thenReturn(Optional.of(outdatedPromotion));

    assertThatThrownBy(() -> inquiryService.createInquiry(customerUser, businessId, createValidInput()))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("SOURCE_CHANGED"));
  }

  @Test
  @DisplayName("Should transition from SUBMITTED to IN_DISCUSSION on message reply")
  void testAddMessage_SubmittedToInDiscussion() {
    UUID inquiryId = UUID.randomUUID();
    GuideInquiry inquiry = GuideInquiry.builder()
        .id(inquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.SUBMITTED)
        .version(0L)
        .currentRequirementsRevision(1)
        .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
        .build();

    when(inquiryRepository.findById(inquiryId)).thenReturn(Optional.of(inquiry));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(entryRepository.countByInquiryId(inquiryId)).thenReturn(1L);

    InquiryMessageRequest request = new InquiryMessageRequest(0L, "Hello, can we customize the walking tour?");
    GuideInquiryDto result = inquiryService.addMessage(customerUser, inquiryId, request);

    assertThat(inquiry.getState()).isEqualTo(GuideInquiryState.IN_DISCUSSION);
    verify(entryRepository).save(any(GuideInquiryEntry.class));
    verify(outboxService).publish(eq("GUIDE_INQUIRY"), eq(inquiryId), eq("GuideInquiryReplied"), any());
  }

  @Test
  @DisplayName("Should invalidate pending proposal when customer updates requirements")
  void testUpdateRequirements_InvalidatesPendingProposal() {
    UUID inquiryId = UUID.randomUUID();
    UUID proposalId = UUID.randomUUID();
    GuideInquiry inquiry = GuideInquiry.builder()
        .id(inquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.PROPOSAL_SENT)
        .currentProposalId(proposalId)
        .currentRequirementsRevision(1)
        .version(1L)
        .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
        .build();

    GuideProposal pendingProposal = GuideProposal.builder()
        .id(proposalId)
        .inquiryId(inquiryId)
        .revision(1)
        .requirementsRevision(1)
        .state(GuideProposalState.PENDING)
        .build();

    when(inquiryRepository.findById(inquiryId)).thenReturn(Optional.of(inquiry));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(proposalRepository.findById(proposalId)).thenReturn(Optional.of(pendingProposal));
    when(entryRepository.countByInquiryId(inquiryId)).thenReturn(3L);

    UpdateRequirementsRequest updateReq = new UpdateRequirementsRequest(
        1L,
        "area_hanoi",
        List.of("old_quarter", "french_quarter"),
        List.of("history"),
        "vi",
        LocalDate.now().plusDays(2),
        LocalDate.now().plusDays(3),
        "08:30",
        "Asia/Ho_Chi_Minh",
        240,
        3,
        0,
        "Updated requirements to include French quarter",
        null,
        new BudgetRange(new BigDecimal("1500000"), new BigDecimal("2500000")));

    GuideInquiryDto result = inquiryService.updateRequirements(customerUser, inquiryId, updateReq);

    assertThat(inquiry.getCurrentRequirementsRevision()).isEqualTo(2);
    assertThat(inquiry.getCurrentProposalId()).isNull();
    assertThat(inquiry.getState()).isEqualTo(GuideInquiryState.IN_DISCUSSION);
    assertThat(pendingProposal.getState()).isEqualTo(GuideProposalState.SUPERSEDED);

    verify(requirementsRepository).save(any(GuideInquiryRequirements.class));
    verify(proposalRepository).save(pendingProposal);
  }

  @Test
  @DisplayName("Should successfully send guide proposal with validUntil bound by inquiry expiration")
  void testSendProposal_Success() {
    UUID inquiryId = UUID.randomUUID();
    GuideInquiry inquiry = GuideInquiry.builder()
        .id(inquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.IN_DISCUSSION)
        .currentRequirementsRevision(2)
        .version(2L)
        .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
        .build();

    when(inquiryRepository.findById(inquiryId)).thenReturn(Optional.of(inquiry));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(proposalRepository.countByInquiryId(inquiryId)).thenReturn(0L);
    when(entryRepository.countByInquiryId(inquiryId)).thenReturn(4L);

    GuideProposalInput proposalInput = new GuideProposalInput(
        2L,
        2,
        "area_hanoi",
        List.of("old_quarter", "french_quarter"),
        List.of("history"),
        "vi",
        List.of(),
        "Detailed Hanoi walking tour covering both French and Old quarters",
        Instant.now().plus(2, ChronoUnit.DAYS),
        "Asia/Ho_Chi_Minh",
        240,
        "Itinerary program: Opera house -> St. Joseph -> Dong Xuan",
        List.of("Water", "Entrance tickets"),
        List.of("Lunch"),
        new BigDecimal("1800000"),
        Instant.now().plus(1, ChronoUnit.DAYS),
        new ProposalContactConsent(true, true, "v1.0"));

    GuideInquiryDto result = inquiryService.sendProposal(guideOwnerUser, inquiryId, proposalInput);

    assertThat(inquiry.getState()).isEqualTo(GuideInquiryState.PROPOSAL_SENT);
    assertThat(inquiry.getCurrentProposalId()).isNotNull();
    verify(proposalRepository).save(any(GuideProposal.class));
    verify(outboxService).publish(eq("GUIDE_INQUIRY"), eq(inquiryId), eq("GuideProposalSent"), any());
  }

  @Test
  @DisplayName("Should agree to proposal, record dynamic contact consent, and enter CONTACT_AGREED state")
  void testDecideProposal_AgreeToContact() {
    UUID inquiryId = UUID.randomUUID();
    UUID proposalId = UUID.randomUUID();
    GuideInquiry inquiry = GuideInquiry.builder()
        .id(inquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.PROPOSAL_SENT)
        .currentProposalId(proposalId)
        .currentRequirementsRevision(1)
        .version(3L)
        .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
        .build();

    GuideProposal proposal = GuideProposal.builder()
        .id(proposalId)
        .inquiryId(inquiryId)
        .revision(1)
        .requirementsRevision(1)
        .guideConsentSnapshot("{\"shareEmail\":true,\"sharePhone\":true,\"termsVersion\":\"v1.0\"}")
        .authorId(guideOwnerId)
        .validUntil(Instant.now().plus(2, ChronoUnit.DAYS))
        .state(GuideProposalState.PENDING)
        .build();

    when(inquiryRepository.findById(inquiryId)).thenReturn(Optional.of(inquiry));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));
    when(proposalRepository.findById(proposalId)).thenReturn(Optional.of(proposal));
    when(entryRepository.countByInquiryId(inquiryId)).thenReturn(5L);
    when(consentRepository.findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(any(), any(), any())).thenReturn(Optional.empty());

    ProposalDecisionRequest decisionReq = new ProposalDecisionRequest(
        3L,
        proposalId,
        "AGREE_TO_CONTACT",
        "Happy to proceed with the exchange",
        new ProposalContactConsent(true, false, "v1.0"));

    GuideInquiryDto result = inquiryService.decideProposal(customerUser, inquiryId, decisionReq);

    assertThat(inquiry.getState()).isEqualTo(GuideInquiryState.CONTACT_AGREED);
    assertThat(proposal.getState()).isEqualTo(GuideProposalState.ACCEPTED);

    // Verifies consent created
    verify(consentRepository, atLeast(2)).save(any(PartnerInquiryContactConsent.class));
    verify(outboxService).publish(eq("GUIDE_INQUIRY"), eq(inquiryId), eq("GuideContactAgreed"), any());
  }

  @Test
  @DisplayName("Should revoke contact consent dynamically and mask revoked channel on contact retrieval")
  void testRevokeContactConsent_DynamicMasking() {
    UUID inquiryId = UUID.randomUUID();
    GuideInquiry inquiry = GuideInquiry.builder()
        .id(inquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.CONTACT_AGREED)
        .build();

    when(inquiryRepository.findById(inquiryId)).thenReturn(Optional.of(inquiry));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(validBusiness));

    PartnerInquiryContactConsent existingConsent = PartnerInquiryContactConsent.builder()
        .id(new PartnerInquiryContactConsentId(inquiryId, guideOwnerId, ContactConsentChannel.EMAIL))
        .granteeUserId(customerId)
        .state(ContactConsentState.ACTIVE)
        .build();

    when(consentRepository.findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(inquiryId, guideOwnerId, ContactConsentChannel.EMAIL))
        .thenReturn(Optional.of(existingConsent));

    // Guide revokes email consent
    inquiryService.revokeContactConsent(guideOwnerUser, inquiryId, new RevokeConsentRequest(ContactConsentChannel.EMAIL, "Privacy preference"));
    assertThat(existingConsent.getState()).isEqualTo(ContactConsentState.REVOKED);
    assertThat(existingConsent.getRevokedAt()).isNotNull();

    // Now customer checks contacts
    when(consentRepository.findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(inquiryId, guideOwnerId, ContactConsentChannel.EMAIL))
        .thenReturn(Optional.of(existingConsent)); // returns REVOKED
    when(consentRepository.findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(inquiryId, guideOwnerId, ContactConsentChannel.PHONE))
        .thenReturn(Optional.empty());

    InquiryContactsDto contacts = inquiryService.getInquiryContacts(customerUser, inquiryId);

    assertThat(contacts.emailConsented()).isFalse();
    assertThat(contacts.email()).isNull();
    assertThat(contacts.phoneConsented()).isFalse();
    assertThat(contacts.phone()).isNull();
  }

  @Test
  @DisplayName("Should close in-flight inquiries during suspension fencing while preserving new inquiries")
  void testSuspensionFencing_InFlightInquiriesClosed_NewInquiriesPreserved() {
    UUID inFlightInquiryId = UUID.randomUUID();
    Instant suspendedAt = Instant.now().minus(1, ChronoUnit.HOURS);

    GuideInquiry inFlight = GuideInquiry.builder()
        .id(inFlightInquiryId)
        .guideBusinessId(businessId)
        .customerId(customerId)
        .state(GuideInquiryState.IN_DISCUSSION)
        .boundSuspensionVersion(0)
        .createdAt(suspendedAt.minus(10, ChronoUnit.MINUTES))
        .build();

    when(inquiryRepository.findInquiriesForSuspensionClosure(businessId, 1, suspendedAt))
        .thenReturn(List.of(inFlight));
    when(entryRepository.countByInquiryId(inFlightInquiryId)).thenReturn(2L);

    inquiryService.closeInquiriesForSuspension(businessId, 1, suspendedAt, "Regulatory investigation");

    assertThat(inFlight.getState()).isEqualTo(GuideInquiryState.CLOSED);
    assertThat(inFlight.getCloseReason()).contains("Regulatory investigation");
    verify(inquiryRepository).save(inFlight);
    verify(outboxService).publish(eq("GUIDE_INQUIRY"), eq(inFlightInquiryId), eq("GuideInquiryClosed"), any());
  }
}
