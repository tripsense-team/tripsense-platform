package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PublicRentalListingDto;
import fu.tripsense.tripservice.partner.dto.RentalItemDto;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.entity.PartnerBusinessCapability;
import fu.tripsense.tripservice.partner.entity.PartnerRentalItem;
import fu.tripsense.tripservice.partner.entity.PartnerSubscription;
import fu.tripsense.tripservice.partner.enums.ApprovalValidity;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.OperationState;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import fu.tripsense.tripservice.partner.repository.PartnerApplicationRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessCapabilityRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.partner.repository.PartnerRentalItemRepository;
import fu.tripsense.tripservice.partner.repository.PartnerSubscriptionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class PublicRentalServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerApplicationRepository applicationRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private PartnerRentalItemRepository rentalItemRepository;
  @Mock private PartnerSubscriptionRepository subscriptionRepository;
  @Mock private RentalService rentalService;

  @InjectMocks private PublicRentalService publicRentalService;

  private UUID businessId;
  private UUID ownerId;
  private PartnerBusiness business;

  @BeforeEach
  void setUp() {
    businessId = UUID.randomUUID();
    ownerId = UUID.randomUUID();
    business = PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .kind(BusinessKind.RENTAL_SERVICE)
        .displayName("Van Khang Car - VF3 Da Nang")
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(OperationState.ACTIVE)
        .publicationState(PublicationState.PUBLISHED)
        .acceptingNew(true)
        .requiresReverification(false)
        .publicContactConsent(true)
        .draftProfileJson(Map.of(
            "destination", "Đà Nẵng",
            "address", "334/3 Nguyễn Văn Linh",
            "placeId", "6af324b7bcd2fb211d1190bb",
            "contactPhone", "0934842844"))
        .build();
  }

  @Test
  @DisplayName("getPublicRental returns active items, minPricePerDay, verified badge and consented contact")
  void getPublicRental_success() {
    PartnerRentalItem car = PartnerRentalItem.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .name("VinFast VF3 Plus")
        .category(RentalCategory.CAR_4_SEATS)
        .pricePerDay(BigDecimal.valueOf(600000))
        .depositAmount(BigDecimal.valueOf(2000000))
        .totalInventory(3)
        .deliveryAvailable(true)
        .active(true)
        .build();

    RentalItemDto carDto = RentalItemDto.builder()
        .id(car.getId())
        .businessId(businessId)
        .name(car.getName())
        .category(RentalCategory.CAR_4_SEATS)
        .pricePerDay(BigDecimal.valueOf(600000))
        .depositAmount(BigDecimal.valueOf(2000000))
        .totalInventory(3)
        .deliveryAvailable(true)
        .pickupOption(PickupOption.DELIVERY_TO_LOCATION)
        .active(true)
        .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RENTAL_LISTING))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().build()));
    when(rentalItemRepository.findByBusinessIdAndActiveTrueOrderByNameAsc(businessId))
        .thenReturn(List.of(car));
    when(rentalService.toDto(car)).thenReturn(carDto);
    when(subscriptionRepository.findByBusinessId(businessId))
        .thenReturn(Optional.of(PartnerSubscription.builder()
            .businessId(businessId)
            .status(SubscriptionStatus.ACTIVE)
            .validTo(Instant.now().plus(30, ChronoUnit.DAYS))
            .build()));

    PublicRentalListingDto dto = publicRentalService.getPublicRental(businessId);

    assertThat(dto.id()).isEqualTo(businessId);
    assertThat(dto.displayName()).isEqualTo("Van Khang Car - VF3 Da Nang");
    assertThat(dto.placeId()).isEqualTo("6af324b7bcd2fb211d1190bb");
    assertThat(dto.publicPhone()).isEqualTo("0934842844");
    assertThat(dto.verifiedPartner()).isTrue();
    assertThat(dto.badgeLabel()).isEqualTo("Verified Partner");
    assertThat(dto.hasDirectInventory()).isTrue();
    assertThat(dto.minPricePerDay()).isEqualByComparingTo("600000");
    assertThat(dto.items()).hasSize(1);
  }

  @Test
  @DisplayName("getPublicRental rejects hidden businesses with 404 RENTAL_NOT_FOUND")
  void getPublicRental_hidden_throws404() {
    business.setPublicationState(PublicationState.HIDDEN);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RENTAL_LISTING))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().build()));

    assertThatThrownBy(() -> publicRentalService.getPublicRental(businessId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> assertThat(((TripServiceException) e).status()).isEqualTo(HttpStatus.NOT_FOUND));
  }

  @Test
  @DisplayName("searchPublicRentals falls back to placeId and destination snapshot matching")
  void searchPublicRentals_snapshotPlaceIdFallback() {
    when(businessRepository.findByDisplayNameContainingIgnoreCase("6af324b7bcd2fb211d1190bb"))
        .thenReturn(List.of());
    when(businessRepository.findByKindAndPublicationState(BusinessKind.RENTAL_SERVICE, PublicationState.PUBLISHED))
        .thenReturn(List.of(business));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RENTAL_LISTING))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().build()));
    when(rentalItemRepository.findByBusinessIdAndActiveTrueOrderByNameAsc(businessId))
        .thenReturn(List.of());
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());

    List<PublicRentalListingDto> results = publicRentalService.searchPublicRentals("6af324b7bcd2fb211d1190bb");

    assertThat(results).hasSize(1);
    assertThat(results.getFirst().hasDirectInventory()).isFalse();
    assertThat(results.getFirst().minPricePerDay()).isNull();
  }

  @Test
  @DisplayName("searchPublicRentals matches Vietnamese diacritic-folded vehicle names and filters category/onlyAccepting")
  void searchPublicRentals_matchesItemNameAndFilters() {
    PartnerRentalItem motorbike = PartnerRentalItem.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .name("Xe máy Honda Air Blade")
        .category(RentalCategory.MOTORBIKE_SCOOTER)
        .pricePerDay(BigDecimal.valueOf(150000))
        .depositAmount(BigDecimal.valueOf(500000))
        .totalInventory(5)
        .active(true)
        .build();
    RentalItemDto motoDto = RentalItemDto.builder()
        .id(motorbike.getId())
        .businessId(businessId)
        .name(motorbike.getName())
        .category(RentalCategory.MOTORBIKE_SCOOTER)
        .pricePerDay(BigDecimal.valueOf(150000))
        .totalInventory(5)
        .active(true)
        .build();

    when(businessRepository.findByDisplayNameContainingIgnoreCase("xe may"))
        .thenReturn(List.of());
    when(businessRepository.findByKindAndPublicationState(BusinessKind.RENTAL_SERVICE, PublicationState.PUBLISHED))
        .thenReturn(List.of(business));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RENTAL_LISTING))
        .thenReturn(Optional.of(PartnerBusinessCapability.builder().build()));
    when(rentalItemRepository.findByBusinessIdAndActiveTrueOrderByNameAsc(businessId))
        .thenReturn(List.of(motorbike));
    when(rentalService.toDto(motorbike)).thenReturn(motoDto);
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());

    List<PublicRentalListingDto> matches =
        publicRentalService.searchPublicRentals("xe may", RentalCategory.MOTORBIKE_SCOOTER, true);
    assertThat(matches).hasSize(1);
    assertThat(matches.getFirst().items()).hasSize(1);
    assertThat(matches.getFirst().items().getFirst().name()).isEqualTo("Xe máy Honda Air Blade");

    List<PublicRentalListingDto> wrongCategory =
        publicRentalService.searchPublicRentals("xe may", RentalCategory.CAR_4_SEATS, true);
    assertThat(wrongCategory).isEmpty();
  }
}

