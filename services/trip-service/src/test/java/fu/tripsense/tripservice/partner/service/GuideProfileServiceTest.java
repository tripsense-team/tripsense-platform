package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PublicGuideProfileDto;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
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
class GuideProfileServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerGuidePromotionRepository promotionRepository;
  @Mock private PartnerGuidePromotionRevisionRepository revisionRepository;
  @Spy private ObjectMapper objectMapper = new ObjectMapper();

  @InjectMocks private GuideProfileService guideProfileService;

  private UUID businessId;
  private UUID approvedRevisionId;
  private UUID ownerId;

  @BeforeEach
  void setUp() {
    businessId = UUID.randomUUID();
    approvedRevisionId = UUID.randomUUID();
    ownerId = UUID.randomUUID();
  }

  private PartnerBusiness createGuideBusiness(PublicationState pubState) {
    return PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .kind(BusinessKind.TOUR_GUIDE)
        .displayName("Nguyen Guide")
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(OperationState.ACTIVE)
        .publicationState(pubState)
        .acceptingNew(true)
        .requiresReverification(false)
        .approvedRevisionId(approvedRevisionId)
        .version(1L)
        .build();
  }

  @Test
  @DisplayName("getPublicGuide: returns public profile when business is public eligible")
  void getPublicGuide_success() {
    PartnerBusiness business = createGuideBusiness(PublicationState.PUBLISHED);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_LISTING))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_LISTING))
        .thenReturn(Optional.of(cap));

    PartnerApplication app =
        PartnerApplication.builder()
            .id(approvedRevisionId)
            .profileSnapshot(Map.of(
                "professionalName", "Minh Nguyen Tour Guide",
                "bio", "Passionate local guide in Hoi An and Da Nang",
                "yearsExperience", 8,
                "languages", List.of(
                    Map.of("code", "vi", "selfAssessedLevel", "FLUENT"),
                    Map.of("code", "en", "selfAssessedLevel", "FLUENT")
                ),
                "skillIds", List.of("HISTORICAL_KNOWLEDGE", "PHOTOGRAPHY_SKILLS"),
                "expertise", List.of(
                    Map.of("areaId", "HOI_AN", "topicId", "HERITAGE_CULTURE", "description", "Ancient town walks", "experience", "5 years")
                ),
                "indicativePrice", Map.of("amount", "250000", "currency", "VND", "unit", "HOUR")
            ))
            .build();
    when(applicationRepository.findById(approvedRevisionId)).thenReturn(Optional.of(app));
    when(promotionRepository.findByBusinessId(businessId)).thenReturn(List.of());

    PublicGuideProfileDto dto = guideProfileService.getPublicGuide(businessId);

    assertThat(dto.displayName()).isEqualTo("Minh Nguyen Tour Guide");
    assertThat(dto.yearsExperience()).isEqualTo(8);
    assertThat(dto.languages()).hasSize(2);
    assertThat(dto.skillIds()).contains("HISTORICAL_KNOWLEDGE", "PHOTOGRAPHY_SKILLS");
    assertThat(dto.expertise()).hasSize(1);
    assertThat(dto.indicativePrice()).isNotNull();
    assertThat(dto.indicativePrice().currency()).isEqualTo("VND");
  }

  @Test
  @DisplayName("getPublicGuide: throws 404 when guide is hidden or not eligible")
  void getPublicGuide_notEligible() {
    PartnerBusiness business = createGuideBusiness(PublicationState.HIDDEN);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    assertThatThrownBy(() -> guideProfileService.getPublicGuide(businessId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).status()).isEqualTo(HttpStatus.NOT_FOUND));
  }

  @Test
  @DisplayName("searchPublicGuides: filters correctly by area and language")
  void searchPublicGuides_filters() {
    PartnerBusiness business = createGuideBusiness(PublicationState.PUBLISHED);
    when(businessRepository.findByKindAndPublicationState(BusinessKind.TOUR_GUIDE, PublicationState.PUBLISHED))
        .thenReturn(List.of(business));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.GUIDE_LISTING))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_LISTING))
        .thenReturn(Optional.of(cap));

    PartnerApplication app =
        PartnerApplication.builder()
            .id(approvedRevisionId)
            .profileSnapshot(Map.of(
                "professionalName", "Minh Nguyen Tour Guide",
                "languages", List.of(Map.of("code", "en", "selfAssessedLevel", "FLUENT")),
                "expertise", List.of(Map.of("areaId", "HOI_AN", "topicId", "HERITAGE_CULTURE")),
                "skillIds", List.of("HISTORICAL_KNOWLEDGE")
            ))
            .build();
    when(applicationRepository.findById(approvedRevisionId)).thenReturn(Optional.of(app));
    when(promotionRepository.findByBusinessId(businessId)).thenReturn(List.of());

    // Matches
    List<PublicGuideProfileDto> results =
        guideProfileService.searchPublicGuides("HOI_AN", null, List.of("HISTORICAL_KNOWLEDGE"), "en", null);
    assertThat(results).hasSize(1);

    // Mismatches area
    List<PublicGuideProfileDto> noMatchArea =
        guideProfileService.searchPublicGuides("HANOI", null, null, null, null);
    assertThat(noMatchArea).isEmpty();

    // Mismatches language
    List<PublicGuideProfileDto> noMatchLang =
        guideProfileService.searchPublicGuides(null, null, null, "fr", null);
    assertThat(noMatchLang).isEmpty();
  }
}
