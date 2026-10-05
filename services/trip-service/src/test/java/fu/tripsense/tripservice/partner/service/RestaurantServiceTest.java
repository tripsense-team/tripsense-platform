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
class RestaurantServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private RestaurantMenuItemRepository menuRepository;
  @Spy private ObjectMapper objectMapper = new ObjectMapper();

  @InjectMocks private RestaurantService restaurantService;

  private AuthenticatedUser ownerUser;
  private AuthenticatedUser managerUser;
  private AuthenticatedUser otherUser;
  private UUID ownerId;
  private UUID managerId;
  private UUID otherId;
  private UUID businessId;
  private UUID approvedRevisionId;

  @BeforeEach
  void setUp() {
    ownerId = UUID.randomUUID();
    managerId = UUID.randomUUID();
    otherId = UUID.randomUUID();

    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    managerUser = new AuthenticatedUser(managerId, "manager@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    otherUser = new AuthenticatedUser(otherId, "other@example.com", "ROLE_USER", List.of("ROLE_USER"));

    businessId = UUID.randomUUID();
    approvedRevisionId = UUID.randomUUID();
  }

  private PartnerBusiness createRestaurantBusiness(OperationState opState, PublicationState pubState, boolean revCheck) {
    return PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .kind(BusinessKind.RESTAURANT)
        .displayName("Lantern Kitchen")
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(opState)
        .publicationState(pubState)
        .acceptingNew(true)
        .requiresReverification(revCheck)
        .approvedRevisionId(approvedRevisionId)
        .version(1L)
        .publicContactConsent(false)
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
  @DisplayName("getMenu: Owner or Manager can retrieve menu items ordered")
  void getMenu_success() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);

    RestaurantMenuItem item =
        RestaurantMenuItem.builder()
            .id(UUID.randomUUID())
            .businessId(businessId)
            .name("Pho Bo")
            .category("Main")
            .price(new BigDecimal("75000.00"))
            .currency("VND")
            .available(true)
            .displayOrder(1)
            .build();

    when(menuRepository.findByBusinessIdOrderByDisplayOrderAscNameAsc(businessId))
        .thenReturn(List.of(item));

    List<RestaurantMenuItemDto> menu = restaurantService.getMenu(ownerUser, businessId);

    assertThat(menu).hasSize(1);
    assertThat(menu.get(0).name()).isEqualTo("Pho Bo");
  }

  @Test
  @DisplayName("getMenu: Forbidden for non-member")
  void getMenu_forbidden() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, otherId))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> restaurantService.getMenu(otherUser, businessId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("FORBIDDEN"));
  }

  @Test
  @DisplayName("updateMenu: successfully replaces menu items when business is active and has RESTAURANT_MENU capability")
  void updateMenu_success() {
    mockMembership(managerId, MembershipRole.MANAGER, MembershipState.ACTIVE);
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.RESTAURANT_MENU))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_MENU))
        .thenReturn(Optional.of(cap));

    when(menuRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

    RestaurantMenuItemDto newItem =
        RestaurantMenuItemDto.builder()
            .name("Banh Mi")
            .category("Snack")
            .price(new BigDecimal("35000.00"))
            .available(true)
            .tags(List.of("streetfood", "crispy"))
            .build();

    List<RestaurantMenuItemDto> result =
        restaurantService.updateMenu(managerUser, businessId, new RestaurantMenuBatchRequest(List.of(newItem)));

    verify(menuRepository).deleteByBusinessId(businessId);
    verify(menuRepository).saveAll(any());
    assertThat(result).hasSize(1);
    assertThat(result.get(0).name()).isEqualTo("Banh Mi");
  }

  @Test
  @DisplayName("updateMenu: fails when business is suspended")
  void updateMenu_suspended() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createRestaurantBusiness(OperationState.SUSPENDED, PublicationState.PUBLISHED, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    assertThatThrownBy(() -> restaurantService.updateMenu(ownerUser, businessId, new RestaurantMenuBatchRequest(List.of())))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("BUSINESS_SUSPENDED"));
  }

  @Test
  @DisplayName("updateMenu: fails when RESTAURANT_MENU capability is missing")
  void updateMenu_missingCapability() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_MENU))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> restaurantService.updateMenu(ownerUser, businessId, new RestaurantMenuBatchRequest(List.of())))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("CAPABILITY_REQUIRED"));
  }

  @Test
  @DisplayName("updateContactSharing: Owner can update consent with matching version")
  void updateContactSharing_success() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    restaurantService.updateContactSharing(ownerUser, businessId, new PublicContactConsentRequest(1L, true));

    assertThat(business.isPublicContactConsent()).isTrue();
    verify(businessRepository).save(business);
  }

  @Test
  @DisplayName("updateContactSharing: Fails on version conflict")
  void updateContactSharing_versionConflict() {
    mockMembership(ownerId, MembershipRole.OWNER, MembershipState.ACTIVE);
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    assertThatThrownBy(() -> restaurantService.updateContactSharing(ownerUser, businessId, new PublicContactConsentRequest(99L, true)))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("VERSION_CONFLICT"));
  }

  @Test
  @DisplayName("getPublicRestaurant: returns listing without contacts when consent is false")
  void getPublicRestaurant_noConsent() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    business.setPublicContactConsent(false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.RESTAURANT_LISTING))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING))
        .thenReturn(Optional.of(cap));

    PartnerApplication app =
        PartnerApplication.builder()
            .id(approvedRevisionId)
            .profileSnapshot(Map.of(
                "address", "123 Tran Phu",
                "destination", "Hoi An",
                "openingHours", "08:00 - 22:00",
                "cuisineTags", List.of("Vietnamese", "Vegetarian"),
                "email", "contact@lanternkitchen.test",
                "phone", "+84901234567"
            ))
            .build();
    when(applicationRepository.findById(approvedRevisionId)).thenReturn(Optional.of(app));
    when(menuRepository.findByBusinessIdAndAvailableTrueOrderByDisplayOrderAscNameAsc(businessId))
        .thenReturn(List.of());

    PublicRestaurantListingDto dto = restaurantService.getPublicRestaurant(businessId);

    assertThat(dto.displayName()).isEqualTo("Lantern Kitchen");
    assertThat(dto.address()).isEqualTo("123 Tran Phu");
    assertThat(dto.cuisineTags()).containsExactly("Vietnamese", "Vegetarian");
    assertThat(dto.publicEmail()).isNull();
    assertThat(dto.publicPhone()).isNull();
  }

  @Test
  @DisplayName("getPublicRestaurant: returns listing with contacts when consent is true")
  void getPublicRestaurant_withConsent() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.PUBLISHED, false);
    business.setPublicContactConsent(true);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap =
        PartnerBusinessCapability.builder()
            .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.RESTAURANT_LISTING))
            .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING))
        .thenReturn(Optional.of(cap));

    PartnerApplication app =
        PartnerApplication.builder()
            .id(approvedRevisionId)
            .profileSnapshot(Map.of(
                "address", "123 Tran Phu",
                "destination", "Hoi An",
                "openingHours", "08:00 - 22:00",
                "cuisineTags", List.of("Vietnamese"),
                "email", "contact@lanternkitchen.test",
                "phone", "+84901234567"
            ))
            .build();
    when(applicationRepository.findById(approvedRevisionId)).thenReturn(Optional.of(app));
    when(menuRepository.findByBusinessIdAndAvailableTrueOrderByDisplayOrderAscNameAsc(businessId))
        .thenReturn(List.of());

    PublicRestaurantListingDto dto = restaurantService.getPublicRestaurant(businessId);

    assertThat(dto.publicEmail()).isEqualTo("contact@lanternkitchen.test");
    assertThat(dto.publicPhone()).isEqualTo("+84901234567");
  }

  @Test
  @DisplayName("getPublicRestaurant: throws 404 when restaurant is not public eligible")
  void getPublicRestaurant_notPublicEligible() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, PublicationState.HIDDEN, false);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    assertThatThrownBy(() -> restaurantService.getPublicRestaurant(businessId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).status()).isEqualTo(HttpStatus.NOT_FOUND));
  }
}
