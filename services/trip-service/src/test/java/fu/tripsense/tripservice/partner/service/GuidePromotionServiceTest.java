package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
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
class GuidePromotionServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private PartnerGuidePromotionRepository promotionRepository;
  @Mock private PartnerGuidePromotionRevisionRepository revisionRepository;
  @Mock private PartnerGuidePromotionMediaRepository mediaRepository;
  @Mock private PartnerOutboxService outboxService;
  @Spy private ObjectMapper objectMapper = new ObjectMapper();

  @InjectMocks private GuidePromotionService promotionService;

  private AuthenticatedUser ownerUser;
  private AuthenticatedUser adminUser;
  private UUID ownerId;
  private UUID adminId;
  private UUID businessId;
  private UUID promotionId;
  private UUID approvedProfileRevId;

  @BeforeEach
  void setUp() {
    ownerId = UUID.randomUUID();
    adminId = UUID.randomUUID();
    businessId = UUID.randomUUID();
    promotionId = UUID.randomUUID();
    approvedProfileRevId = UUID.randomUUID();

    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    adminUser = new AuthenticatedUser(adminId, "admin@example.com", "ROLE_ADMIN", List.of("ROLE_USER", "ROLE_ADMIN"));
  }

  private PartnerBusiness createGuideBusiness(OperationState opState, PublicationState pubState) {
    return PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .kind(BusinessKind.TOUR_GUIDE)
        .displayName("An Bang Guide")
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(opState)
        .publicationState(pubState)
        .acceptingNew(true)
        .requiresReverification(false)
        .approvedRevisionId(approvedProfileRevId)
        .version(1L)
        .build();
  }

  private void mockMembership(UUID userId, MembershipRole role, MembershipState state) {
    PartnerBusinessMember member =
        PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, userId))
            .role(role)
            .state(state)
            .build();
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, userId))
        .thenReturn(Optional.of(member));
  }

  @Test
  @DisplayName("createDraft: successfully creates promotion and first DRAFT revision")
  void createDraft_success() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    when(promotionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(revisionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    CreateGuidePromotionDraftRequest req =
        new CreateGuidePromotionDraftRequest(
            "Secret Alley Street Food Tour",
            "Explore hidden cul-de-sacs with local eats",
            "HOI_AN",
            List.of("FOOD_STREET"),
            List.of("HISTORICAL_KNOWLEDGE"),
            "3 hours",
            List.of("Food tastings", "Water"),
            List.of("Hotel pickup"),
            new BigDecimal("450000.00"),
            "VND",
            IndicativePriceUnit.PERSON,
            "cover.jpg",
            List.of("gallery1.jpg"));

    GuidePromotionDto dto = promotionService.createDraft(ownerUser, businessId, req);

    assertThat(dto).isNotNull();
    assertThat(dto.publicationState()).isEqualTo(PublicationState.HIDDEN);
    assertThat(dto.currentRevision()).isNotNull();
    assertThat(dto.currentRevision().revisionNumber()).isEqualTo(1);
    assertThat(dto.currentRevision().state()).isEqualTo(ApplicationState.DRAFT);
    assertThat(dto.currentRevision().title()).isEqualTo("Secret Alley Street Food Tour");
  }

  @Test
  @DisplayName("createDraft: throws BadRequest for non-TOUR_GUIDE business")
  void createDraft_wrongKind() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    business.setKind(BusinessKind.HOTEL);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    CreateGuidePromotionDraftRequest req =
        new CreateGuidePromotionDraftRequest(
            "Title", "Summary", "HOI_AN", List.of("FOOD_STREET"), List.of("HISTORICAL_KNOWLEDGE"),
            "3 hours", null, null, BigDecimal.TEN, "VND", IndicativePriceUnit.PERSON, null, null);

    assertThatThrownBy(() -> promotionService.createDraft(ownerUser, businessId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("INVALID_BUSINESS_KIND"));
  }

  @Test
  @DisplayName("submit: successfully transitions DRAFT to SUBMITTED when within approved expertise and skills")
  void submit_success() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder()
            .id(promotionId)
            .businessId(businessId)
            .publicationState(PublicationState.HIDDEN)
            .version(0L)
            .build();
    when(promotionRepository.findByIdAndBusinessId(promotionId, businessId)).thenReturn(Optional.of(promo));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_PROMOTION))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_PROMOTION))
        .thenReturn(Optional.of(cap));

    PartnerApplication approvedProfile =
        PartnerApplication.builder()
            .id(approvedProfileRevId)
            .profileSnapshot(Map.of(
                "expertise", List.of(Map.of("areaId", "HOI_AN", "topicId", "FOOD_STREET")),
                "skillIds", List.of("HISTORICAL_KNOWLEDGE")
            ))
            .build();
    when(applicationRepository.findById(approvedProfileRevId)).thenReturn(Optional.of(approvedProfile));

    PartnerGuidePromotionRevision rev =
        PartnerGuidePromotionRevision.builder()
            .id(UUID.randomUUID())
            .promotionId(promotionId)
            .revisionNumber(1)
            .approvedProfileRevisionId(approvedProfileRevId)
            .title("Street Food")
            .summary("Summary")
            .areaId("HOI_AN")
            .topicIds(List.of("FOOD_STREET"))
            .skillIds(List.of("HISTORICAL_KNOWLEDGE"))
            .indicativePriceUnit(IndicativePriceUnit.PERSON)
            .state(ApplicationState.DRAFT)
            .build();
    when(revisionRepository.findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId))
        .thenReturn(Optional.of(rev));
    when(revisionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(promotionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    GuidePromotionDto result = promotionService.submit(ownerUser, businessId, promotionId, new SubmitGuidePromotionRequest(0L));

    assertThat(result.currentRevision().state()).isEqualTo(ApplicationState.SUBMITTED);
    verify(outboxService).publish(eq("GUIDE_PROMOTION"), eq(promotionId), eq("GuidePromotionSubmitted"), any());
  }

  @Test
  @DisplayName("submit: rejects when area or topic is not in approved expertise")
  void submit_invalidExpertise() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder().id(promotionId).businessId(businessId).version(0L).build();
    when(promotionRepository.findByIdAndBusinessId(promotionId, businessId)).thenReturn(Optional.of(promo));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_PROMOTION)).build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_PROMOTION))
        .thenReturn(Optional.of(cap));

    PartnerApplication approvedProfile =
        PartnerApplication.builder()
            .id(approvedProfileRevId)
            .profileSnapshot(Map.of(
                "expertise", List.of(Map.of("areaId", "HOI_AN", "topicId", "FOOD_STREET")),
                "skillIds", List.of("HISTORICAL_KNOWLEDGE")
            ))
            .build();
    when(applicationRepository.findById(approvedProfileRevId)).thenReturn(Optional.of(approvedProfile));

    PartnerGuidePromotionRevision rev =
        PartnerGuidePromotionRevision.builder()
            .id(UUID.randomUUID())
            .promotionId(promotionId)
            .revisionNumber(1)
            .areaId("HANOI") // Not in approved expertise!
            .topicIds(List.of("FOOD_STREET"))
            .skillIds(List.of("HISTORICAL_KNOWLEDGE"))
            .state(ApplicationState.DRAFT)
            .build();
    when(revisionRepository.findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId))
        .thenReturn(Optional.of(rev));

    assertThatThrownBy(() -> promotionService.submit(ownerUser, businessId, promotionId, new SubmitGuidePromotionRequest(0L)))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("INVALID_EXPERTISE"));
  }

  @Test
  @DisplayName("submit: material change in area on existing approved promotion throws MATERIAL_CHANGE_REQUIRES_NEW_PROMOTION")
  void submit_materialChange_throwsConflict() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    UUID prevApprovedRevId = UUID.randomUUID();
    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder()
            .id(promotionId)
            .businessId(businessId)
            .approvedRevisionId(prevApprovedRevId)
            .version(0L)
            .build();
    when(promotionRepository.findByIdAndBusinessId(promotionId, businessId)).thenReturn(Optional.of(promo));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_PROMOTION)).build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_PROMOTION))
        .thenReturn(Optional.of(cap));

    PartnerApplication approvedProfile =
        PartnerApplication.builder()
            .id(approvedProfileRevId)
            .profileSnapshot(Map.of(
                "expertise", List.of(
                    Map.of("areaId", "HOI_AN", "topicId", "FOOD_STREET"),
                    Map.of("areaId", "DA_NANG", "topicId", "FOOD_STREET")
                ),
                "skillIds", List.of("HISTORICAL_KNOWLEDGE")
            ))
            .build();
    when(applicationRepository.findById(approvedProfileRevId)).thenReturn(Optional.of(approvedProfile));

    PartnerGuidePromotionRevision prevApprovedRev =
        PartnerGuidePromotionRevision.builder()
            .id(prevApprovedRevId)
            .areaId("HOI_AN")
            .build();
    when(revisionRepository.findById(prevApprovedRevId)).thenReturn(Optional.of(prevApprovedRev));

    PartnerGuidePromotionRevision latestDraft =
        PartnerGuidePromotionRevision.builder()
            .id(UUID.randomUUID())
            .promotionId(promotionId)
            .revisionNumber(2)
            .areaId("DA_NANG") // Changed area from HOI_AN to DA_NANG!
            .topicIds(List.of("FOOD_STREET"))
            .skillIds(List.of("HISTORICAL_KNOWLEDGE"))
            .state(ApplicationState.DRAFT)
            .build();
    when(revisionRepository.findFirstByPromotionIdOrderByRevisionNumberDesc(promotionId))
        .thenReturn(Optional.of(latestDraft));

    assertThatThrownBy(() -> promotionService.submit(ownerUser, businessId, promotionId, new SubmitGuidePromotionRequest(0L)))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("MATERIAL_CHANGE_REQUIRES_NEW_PROMOTION"));
  }

  @Test
  @DisplayName("reviewDecision: Admin can approve revision and swaps approved revision pointer")
  void reviewDecision_approve_success() {
    UUID revId = UUID.randomUUID();
    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder()
            .id(promotionId)
            .businessId(businessId)
            .version(1L)
            .distributionVersion(1L)
            .build();
    when(promotionRepository.findById(promotionId)).thenReturn(Optional.of(promo));

    PartnerGuidePromotionRevision rev =
        PartnerGuidePromotionRevision.builder()
            .id(revId)
            .promotionId(promotionId)
            .revisionNumber(1)
            .title("Title")
            .areaId("HOI_AN")
            .topicIds(List.of("FOOD_STREET"))
            .skillIds(List.of("HISTORICAL_KNOWLEDGE"))
            .state(ApplicationState.SUBMITTED)
            .build();
    when(revisionRepository.findById(revId)).thenReturn(Optional.of(rev));

    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    business.setVersion(1L);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, adminId)).thenReturn(Optional.empty());

    when(revisionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(promotionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    GuidePromotionRevisionDecisionRequest req =
        new GuidePromotionRevisionDecisionRequest(1L, 1L, ApplicationState.APPROVED, "Verified quality content");

    GuidePromotionRevisionDto result = promotionService.reviewDecision(adminUser, revId, req);

    assertThat(result.state()).isEqualTo(ApplicationState.APPROVED);
    assertThat(promo.getApprovedRevisionId()).isEqualTo(revId);
    assertThat(promo.getVersion()).isEqualTo(2L);
    verify(outboxService).publish(eq("GUIDE_PROMOTION"), eq(promotionId), eq("GuidePromotionReviewed"), any());
  }

  @Test
  @DisplayName("reviewDecision: blocks self-review by business member")
  void reviewDecision_selfReviewForbidden() {
    UUID revId = UUID.randomUUID();
    PartnerGuidePromotion promo = PartnerGuidePromotion.builder().id(promotionId).businessId(businessId).build();
    when(promotionRepository.findById(promotionId)).thenReturn(Optional.of(promo));

    PartnerGuidePromotionRevision rev = PartnerGuidePromotionRevision.builder().id(revId).promotionId(promotionId).build();
    when(revisionRepository.findById(revId)).thenReturn(Optional.of(rev));

    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    // Admin is also a member of this business
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, adminId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder().build()));

    GuidePromotionRevisionDecisionRequest req =
        new GuidePromotionRevisionDecisionRequest(1L, 1L, ApplicationState.APPROVED, "Self approval attempt");

    assertThatThrownBy(() -> promotionService.reviewDecision(adminUser, revId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("SELF_REVIEW_NOT_ALLOWED"));
  }

  @Test
  @DisplayName("updatePublication: publishes promotion when approved and business eligible")
  void updatePublication_success() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    UUID approvedRevId = UUID.randomUUID();
    PartnerGuidePromotion promo =
        PartnerGuidePromotion.builder()
            .id(promotionId)
            .businessId(businessId)
            .approvedRevisionId(approvedRevId)
            .publicationState(PublicationState.HIDDEN)
            .version(1L)
            .distributionVersion(1L)
            .build();
    when(promotionRepository.findByIdAndBusinessId(promotionId, businessId)).thenReturn(Optional.of(promo));

    PartnerBusiness business = createGuideBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability listingCap =
        PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_LISTING)).build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_LISTING))
        .thenReturn(Optional.of(listingCap));

    PartnerBusinessCapability promoCap =
        PartnerBusinessCapability.builder().id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_PROMOTION)).build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_PROMOTION))
        .thenReturn(Optional.of(promoCap));

    when(promotionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    GuidePromotionDto result =
        promotionService.updatePublication(ownerUser, businessId, promotionId, new GuidePromotionPublicationRequest(1L, PublicationState.PUBLISHED));

    assertThat(result.publicationState()).isEqualTo(PublicationState.PUBLISHED);
    assertThat(result.version()).isEqualTo(2L);
  }
}
