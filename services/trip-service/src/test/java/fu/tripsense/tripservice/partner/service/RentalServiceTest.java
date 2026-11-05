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

@ExtendWith(MockitoExtension.class)
class RentalServiceTest {

  @Mock private PartnerRentalItemRepository rentalItemRepo;
  @Mock private RentalBookingOrderRepository rentalBookingRepo;
  @Mock private PartnerBusinessRepository businessRepo;
  @Mock private PartnerBusinessMemberRepository memberRepo;

  @InjectMocks private RentalService rentalService;

  private AuthenticatedUser ownerUser;
  private AuthenticatedUser strangerUser;
  private AuthenticatedUser adminUser;

  private UUID businessId;
  private UUID ownerId;
  private UUID strangerId;
  private UUID itemId;
  private PartnerBusiness business;
  private PartnerRentalItem rentalItem;

  @BeforeEach
  void setUp() {
    ownerId = UUID.randomUUID();
    strangerId = UUID.randomUUID();
    businessId = UUID.randomUUID();
    itemId = UUID.randomUUID();

    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    strangerUser = new AuthenticatedUser(strangerId, "stranger@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    adminUser = new AuthenticatedUser(UUID.randomUUID(), "admin@example.com", "ROLE_ADMIN", List.of("ROLE_ADMIN"));

    business = PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .displayName("Da Nang Moto & Camp")
        .kind(BusinessKind.RENTAL_SERVICE)
        .build();

    rentalItem = PartnerRentalItem.builder()
        .id(itemId)
        .businessId(businessId)
        .name("Honda Air Blade 160cc")
        .category(RentalCategory.VEHICLE)
        .subcategory("MOTORBIKE")
        .pricePerDay(BigDecimal.valueOf(150000))
        .depositAmount(BigDecimal.valueOf(500000))
        .totalInventory(5)
        .deliveryAvailable(true)
        .deliveryFee(BigDecimal.valueOf(30000))
        .specifications(Map.of("fuel", "Gasoline"))
        .images(List.of("https://example.com/bike.jpg"))
        .active(true)
        .build();
  }

  @Test
  @DisplayName("assertUserCanManageBusiness allows owner and rejects stranger")
  void assertUserCanManageBusiness_authorization() {
    when(businessRepo.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepo.existsByIdBusinessIdAndIdUserIdAndState(businessId, strangerId, MembershipState.ACTIVE))
        .thenReturn(false);

    // Owner should succeed
    rentalService.assertUserCanManageBusiness(ownerUser, businessId);

    // Stranger should throw FORBIDDEN
    assertThatThrownBy(() -> rentalService.assertUserCanManageBusiness(strangerUser, businessId))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("You do not have permission to manage this business");

    // Admin should succeed without checking owner
    rentalService.assertUserCanManageBusiness(adminUser, businessId);
  }

  @Test
  @DisplayName("createRentalItem successfully persists item and normalizes thumbnailUrl")
  void createRentalItem_success() {
    when(businessRepo.findById(businessId)).thenReturn(Optional.of(business));
    when(rentalItemRepo.save(any(PartnerRentalItem.class))).thenAnswer(i -> {
      PartnerRentalItem saved = i.getArgument(0);
      saved.setId(itemId);
      return saved;
    });

    CreateRentalItemRequest req = CreateRentalItemRequest.builder()
        .name("Lều cắm trại 4 người")
        .category(RentalCategory.CAMPING_GEAR)
        .thumbnailUrl("https://example.com/tent.jpg")
        .pricePerDay(BigDecimal.valueOf(200000))
        .depositAmount(BigDecimal.valueOf(300000))
        .totalInventory(10)
        .pickupOption(PickupOption.DOOR_DELIVERY)
        .build();

    RentalItemDto dto = rentalService.createRentalItem(ownerUser, businessId, req);

    assertThat(dto).isNotNull();
    assertThat(dto.name()).isEqualTo("Lều cắm trại 4 người");
    assertThat(dto.images()).contains("https://example.com/tent.jpg");
    assertThat(dto.deliveryAvailable()).isTrue();
  }

  @Test
  @DisplayName("createBooking throws RENTAL_ITEM_OUT_OF_STOCK when requested quantity exceeds available inventory")
  void createBooking_outOfStock() {
    when(rentalItemRepo.findById(itemId)).thenReturn(Optional.of(rentalItem));

    Instant now = Instant.now();
    Instant pickupAt = now.plus(1, ChronoUnit.DAYS);
    Instant returnAt = now.plus(3, ChronoUnit.DAYS);

    // Total inventory is 5, already allocated 4
    when(rentalBookingRepo.calculateOverlappingAllocatedQuantity(itemId, pickupAt, returnAt))
        .thenReturn(4);

    CreateRentalBookingRequest req = CreateRentalBookingRequest.builder()
        .rentalItemId(itemId)
        .pickupAt(pickupAt)
        .returnAt(returnAt)
        .quantity(2) // 4 + 2 = 6 > 5
        .customerName("Nguyen Van A")
        .customerPhone("0905123456")
        .build();

    assertThatThrownBy(() -> rentalService.createBooking(UUID.randomUUID(), req))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("Not enough available inventory");
  }

  @Test
  @DisplayName("Rental booking lifecycle: PENDING -> CONFIRMED -> IN_USE -> RETURNED")
  void bookingLifecycle_stateTransitions() {
    when(businessRepo.findById(businessId)).thenReturn(Optional.of(business));

    RentalBookingOrder order = RentalBookingOrder.builder()
        .id(UUID.randomUUID())
        .bookingCode("#TS-RNT-TEST1234")
        .businessId(businessId)
        .rentalItemId(itemId)
        .pickupAt(Instant.now().plus(1, ChronoUnit.DAYS))
        .returnAt(Instant.now().plus(3, ChronoUnit.DAYS))
        .rentalPrice(BigDecimal.valueOf(300000))
        .totalAmount(BigDecimal.valueOf(300000))
        .status(RentalBookingStatus.PENDING)
        .build();

    when(rentalBookingRepo.findById(order.getId())).thenReturn(Optional.of(order));
    when(rentalBookingRepo.save(any(RentalBookingOrder.class))).thenAnswer(i -> i.getArgument(0));

    // 1. Confirm
    RentalBookingOrderDto confirmed = rentalService.confirmBooking(ownerUser, businessId, order.getId());
    assertThat(confirmed.status()).isEqualTo(RentalBookingStatus.CONFIRMED);

    // 2. Handover
    RentalBookingOrderDto handedOver = rentalService.handoverBooking(ownerUser, businessId, order.getId());
    assertThat(handedOver.status()).isEqualTo(RentalBookingStatus.IN_USE);

    // 3. Return
    RentalBookingOrderDto returned = rentalService.returnBooking(
        ownerUser, businessId, order.getId(), BigDecimal.valueOf(50000), "Khách trả trễ 1 tiếng");
    assertThat(returned.status()).isEqualTo(RentalBookingStatus.RETURNED);
    assertThat(returned.overdueFee()).isEqualByComparingTo(BigDecimal.valueOf(50000));
  }
}

