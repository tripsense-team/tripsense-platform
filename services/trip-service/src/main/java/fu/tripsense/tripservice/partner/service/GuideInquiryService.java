package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.*;
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
public class GuideInquiryService {

  private final GuideInquiryRepository inquiryRepository;
  private final GuideInquiryRequirementsRepository requirementsRepository;
  private final GuideProposalRepository proposalRepository;
  private final GuideInquiryEntryRepository entryRepository;
  private final GuideInquiryBlockRepository blockRepository;
  private final PartnerCustomerQuotaRepository quotaRepository;
  private final PartnerInquiryContactConsentRepository consentRepository;
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerGuidePromotionRepository promotionRepository;
  private final PartnerOutboxService outboxService;
  private final ObjectMapper objectMapper;

  @Transactional
  public GuideInquiryDto createInquiry(
      AuthenticatedUser customer, UUID businessId, GuideInquiryInput input) {
    if (customer == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    PartnerBusiness business = getBusiness(businessId);
    if (business.getKind() != BusinessKind.TOUR_GUIDE) {
      throw new TripServiceException(
          "INVALID_BUSINESS_KIND", "Business is not a tour guide", HttpStatus.BAD_REQUEST);
    }
    if (business.getApprovalValidity() != ApprovalValidity.VALID) {
      throw new TripServiceException(
          "BUSINESS_NOT_APPROVED", "Guide business is not approved", HttpStatus.FORBIDDEN);
    }
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException(
          "BUSINESS_SUSPENDED", "Guide business is currently suspended", HttpStatus.FORBIDDEN);
    }
    if (!business.isAcceptingNew()) {
      throw new TripServiceException(
          "INTAKE_DISABLED", "Guide is not currently accepting new inquiries", HttpStatus.FORBIDDEN);
    }
    if (business.isRequiresReverification()) {
      throw new TripServiceException(
          "REVERIFICATION_REQUIRED", "Guide business requires reverification", HttpStatus.CONFLICT);
    }

    requireCapability(businessId, PartnerCapability.GUIDE_INQUIRY);

    // Anti-self-inquiry check: guide business owner or members cannot inquire themselves
    if (Objects.equals(business.getOwnerUserId(), customer.id())) {
      throw new TripServiceException(
          "SELF_INQUIRY_NOT_ALLOWED", "Guide owner cannot send inquiry to their own business", HttpStatus.FORBIDDEN);
    }
    boolean isMember = memberRepository.findByIdBusinessIdAndIdUserId(businessId, customer.id())
        .filter(m -> m.getState() == MembershipState.ACTIVE)
        .isPresent();
    if (isMember) {
      throw new TripServiceException(
          "SELF_INQUIRY_NOT_ALLOWED", "Staff/managers cannot send inquiry to their business", HttpStatus.FORBIDDEN);
    }

    // Check block
    if (blockRepository.findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(businessId, customer.id()).isPresent()) {
      throw new TripServiceException(
          "INQUIRY_BLOCKED", "Communication is blocked between this customer and guide", HttpStatus.FORBIDDEN);
    }

    // Quota check 1: max 1 active inquiry per customer per guide
    if (inquiryRepository.findActiveInquiry(customer.id(), businessId).isPresent()) {
      throw new TripServiceException(
          "DUPLICATE_OPEN_INQUIRY", "You already have an active inquiry with this guide", HttpStatus.CONFLICT);
    }

    // Quota check 2: daily limit 5, max open 10
    LocalDate todayUtc = LocalDate.now(ZoneOffset.UTC);
    PartnerCustomerQuota quota = quotaRepository
        .findByIdCustomerIdAndIdQuotaDate(customer.id(), todayUtc)
        .orElseGet(() -> PartnerCustomerQuota.builder()
            .id(new PartnerCustomerQuotaId(customer.id(), todayUtc))
            .newInquiriesCount(0)
            .openInquiriesCount(0)
            .build());

    if (quota.getNewInquiriesCount() >= 5) {
      throw new TripServiceException(
          "INQUIRY_LIMIT_REACHED", "Daily inquiry creation limit (5) reached", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (quota.getOpenInquiriesCount() >= 10) {
      throw new TripServiceException(
          "INQUIRY_LIMIT_REACHED", "Maximum open inquiries limit (10) reached", HttpStatus.TOO_MANY_REQUESTS);
    }

    // Source revision check
    if (input.promotionId() != null) {
      PartnerGuidePromotion promotion = promotionRepository.findById(input.promotionId())
          .orElseThrow(() -> new TripServiceException("NOT_FOUND", "Promotion not found", HttpStatus.NOT_FOUND));
      if (!Objects.equals(promotion.getBusinessId(), businessId)
          || promotion.getPublicationState() != PublicationState.PUBLISHED) {
        throw new TripServiceException("PROMOTION_NOT_AVAILABLE", "Promotion is not available", HttpStatus.BAD_REQUEST);
      }
      if (!Objects.equals(promotion.getApprovedRevisionId(), input.expectedSourceRevisionId())) {
        throw new TripServiceException("SOURCE_CHANGED", "Promotion source revision has changed", HttpStatus.CONFLICT);
      }
    } else {
      if (!Objects.equals(business.getApprovedRevisionId(), input.expectedSourceRevisionId())) {
        throw new TripServiceException("SOURCE_CHANGED", "Guide profile revision has changed", HttpStatus.CONFLICT);
      }
    }

    // Date validations
    ZoneId zone = ZoneId.of(input.timeZone() != null ? input.timeZone() : "UTC");
    LocalDate todayLocal = LocalDate.now(zone);
    if (input.dateFrom().isBefore(todayLocal)) {
      throw new TripServiceException("INVALID_INQUIRY_DATES", "dateFrom cannot be in the past", HttpStatus.BAD_REQUEST);
    }
    if (input.dateTo().isBefore(input.dateFrom())) {
      throw new TripServiceException("INVALID_INQUIRY_DATES", "dateTo cannot be before dateFrom", HttpStatus.BAD_REQUEST);
    }
    if (ChronoUnit.DAYS.between(input.dateFrom(), input.dateTo()) > 30) {
      throw new TripServiceException("INVALID_INQUIRY_DATES", "Inquiry date range cannot exceed 30 days", HttpStatus.BAD_REQUEST);
    }
    if (input.adults() + input.children() > 30) {
      throw new TripServiceException("GROUP_SIZE_EXCEEDED", "Total group size cannot exceed 30 persons", HttpStatus.BAD_REQUEST);
    }

    // Deadline calculation: min(submittedAt + 7 days, dateTo + preferredStartTime or end of dateTo)
    Instant submittedAt = Instant.now();
    Instant limit7Days = submittedAt.plus(7, ChronoUnit.DAYS);
    Instant tripLimit;
    if (input.preferredStartTime() != null) {
      LocalTime time = LocalTime.parse(input.preferredStartTime());
      tripLimit = input.dateTo().atTime(time).atZone(zone).toInstant();
    } else {
      tripLimit = input.dateTo().atTime(23, 59, 59).atZone(zone).toInstant();
    }
    Instant expiresAt = limit7Days.isBefore(tripLimit) ? limit7Days : tripLimit;
    if (expiresAt.isBefore(submittedAt)) {
      throw new TripServiceException("INVALID_INQUIRY_DATES", "Inquiry deadline has already passed", HttpStatus.BAD_REQUEST);
    }

    UUID inquiryId = UUID.randomUUID();
    String sourceSnapshotJson = writeJson(input);

    GuideInquiry inquiry =
        GuideInquiry.builder()
            .id(inquiryId)
            .guideBusinessId(businessId)
            .customerId(customer.id())
            .sourcePromotionId(input.promotionId())
            .sourceCommunityPostId(input.sourceCommunityPostId())
            .sourceRevisionSnapshot(sourceSnapshotJson)
            .state(GuideInquiryState.SUBMITTED)
            .boundSuspensionVersion(business.getSuspensionVersion())
            .currentRequirementsRevision(1)
            .expiresAt(expiresAt)
            .build();
    inquiryRepository.save(inquiry);

    GuideInquiryRequirements requirements =
        GuideInquiryRequirements.builder()
            .id(new GuideInquiryRequirementsId(inquiryId, 1))
            .data(sourceSnapshotJson)
            .createdBy(customer.id())
            .build();
    requirementsRepository.save(requirements);

    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(1)
            .actorId(customer.id())
            .roleSnapshot("CUSTOMER")
            .kind(GuideInquiryEntryKind.QUESTION)
            .body(input.goals())
            .build();
    entryRepository.save(entry);

    quota.setNewInquiriesCount(quota.getNewInquiriesCount() + 1);
    quota.setOpenInquiriesCount(quota.getOpenInquiriesCount() + 1);
    quotaRepository.save(quota);

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideInquirySubmitted",
        Map.of(
            "inquiryId", inquiryId.toString(),
            "businessId", businessId.toString(),
            "customerId", customer.id().toString(),
            "expiresAt", expiresAt.toString()));

    return toDto(inquiry, requirements, null, List.of(entry));
  }

  @Transactional(readOnly = true)
  public List<GuideInquiryDto> listCustomerInquiries(
      AuthenticatedUser customer, GuideInquiryState state) {
    if (customer == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    List<GuideInquiry> inquiries = state != null
        ? inquiryRepository.findByCustomerIdAndStateOrderByCreatedAtDesc(customer.id(), state)
        : inquiryRepository.findByCustomerIdOrderByCreatedAtDesc(customer.id());

    return inquiries.stream().map(this::loadAndMapDto).toList();
  }

  @Transactional(readOnly = true)
  public List<GuideInquiryDto> listBusinessInquiries(
      AuthenticatedUser user, UUID businessId, GuideInquiryState state) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    List<GuideInquiry> inquiries = state != null
        ? inquiryRepository.findByGuideBusinessIdAndStateOrderByCreatedAtDesc(businessId, state)
        : inquiryRepository.findByGuideBusinessIdOrderByCreatedAtDesc(businessId);

    return inquiries.stream().map(this::loadAndMapDto).toList();
  }

  @Transactional
  public GuideInquiryDto getInquiry(AuthenticatedUser user, UUID inquiryId) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    requireInquiryParty(user, inquiry);

    // Dynamic expiry evaluation
    if (!inquiry.getState().isTerminal() && inquiry.getExpiresAt().isBefore(Instant.now())) {
      inquiry.setState(GuideInquiryState.EXPIRED);
      inquiry.setCloseReason("INQUIRY_EXPIRED");
      inquiryRepository.save(inquiry);
      decrementOpenQuota(inquiry.getCustomerId());
    }

    // Dynamic suspension fencing evaluation
    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (!inquiry.getState().isTerminal()
        && business.getOperationState() == OperationState.SUSPENDED
        && business.getSuspendedAt() != null
        && inquiry.getCreatedAt().isBefore(business.getSuspendedAt().plusSeconds(1))
        && inquiry.getBoundSuspensionVersion() <= business.getSuspensionVersion()) {
      inquiry.setState(GuideInquiryState.CLOSED);
      inquiry.setCloseReason("SUSPENDED_DURING_INQUIRY");
      inquiryRepository.save(inquiry);
      decrementOpenQuota(inquiry.getCustomerId());
    }

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public GuideInquiryDto addMessage(
      AuthenticatedUser user, UUID inquiryId, InquiryMessageRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    String role = requireInquiryParty(user, inquiry);

    if (!Objects.equals(inquiry.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is in a terminal state", HttpStatus.CONFLICT);
    }

    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Business is suspended", HttpStatus.FORBIDDEN);
    }

    long entryCount = entryRepository.countByInquiryId(inquiryId);
    if (entryCount >= 50) {
      throw new TripServiceException(
          "MAX_MESSAGES_EXCEEDED", "Discussion limit (50 messages) reached for this inquiry", HttpStatus.BAD_REQUEST);
    }

    if (inquiry.getState() == GuideInquiryState.SUBMITTED) {
      inquiry.setState(GuideInquiryState.IN_DISCUSSION);
      inquiryRepository.save(inquiry);
    }

    int nextSeq = (int) entryCount + 1;
    GuideInquiryEntryKind kind = "CUSTOMER".equals(role)
        ? GuideInquiryEntryKind.QUESTION
        : GuideInquiryEntryKind.REPLY;

    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(user.id())
            .roleSnapshot(role)
            .kind(kind)
            .body(request.body().trim())
            .build();
    entryRepository.save(entry);

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideInquiryReplied",
        Map.of("inquiryId", inquiryId.toString(), "senderId", user.id().toString(), "role", role));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public GuideInquiryDto updateRequirements(
      AuthenticatedUser customer, UUID inquiryId, UpdateRequirementsRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    if (!Objects.equals(inquiry.getCustomerId(), customer.id())) {
      throw new TripServiceException("FORBIDDEN", "Only the customer can update requirements", HttpStatus.FORBIDDEN);
    }
    if (!Objects.equals(inquiry.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is in a terminal state", HttpStatus.CONFLICT);
    }

    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Business is suspended", HttpStatus.FORBIDDEN);
    }

    int newRevision = inquiry.getCurrentRequirementsRevision() + 1;
    String dataJson = writeJson(request);

    GuideInquiryRequirements requirements =
        GuideInquiryRequirements.builder()
            .id(new GuideInquiryRequirementsId(inquiryId, newRevision))
            .data(dataJson)
            .createdBy(customer.id())
            .build();
    requirementsRepository.save(requirements);

    // Invalidate current proposal if exists
    if (inquiry.getCurrentProposalId() != null) {
      proposalRepository.findById(inquiry.getCurrentProposalId()).ifPresent(p -> {
        p.setState(GuideProposalState.SUPERSEDED);
        proposalRepository.save(p);
      });
      inquiry.setCurrentProposalId(null);
      if (inquiry.getState() == GuideInquiryState.PROPOSAL_SENT) {
        inquiry.setState(GuideInquiryState.IN_DISCUSSION);
      }
    }

    inquiry.setCurrentRequirementsRevision(newRevision);
    inquiryRepository.save(inquiry);

    int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(customer.id())
            .roleSnapshot("CUSTOMER")
            .kind(GuideInquiryEntryKind.REQUIREMENTS_CHANGED)
            .body("Customer updated inquiry requirements (revision " + newRevision + ")")
            .build();
    entryRepository.save(entry);

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideInquiryReplied",
        Map.of("inquiryId", inquiryId.toString(), "revision", newRevision));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public GuideInquiryDto sendProposal(
      AuthenticatedUser user, UUID inquiryId, GuideProposalInput input) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    requireMember(user, inquiry.getGuideBusinessId(), Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    if (!Objects.equals(inquiry.getVersion(), input.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is in a terminal state", HttpStatus.CONFLICT);
    }

    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Business is suspended", HttpStatus.FORBIDDEN);
    }

    if (!Objects.equals(inquiry.getCurrentRequirementsRevision(), input.requirementsRevision())) {
      throw new TripServiceException(
          "REQUIREMENTS_CHANGED", "Requirements revision mismatch. Customer updated requirements.", HttpStatus.CONFLICT);
    }

    Instant now = Instant.now();
    if (input.validUntil().isBefore(now)) {
      throw new TripServiceException("INVALID_PROPOSAL_VALIDITY", "validUntil cannot be in the past", HttpStatus.BAD_REQUEST);
    }
    if (input.validUntil().isAfter(inquiry.getExpiresAt())) {
      throw new TripServiceException("INVALID_PROPOSAL_VALIDITY", "validUntil cannot exceed inquiry expiration", HttpStatus.BAD_REQUEST);
    }
    if (input.validUntil().isAfter(input.proposedStartAt())) {
      throw new TripServiceException("INVALID_PROPOSAL_VALIDITY", "validUntil cannot exceed proposed start date", HttpStatus.BAD_REQUEST);
    }

    // Invalidate any previous proposal
    if (inquiry.getCurrentProposalId() != null) {
      proposalRepository.findById(inquiry.getCurrentProposalId()).ifPresent(p -> {
        p.setState(GuideProposalState.SUPERSEDED);
        proposalRepository.save(p);
      });
    }

    UUID proposalId = UUID.randomUUID();
    int proposalRevision = (int) proposalRepository.countByInquiryId(inquiryId) + 1;

    GuideProposal proposal =
        GuideProposal.builder()
            .id(proposalId)
            .inquiryId(inquiryId)
            .revision(proposalRevision)
            .requirementsRevision(input.requirementsRevision())
            .proposalData(writeJson(input))
            .guideConsentSnapshot(writeJson(input.contactConsent()))
            .authorId(user.id())
            .validUntil(input.validUntil())
            .state(GuideProposalState.PENDING)
            .build();
    proposalRepository.save(proposal);

    inquiry.setCurrentProposalId(proposalId);
    inquiry.setState(GuideInquiryState.PROPOSAL_SENT);
    inquiryRepository.save(inquiry);

    int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(user.id())
            .roleSnapshot("GUIDE")
            .kind(GuideInquiryEntryKind.PROPOSAL)
            .body("Guide submitted proposal revision " + proposalRevision)
            .build();
    entryRepository.save(entry);

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideProposalSent",
        Map.of("inquiryId", inquiryId.toString(), "proposalId", proposalId.toString(), "revision", proposalRevision));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public GuideInquiryDto decideProposal(
      AuthenticatedUser customer, UUID inquiryId, ProposalDecisionRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    if (!Objects.equals(inquiry.getCustomerId(), customer.id())) {
      throw new TripServiceException("FORBIDDEN", "Only the customer can decide on proposals", HttpStatus.FORBIDDEN);
    }
    if (!Objects.equals(inquiry.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is in a terminal state", HttpStatus.CONFLICT);
    }

    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Business is suspended", HttpStatus.FORBIDDEN);
    }

    GuideProposal proposal = proposalRepository.findById(request.proposalId())
        .orElseThrow(() -> new TripServiceException("NOT_FOUND", "Proposal not found", HttpStatus.NOT_FOUND));

    if (!Objects.equals(inquiry.getCurrentProposalId(), proposal.getId())) {
      throw new TripServiceException("STALE_PROPOSAL", "Proposal is not the current active proposal", HttpStatus.CONFLICT);
    }
    if (proposal.getState() != GuideProposalState.PENDING) {
      throw new TripServiceException("STALE_PROPOSAL", "Proposal is not in pending state", HttpStatus.CONFLICT);
    }
    if (proposal.getValidUntil().isBefore(Instant.now())) {
      proposal.setState(GuideProposalState.EXPIRED);
      proposalRepository.save(proposal);
      throw new TripServiceException("PROPOSAL_EXPIRED", "Proposal validity has expired", HttpStatus.CONFLICT);
    }
    if (inquiry.getExpiresAt().isBefore(Instant.now())) {
      inquiry.setState(GuideInquiryState.EXPIRED);
      inquiryRepository.save(inquiry);
      decrementOpenQuota(customer.id());
      throw new TripServiceException("INQUIRY_EXPIRED", "Inquiry deadline has expired", HttpStatus.CONFLICT);
    }

    if ("REQUEST_REVISION".equals(request.action())) {
      proposal.setState(GuideProposalState.SUPERSEDED);
      proposalRepository.save(proposal);
      inquiry.setState(GuideInquiryState.IN_DISCUSSION);
      inquiryRepository.save(inquiry);

      int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
      GuideInquiryEntry entry =
          GuideInquiryEntry.builder()
              .id(UUID.randomUUID())
              .inquiryId(inquiryId)
              .seq(nextSeq)
              .actorId(customer.id())
              .roleSnapshot("CUSTOMER")
              .kind(GuideInquiryEntryKind.QUESTION)
              .body(request.note() != null ? request.note() : "Customer requested proposal revision")
              .build();
      entryRepository.save(entry);

      outboxService.publish(
          "GUIDE_INQUIRY", inquiryId, "GuideInquiryReplied", Map.of("inquiryId", inquiryId.toString()));

      return loadAndMapDto(inquiry);
    }

    // AGREE_TO_CONTACT
    if (request.contactConsent() == null
        || (!request.contactConsent().shareEmail() && !request.contactConsent().sharePhone())) {
      throw new TripServiceException(
          "CONSENT_REQUIRED", "At least one contact channel (email or phone) must be consented", HttpStatus.BAD_REQUEST);
    }

    ProposalContactConsent guideConsent =
        readJson(proposal.getGuideConsentSnapshot(), ProposalContactConsent.class);
    if (guideConsent == null || (!guideConsent.shareEmail() && !guideConsent.sharePhone())) {
      throw new TripServiceException(
          "CONSENT_REQUIRED", "Guide has not provided valid contact consent", HttpStatus.CONFLICT);
    }

    UUID guideOwnerId = business.getOwnerUserId();

    // Customer grants to Guide Owner
    if (request.contactConsent().shareEmail()) {
      saveConsent(inquiryId, customer.id(), ContactConsentChannel.EMAIL, guideOwnerId);
    }
    if (request.contactConsent().sharePhone()) {
      saveConsent(inquiryId, customer.id(), ContactConsentChannel.PHONE, guideOwnerId);
    }

    // Guide Owner grants to Customer
    if (guideConsent.shareEmail()) {
      saveConsent(inquiryId, guideOwnerId, ContactConsentChannel.EMAIL, customer.id());
    }
    if (guideConsent.sharePhone()) {
      saveConsent(inquiryId, guideOwnerId, ContactConsentChannel.PHONE, customer.id());
    }

    proposal.setState(GuideProposalState.ACCEPTED);
    proposalRepository.save(proposal);

    inquiry.setState(GuideInquiryState.CONTACT_AGREED);
    inquiryRepository.save(inquiry);

    int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(customer.id())
            .roleSnapshot("CUSTOMER")
            .kind(GuideInquiryEntryKind.DECISION)
            .body("Customer agreed to proposal. Contact sharing enabled.")
            .build();
    entryRepository.save(entry);

    decrementOpenQuota(customer.id());

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideContactAgreed",
        Map.of("inquiryId", inquiryId.toString(), "proposalId", proposal.getId().toString()));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public void revokeContactConsent(
      AuthenticatedUser user, UUID inquiryId, RevokeConsentRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    requireInquiryParty(user, inquiry);

    PartnerInquiryContactConsent consent =
        consentRepository
            .findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(inquiryId, user.id(), request.channel())
            .orElseGet(
                () ->
                    PartnerInquiryContactConsent.builder()
                        .id(new PartnerInquiryContactConsentId(inquiryId, user.id(), request.channel()))
                        .granteeUserId(
                            Objects.equals(user.id(), inquiry.getCustomerId())
                                ? getBusiness(inquiry.getGuideBusinessId()).getOwnerUserId()
                                : inquiry.getCustomerId())
                        .build());

    consent.setState(ContactConsentState.REVOKED);
    consent.setRevokedAt(Instant.now());
    consent.setRevokedReason(request.reason());
    consentRepository.save(consent);

    outboxService.publish(
        "GUIDE_INQUIRY",
        inquiryId,
        "GuideInquiryContactConsentRevoked",
        Map.of(
            "inquiryId", inquiryId.toString(),
            "grantorId", user.id().toString(),
            "channel", request.channel().name()));
  }

  @Transactional(readOnly = true)
  public InquiryContactsDto getInquiryContacts(AuthenticatedUser user, UUID inquiryId) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    requireInquiryParty(user, inquiry);

    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    boolean isCustomer = Objects.equals(user.id(), inquiry.getCustomerId());
    UUID counterpartyId = isCustomer ? business.getOwnerUserId() : inquiry.getCustomerId();

    boolean emailConsented =
        consentRepository
            .findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(
                inquiryId, counterpartyId, ContactConsentChannel.EMAIL)
            .filter(c -> c.getState() == ContactConsentState.ACTIVE)
            .isPresent();

    boolean phoneConsented =
        consentRepository
            .findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(
                inquiryId, counterpartyId, ContactConsentChannel.PHONE)
            .filter(c -> c.getState() == ContactConsentState.ACTIVE)
            .isPresent();

    String counterpartyEmail = emailConsented
        ? (isCustomer ? "guide-" + business.getId().toString().substring(0, 8) + "@partner.tripsense.vn" : "customer-" + inquiry.getCustomerId().toString().substring(0, 8) + "@user.tripsense.vn")
        : null;

    String counterpartyPhone = phoneConsented
        ? (isCustomer ? "+84900000000" : "+84911111111")
        : null;

    String notice = (!emailConsented && !phoneConsented)
        ? "Contact details are currently masked because no active consent was granted or consent has been revoked."
        : "Contact exchange active.";

    return new InquiryContactsDto(
        inquiryId, counterpartyId, counterpartyEmail, emailConsented, counterpartyPhone, phoneConsented, notice);
  }

  @Transactional
  public GuideInquiryDto withdrawInquiry(
      AuthenticatedUser customer, UUID inquiryId, WithdrawInquiryRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    if (!Objects.equals(inquiry.getCustomerId(), customer.id())) {
      throw new TripServiceException("FORBIDDEN", "Only the customer can withdraw the inquiry", HttpStatus.FORBIDDEN);
    }
    if (inquiry.getState() == GuideInquiryState.WITHDRAWN) {
      return loadAndMapDto(inquiry);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is already in a terminal state", HttpStatus.CONFLICT);
    }
    if (!Objects.equals(inquiry.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }

    inquiry.setState(GuideInquiryState.WITHDRAWN);
    inquiry.setCloseReason(request.reason() != null ? request.reason() : "Customer withdrawn");
    inquiryRepository.save(inquiry);

    decrementOpenQuota(customer.id());

    int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(customer.id())
            .roleSnapshot("CUSTOMER")
            .kind(GuideInquiryEntryKind.DECISION)
            .body("Inquiry withdrawn by customer. Reason: " + inquiry.getCloseReason())
            .build();
    entryRepository.save(entry);

    outboxService.publish(
        "GUIDE_INQUIRY", inquiryId, "GuideInquiryClosed", Map.of("inquiryId", inquiryId.toString(), "reason", "WITHDRAWN"));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public GuideInquiryDto declineInquiry(
      AuthenticatedUser user, UUID inquiryId, DeclineInquiryRequest request) {
    GuideInquiry inquiry = getInquiryEntity(inquiryId);
    requireMember(user, inquiry.getGuideBusinessId(), Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    if (inquiry.getState() == GuideInquiryState.DECLINED) {
      return loadAndMapDto(inquiry);
    }
    if (inquiry.getState().isTerminal()) {
      throw new TripServiceException("INQUIRY_TERMINAL", "Inquiry is already in a terminal state", HttpStatus.CONFLICT);
    }
    if (!Objects.equals(inquiry.getVersion(), request.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Inquiry version conflict", HttpStatus.CONFLICT);
    }

    inquiry.setState(GuideInquiryState.DECLINED);
    inquiry.setCloseReason(request.reason());
    inquiryRepository.save(inquiry);

    decrementOpenQuota(inquiry.getCustomerId());

    int nextSeq = (int) entryRepository.countByInquiryId(inquiryId) + 1;
    GuideInquiryEntry entry =
        GuideInquiryEntry.builder()
            .id(UUID.randomUUID())
            .inquiryId(inquiryId)
            .seq(nextSeq)
            .actorId(user.id())
            .roleSnapshot("GUIDE")
            .kind(GuideInquiryEntryKind.DECISION)
            .body("Inquiry declined by guide. Reason: " + request.reason())
            .build();
    entryRepository.save(entry);

    outboxService.publish(
        "GUIDE_INQUIRY", inquiryId, "GuideInquiryClosed", Map.of("inquiryId", inquiryId.toString(), "reason", "DECLINED"));

    return loadAndMapDto(inquiry);
  }

  @Transactional
  public void customerBlockGuide(
      AuthenticatedUser customer, UUID guideBusinessId, InquiryBlockRequest request) {
    if (customer == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    GuideInquiryBlock block =
        GuideInquiryBlock.builder()
            .id(new GuideInquiryBlockId(guideBusinessId, customer.id(), BlockSide.CUSTOMER))
            .actorId(customer.id())
            .reason(request != null ? request.reason() : null)
            .isActive(true)
            .build();
    blockRepository.save(block);

    // Close any active open inquiries between them
    inquiryRepository.findActiveInquiry(customer.id(), guideBusinessId).ifPresent(i -> {
      i.setState(GuideInquiryState.CLOSED);
      i.setCloseReason("CUSTOMER_BLOCKED");
      inquiryRepository.save(i);
      decrementOpenQuota(customer.id());
    });
  }

  @Transactional
  public void customerUnblockGuide(AuthenticatedUser customer, UUID guideBusinessId) {
    if (customer == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    blockRepository
        .findById(new GuideInquiryBlockId(guideBusinessId, customer.id(), BlockSide.CUSTOMER))
        .ifPresent(b -> {
          b.setActive(false);
          blockRepository.save(b);
        });
  }

  @Transactional(readOnly = true)
  public List<GuideInquiryBlockDto> listCustomerBlocks(AuthenticatedUser customer) {
    if (customer == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    return blockRepository.findByIdCustomerIdAndIsActiveTrue(customer.id()).stream()
        .map(b -> new GuideInquiryBlockDto(
            b.getId().getGuideBusinessId(),
            b.getId().getCustomerId(),
            b.getId().getBlockedBySide(),
            b.getActorId(),
            b.getReason(),
            b.isActive(),
            b.getCreatedAt()))
        .toList();
  }

  @Transactional
  public void guideBlockCustomer(
      AuthenticatedUser user, UUID guideBusinessId, UUID customerId, InquiryBlockRequest request) {
    requireMember(user, guideBusinessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    GuideInquiryBlock block =
        GuideInquiryBlock.builder()
            .id(new GuideInquiryBlockId(guideBusinessId, customerId, BlockSide.GUIDE))
            .actorId(user.id())
            .reason(request != null ? request.reason() : null)
            .isActive(true)
            .build();
    blockRepository.save(block);

    // Close any active open inquiries between them
    inquiryRepository.findActiveInquiry(customerId, guideBusinessId).ifPresent(i -> {
      i.setState(GuideInquiryState.CLOSED);
      i.setCloseReason("GUIDE_BLOCKED");
      inquiryRepository.save(i);
      decrementOpenQuota(customerId);
    });
  }

  @Transactional
  public void guideUnblockCustomer(AuthenticatedUser user, UUID guideBusinessId, UUID customerId) {
    requireMember(user, guideBusinessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    blockRepository
        .findById(new GuideInquiryBlockId(guideBusinessId, customerId, BlockSide.GUIDE))
        .ifPresent(b -> {
          b.setActive(false);
          blockRepository.save(b);
        });
  }

  @Transactional(readOnly = true)
  public List<GuideInquiryBlockDto> listGuideBlocks(AuthenticatedUser user, UUID guideBusinessId) {
    requireMember(user, guideBusinessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    return blockRepository.findByIdGuideBusinessIdAndIsActiveTrue(guideBusinessId).stream()
        .map(b -> new GuideInquiryBlockDto(
            b.getId().getGuideBusinessId(),
            b.getId().getCustomerId(),
            b.getId().getBlockedBySide(),
            b.getActorId(),
            b.getReason(),
            b.isActive(),
            b.getCreatedAt()))
        .toList();
  }

  @Transactional
  public void closeInquiriesForSuspension(
      UUID businessId, int suspensionVersion, Instant suspendedAt, String reason) {
    List<GuideInquiry> inquiries =
        inquiryRepository.findInquiriesForSuspensionClosure(businessId, suspensionVersion, suspendedAt);

    for (GuideInquiry inq : inquiries) {
      inq.setState(GuideInquiryState.CLOSED);
      inq.setCloseReason("SUSPENDED_DURING_INQUIRY: " + (reason != null ? reason : ""));
      inquiryRepository.save(inq);

      int nextSeq = (int) entryRepository.countByInquiryId(inq.getId()) + 1;
      GuideInquiryEntry entry =
          GuideInquiryEntry.builder()
              .id(UUID.randomUUID())
              .inquiryId(inq.getId())
              .seq(nextSeq)
              .actorId(UUID.fromString("00000000-0000-0000-0000-000000000000"))
              .roleSnapshot("SYSTEM")
              .kind(GuideInquiryEntryKind.DECISION)
              .body("Inquiry closed asynchronously due to guide suspension. Reason: " + inq.getCloseReason())
              .build();
      entryRepository.save(entry);

      decrementOpenQuota(inq.getCustomerId());
      outboxService.publish(
          "GUIDE_INQUIRY", inq.getId(), "GuideInquiryClosed", Map.of("inquiryId", inq.getId().toString(), "reason", "SUSPENDED"));
    }
  }

  private void saveConsent(UUID inquiryId, UUID grantorId, ContactConsentChannel channel, UUID granteeId) {
    PartnerInquiryContactConsent consent =
        consentRepository
            .findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(inquiryId, grantorId, channel)
            .orElseGet(
                () ->
                    PartnerInquiryContactConsent.builder()
                        .id(new PartnerInquiryContactConsentId(inquiryId, grantorId, channel))
                        .granteeUserId(granteeId)
                        .build());
    consent.setState(ContactConsentState.ACTIVE);
    consent.setRevokedAt(null);
    consentRepository.save(consent);
  }

  private void decrementOpenQuota(UUID customerId) {
    LocalDate todayUtc = LocalDate.now(ZoneOffset.UTC);
    quotaRepository.findByIdCustomerIdAndIdQuotaDate(customerId, todayUtc).ifPresent(q -> {
      if (q.getOpenInquiriesCount() > 0) {
        q.setOpenInquiriesCount(q.getOpenInquiriesCount() - 1);
        quotaRepository.save(q);
      }
    });
  }

  private GuideInquiry getInquiryEntity(UUID inquiryId) {
    return inquiryRepository
        .findById(inquiryId)
        .orElseThrow(() -> new TripServiceException("NOT_FOUND", "Inquiry not found", HttpStatus.NOT_FOUND));
  }

  private PartnerBusiness getBusiness(UUID businessId) {
    return businessRepository
        .findById(businessId)
        .orElseThrow(() -> new TripServiceException("NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND));
  }

  private String requireInquiryParty(AuthenticatedUser user, GuideInquiry inquiry) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    if (Objects.equals(inquiry.getCustomerId(), user.id())) {
      return "CUSTOMER";
    }
    PartnerBusiness business = getBusiness(inquiry.getGuideBusinessId());
    if (Objects.equals(business.getOwnerUserId(), user.id())) {
      return "GUIDE";
    }
    boolean isManagerOrOwner = memberRepository
        .findByIdBusinessIdAndIdUserId(inquiry.getGuideBusinessId(), user.id())
        .filter(m -> m.getState() == MembershipState.ACTIVE
            && (m.getRole() == MembershipRole.OWNER || m.getRole() == MembershipRole.MANAGER))
        .isPresent();
    if (isManagerOrOwner) {
      return "GUIDE";
    }
    throw new TripServiceException("FORBIDDEN", "User is not a party to this inquiry", HttpStatus.FORBIDDEN);
  }

  private void requireMember(AuthenticatedUser user, UUID businessId, Set<MembershipRole> allowedRoles) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerBusiness business = getBusiness(businessId);
    if (Objects.equals(business.getOwnerUserId(), user.id()) && allowedRoles.contains(MembershipRole.OWNER)) {
      return;
    }
    PartnerBusinessMember member =
        memberRepository
            .findByIdBusinessIdAndIdUserId(businessId, user.id())
            .orElseThrow(
                () -> new TripServiceException("FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));

    if (member.getState() != MembershipState.ACTIVE || !allowedRoles.contains(member.getRole())) {
      throw new TripServiceException("FORBIDDEN", "Insufficient membership permissions", HttpStatus.FORBIDDEN);
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
          "CAPABILITY_NOT_APPROVED", "Business does not have active capability: " + capability, HttpStatus.FORBIDDEN);
    }
  }

  private GuideInquiryDto loadAndMapDto(GuideInquiry inquiry) {
    GuideInquiryRequirements currentReq =
        requirementsRepository
            .findByIdInquiryIdAndIdRevision(inquiry.getId(), inquiry.getCurrentRequirementsRevision())
            .orElse(null);

    GuideProposal currentProp = inquiry.getCurrentProposalId() != null
        ? proposalRepository.findById(inquiry.getCurrentProposalId()).orElse(null)
        : null;

    List<GuideInquiryEntry> entries = entryRepository.findByInquiryIdOrderBySeqAsc(inquiry.getId());

    return toDto(inquiry, currentReq, currentProp, entries);
  }

  private GuideInquiryDto toDto(
      GuideInquiry inquiry,
      GuideInquiryRequirements req,
      GuideProposal prop,
      List<GuideInquiryEntry> entries) {

    GuideInquiryRequirementsDto reqDto = req != null
        ? new GuideInquiryRequirementsDto(
            req.getId().getRevision(),
            readJson(req.getData(), Object.class),
            req.getCreatedBy(),
            req.getCreatedAt())
        : null;

    GuideProposalDto propDto = prop != null ? toProposalDto(prop, inquiry) : null;

    List<GuideInquiryEntryDto> entryDtos = entries != null
        ? entries.stream()
            .map(e -> new GuideInquiryEntryDto(
                e.getId(),
                e.getSeq(),
                e.getActorId(),
                e.getRoleSnapshot(),
                e.getKind(),
                e.getBody(),
                readJson(e.getPayload(), Object.class),
                e.getCreatedAt()))
            .toList()
        : List.of();

    return new GuideInquiryDto(
        inquiry.getId(),
        inquiry.getGuideBusinessId(),
        inquiry.getCustomerId(),
        inquiry.getSourcePromotionId(),
        inquiry.getSourceCommunityPostId(),
        inquiry.getState(),
        inquiry.getVersion(),
        inquiry.getBoundSuspensionVersion(),
        inquiry.getCurrentRequirementsRevision(),
        inquiry.getCurrentProposalId(),
        inquiry.getExpiresAt(),
        inquiry.getCloseReason(),
        reqDto,
        propDto,
        entryDtos,
        inquiry.getCreatedAt(),
        inquiry.getUpdatedAt());
  }

  private GuideProposalDto toProposalDto(GuideProposal prop, GuideInquiry inquiry) {
    GuideProposalInput input = readJson(prop.getProposalData(), GuideProposalInput.class);
    boolean isCurrent = Objects.equals(inquiry.getCurrentProposalId(), prop.getId());
    boolean isExpired = prop.getValidUntil().isBefore(Instant.now());
    boolean canAgree = isCurrent && prop.getState() == GuideProposalState.PENDING && !isExpired && !inquiry.getState().isTerminal();

    List<String> blockedReasons = new ArrayList<>();
    if (!isCurrent) blockedReasons.add("Proposal is superseded");
    if (isExpired) blockedReasons.add("Proposal expired");
    if (inquiry.getState().isTerminal()) blockedReasons.add("Inquiry is closed");

    return new GuideProposalDto(
        prop.getId(),
        prop.getInquiryId(),
        prop.getRevision(),
        prop.getRequirementsRevision(),
        input != null ? input.offeredAreaId() : null,
        input != null ? input.offeredTopicIds() : List.of(),
        input != null ? input.offeredSkillIds() : List.of(),
        input != null ? input.languageCode() : null,
        input != null ? input.unmetSoftRequirements() : List.of(),
        input != null ? input.explanation() : null,
        input != null ? input.proposedStartAt() : null,
        input != null ? input.timeZone() : null,
        input != null ? input.durationMinutes() : 0,
        input != null ? input.program() : null,
        input != null ? input.inclusions() : List.of(),
        input != null ? input.exclusions() : List.of(),
        input != null ? input.estimatedTotalVnd() : null,
        prop.getValidUntil(),
        prop.getState(),
        List.of("Area match", "Language match"),
        input != null && input.unmetSoftRequirements() != null ? input.unmetSoftRequirements() : List.of(),
        isCurrent,
        canAgree,
        blockedReasons,
        prop.getCreatedAt());
  }

  private String writeJson(Object obj) {
    if (obj == null) return null;
    try {
      return objectMapper.writeValueAsString(obj);
    } catch (Exception e) {
      log.error("Failed to write json", e);
      return "{}";
    }
  }

  private <T> T readJson(String json, Class<T> clazz) {
    if (json == null || json.isBlank()) return null;
    try {
      return objectMapper.readValue(json, clazz);
    } catch (Exception e) {
      log.warn("Failed to read json to class: {}", clazz.getSimpleName());
      return null;
    }
  }
}
