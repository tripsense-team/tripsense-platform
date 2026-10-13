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
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RestaurantReservationServiceTest {

  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerBusinessCapabilityRepository capabilityRepository;
  @Mock private RestaurantReservationRepository reservationRepository;
  @Mock private RestaurantReservationTransitionRepository transitionRepository;
  @Mock private PartnerNotificationRepository notificationRepository;

  @InjectMocks private RestaurantReservationService reservationService;

  private AuthenticatedUser customerUser;
  private AuthenticatedUser ownerUser;
  private AuthenticatedUser otherUser;
  private UUID customerId;
  private UUID ownerId;
  private UUID otherId;
  private UUID businessId;
  private UUID approvedRevisionId;

  @BeforeEach
  void setUp() {
    customerId = UUID.randomUUID();
    ownerId = UUID.randomUUID();
    otherId = UUID.randomUUID();

    customerUser = new AuthenticatedUser(customerId, "customer@example.com", "ROLE_USER", List.of("ROLE_USER"));
    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    otherUser = new AuthenticatedUser(otherId, "other@example.com", "ROLE_USER", List.of("ROLE_USER"));

    businessId = UUID.randomUUID();
    approvedRevisionId = UUID.randomUUID();
  }

  private PartnerBusiness createRestaurantBusiness(OperationState opState, boolean acceptingNew) {
    return PartnerBusiness.builder()
        .id(businessId)
        .ownerUserId(ownerId)
        .kind(BusinessKind.RESTAURANT)
        .displayName("Lantern Kitchen")
        .approvalValidity(ApprovalValidity.VALID)
        .operationState(opState)
        .publicationState(PublicationState.PUBLISHED)
        .acceptingNew(acceptingNew)
        .requiresReverification(false)
        .approvedRevisionId(approvedRevisionId)
        .version(1L)
        .publicContactConsent(true)
        .build();
  }

  @Test
  @DisplayName("createRequest: creates valid reservation with REQUESTED state")
  void createRequest_success() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, true);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap = PartnerBusinessCapability.builder()
        .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.RESTAURANT_LISTING))
        .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING))
        .thenReturn(Optional.of(cap));

    when(reservationRepository.saveAndFlush(any(RestaurantReservation.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    CreateRestaurantReservationRequest req = new CreateRestaurantReservationRequest(
        Instant.now().plus(2, ChronoUnit.DAYS),
        "Asia/Ho_Chi_Minh",
        4,
        1,
        "Table by the window please"
    );

    RestaurantReservationDto result =
        reservationService.createRequest(customerUser, businessId, "req-key-1", req);

    assertThat(result).isNotNull();
    assertThat(result.businessId()).isEqualTo(businessId);
    assertThat(result.businessName()).isEqualTo("Lantern Kitchen");
    assertThat(result.customerId()).isEqualTo(customerId);
    assertThat(result.adults()).isEqualTo(4);
    assertThat(result.children()).isEqualTo(1);
    assertThat(result.state()).isEqualTo("REQUESTED");
    assertThat(result.notes()).isEqualTo("Table by the window please");

    verify(reservationRepository).saveAndFlush(any(RestaurantReservation.class));
    verify(transitionRepository).save(any(RestaurantReservationTransition.class));
  }

  @Test
  @DisplayName("createRequest: handles concurrent DataIntegrityViolationException and returns existing matching request")
  void createRequest_concurrentUniqueConflictRecovery() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.ACTIVE, true);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    PartnerBusinessCapability cap = PartnerBusinessCapability.builder()
        .id(new PartnerBusinessCapabilityId(businessId, PartnerCapability.RESTAURANT_LISTING))
        .build();
    when(capabilityRepository.findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING))
        .thenReturn(Optional.of(cap));

    CreateRestaurantReservationRequest req = new CreateRestaurantReservationRequest(
        Instant.now().plus(2, ChronoUnit.DAYS),
        "Asia/Ho_Chi_Minh",
        2,
        0,
        null
    );

    when(reservationRepository.saveAndFlush(any(RestaurantReservation.class)))
        .thenThrow(new org.springframework.dao.DataIntegrityViolationException("unique"));

    RestaurantReservation existing = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .customerId(customerId)
        .businessNameSnapshot("Lantern Kitchen")
        .state("REQUESTED")
        .version(0L)
        .createdAt(Instant.now())
        .updatedAt(Instant.now())
        .build();
    // compute matching hash
    try {
      java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
      String input = businessId + ":" + req.startAt().toEpochMilli() + ":" + req.timeZone() + ":2:0:";
      byte[] digest = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      existing.setRequestHash(HexFormat.of().formatHex(digest));
    } catch (Exception ignored) {}

    when(reservationRepository.findByCustomerIdAndRequestKey(customerId, "req-key-dup"))
        .thenReturn(Optional.empty())
        .thenReturn(Optional.of(existing));

    RestaurantReservationDto result =
        reservationService.createRequest(customerUser, businessId, "req-key-dup", req);

    assertThat(result).isNotNull();
    assertThat(result.businessId()).isEqualTo(businessId);
    assertThat(result.state()).isEqualTo("REQUESTED");
  }

  @Test
  @DisplayName("createRequest: fails if business is suspended or not accepting new")
  void createRequest_suspendedOrNotAccepting() {
    PartnerBusiness business = createRestaurantBusiness(OperationState.SUSPENDED, true);
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    CreateRestaurantReservationRequest req = new CreateRestaurantReservationRequest(
        Instant.now().plus(2, ChronoUnit.DAYS),
        "Asia/Ho_Chi_Minh",
        2,
        0,
        null
    );

    assertThatThrownBy(() -> reservationService.createRequest(customerUser, businessId, null, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("BUSINESS_SUSPENDED"));
  }

  @Test
  @DisplayName("cancelByCustomer: cancels REQUESTED reservation with expected version")
  void cancelByCustomer_success() {
    UUID resId = UUID.randomUUID();
    RestaurantReservation res = RestaurantReservation.builder()
        .id(resId)
        .businessId(businessId)
        .customerId(customerId)
        .state("REQUESTED")
        .version(1L)
        .createdAt(Instant.now())
        .updatedAt(Instant.now())
        .build();

    when(reservationRepository.lockById(resId)).thenReturn(Optional.of(res));
    when(reservationRepository.save(any(RestaurantReservation.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    RestaurantReservationDto result = reservationService.cancelByCustomer(
        customerUser,
        resId,
        new CancelRestaurantReservationRequest(1L, "Change of plans")
    );

    assertThat(result.state()).isEqualTo("CANCELLED");
    assertThat(result.cancellationReason()).isEqualTo("Change of plans");
    verify(transitionRepository).save(any(RestaurantReservationTransition.class));
  }

  @Test
  @DisplayName("decideByPartner: confirms reservation and records decision")
  void decideByPartner_confirm() {
    UUID resId = UUID.randomUUID();
    RestaurantReservation res = RestaurantReservation.builder()
        .id(resId)
        .businessId(businessId)
        .customerId(customerId)
        .state("REQUESTED")
        .version(2L)
        .createdAt(Instant.now())
        .updatedAt(Instant.now())
        .build();

    PartnerBusinessMember member = PartnerBusinessMember.builder()
        .id(new PartnerBusinessMemberId(businessId, ownerId))
        .role(MembershipRole.OWNER)
        .state(MembershipState.ACTIVE)
        .build();
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(member));

    when(reservationRepository.lockById(resId)).thenReturn(Optional.of(res));
    when(reservationRepository.save(any(RestaurantReservation.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    RestaurantReservationDto result = reservationService.decideByPartner(
        ownerUser,
        businessId,
        resId,
        new RestaurantReservationDecisionRequest(2L, "CONFIRM", "Table reserved")
    );

    assertThat(result.state()).isEqualTo("CONFIRMED");
    assertThat(result.decisionReason()).isEqualTo("Table reserved");
    verify(transitionRepository).save(any(RestaurantReservationTransition.class));
  }

  @Test
  @DisplayName("decideByPartner: fails on version conflict")
  void decideByPartner_versionConflict() {
    UUID resId = UUID.randomUUID();
    RestaurantReservation res = RestaurantReservation.builder()
        .id(resId)
        .businessId(businessId)
        .customerId(customerId)
        .state("REQUESTED")
        .version(5L)
        .build();

    PartnerBusinessMember member = PartnerBusinessMember.builder()
        .id(new PartnerBusinessMemberId(businessId, ownerId))
        .role(MembershipRole.OWNER)
        .state(MembershipState.ACTIVE)
        .build();
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(member));

    when(reservationRepository.lockById(resId)).thenReturn(Optional.of(res));

    assertThatThrownBy(() -> reservationService.decideByPartner(
        ownerUser,
        businessId,
        resId,
        new RestaurantReservationDecisionRequest(4L, "CONFIRM", null)
    ))
        .isInstanceOf(TripServiceException.class)
        .satisfies(ex -> assertThat(((TripServiceException) ex).code()).isEqualTo("VERSION_CONFLICT"));
  }
}
