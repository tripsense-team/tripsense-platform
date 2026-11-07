package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerSubscriptionServiceTest {

  @Mock private PartnerSubscriptionPlanRepository planRepository;
  @Mock private PartnerSubscriptionRepository subscriptionRepository;
  @Mock private PartnerSubscriptionOrderRepository orderRepository;
  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerNotificationRepository notificationRepository;

  @InjectMocks private PartnerSubscriptionService subscriptionService;

  private UUID businessId;
  private UUID userId;
  private AuthenticatedUser user;
  private PartnerBusiness business;
  private PartnerSubscriptionPlan plan;

  @BeforeEach
  void setUp() {
    businessId = UUID.randomUUID();
    userId = UUID.randomUUID();
    user = new AuthenticatedUser(userId, "partner@tripsense.vn", "USER", List.of("ROLE_USER"));

    business = PartnerBusiness.builder()
        .id(businessId)
        .kind(BusinessKind.RESTAURANT)
        .displayName("Bếp Quê Đặc Sản")
        .ownerUserId(userId)
        .build();

    plan = PartnerSubscriptionPlan.builder()
        .planId("REST_PLAN_1_YEAR")
        .businessKind(BusinessKind.RESTAURANT)
        .name("Gói Kim Cương (1 Năm)")
        .durationDays(365)
        .priceVnd(BigDecimal.valueOf(1599000))
        .active(true)
        .badgeLabel("Verified Partner")
        .build();
  }

  @Test
  void getPlans_returnsActivePlansInOrder() {
    when(planRepository.findByBusinessKindAndActiveOrderByDisplayOrderAsc(BusinessKind.RESTAURANT, true))
        .thenReturn(List.of(plan));

    List<PartnerSubscriptionPlanDto> plans = subscriptionService.getPlans(BusinessKind.RESTAURANT);

    assertThat(plans).hasSize(1);
    assertThat(plans.get(0).planId()).isEqualTo("REST_PLAN_1_YEAR");
    assertThat(plans.get(0).priceVnd()).isEqualByComparingTo("1599000");
  }

  @Test
  void getSubscription_whenNoSubscriptionExists_returnsTrial() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());

    PartnerSubscriptionDto dto = subscriptionService.getSubscription(user, businessId);

    assertThat(dto.status()).isEqualTo(SubscriptionStatus.TRIAL);
    assertThat(dto.isActive()).isFalse();
    assertThat(dto.daysRemaining()).isEqualTo(0);
  }

  @Test
  void getSubscription_whenUserIsStaffMember_success() {
    UUID staffUserId = UUID.randomUUID();
    AuthenticatedUser staffUser = new AuthenticatedUser(staffUserId, "staff@tripsense.vn", "USER", List.of("ROLE_USER"));
    PartnerBusinessMember staffMember = PartnerBusinessMember.builder()
        .id(new PartnerBusinessMemberId(businessId, staffUserId))
        .role(MembershipRole.STAFF)
        .state(MembershipState.ACTIVE)
        .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, staffUserId)).thenReturn(Optional.of(staffMember));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());

    PartnerSubscriptionDto dto = subscriptionService.getSubscription(staffUser, businessId);
    assertThat(dto.status()).isEqualTo(SubscriptionStatus.TRIAL);
  }

  @Test
  void getSubscription_whenActiveSubscriptionExists_returnsActiveWithRemainingDays() {
    Instant now = Instant.now();
    Instant validTo = now.plus(Duration.ofDays(30));

    PartnerSubscription sub = PartnerSubscription.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .currentPlanId("REST_PLAN_1_YEAR")
        .status(SubscriptionStatus.ACTIVE)
        .validFrom(now)
        .validTo(validTo)
        .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.of(sub));
    when(planRepository.findById("REST_PLAN_1_YEAR")).thenReturn(Optional.of(plan));

    PartnerSubscriptionDto dto = subscriptionService.getSubscription(user, businessId);

    assertThat(dto.status()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(dto.isActive()).isTrue();
    assertThat(dto.daysRemaining()).isGreaterThanOrEqualTo(29);
    assertThat(dto.badgeLabel()).isEqualTo("Verified Partner");
  }

  @Test
  void createCheckout_validPlan_createsOrder() {
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(planRepository.findByPlanIdAndActiveTrue("REST_PLAN_1_YEAR")).thenReturn(Optional.of(plan));
    when(orderRepository.saveAndFlush(any())).thenAnswer(invocation -> {
      PartnerSubscriptionOrder o = invocation.getArgument(0);
      o.setOrderCode(30000001L);
      return o;
    });

    SubscriptionCheckoutRequest req = new SubscriptionCheckoutRequest("REST_PLAN_1_YEAR", null, null);
    SubscriptionCheckoutResponse res = subscriptionService.createCheckout(user, businessId, req);

    assertThat(res.orderCode()).isEqualTo(30000001L);
    assertThat(res.amount()).isEqualByComparingTo("1599000");
    assertThat(res.planId()).isEqualTo("REST_PLAN_1_YEAR");
    assertThat(res.paymentStatus()).isEqualTo("PENDING");
  }

  @Test
  void verifyManualPayment_activatesSubscriptionAndReturnsActive() {
    PartnerSubscriptionOrder order = PartnerSubscriptionOrder.builder()
        .id(UUID.randomUUID())
        .orderCode(30000002L)
        .businessId(businessId)
        .planId("REST_PLAN_1_YEAR")
        .amount(BigDecimal.valueOf(1599000))
        .paymentStatus(SubscriptionPaymentStatus.PENDING)
        .build();

    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));
    when(orderRepository.findByOrderCode(30000002L)).thenReturn(Optional.of(order));
    when(planRepository.findById("REST_PLAN_1_YEAR")).thenReturn(Optional.of(plan));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());

    PartnerSubscriptionDto result = subscriptionService.verifyManualPayment(user, businessId, 30000002L);

    assertThat(order.getPaymentStatus()).isEqualTo(SubscriptionPaymentStatus.PAID);
    assertThat(order.getPaidAt()).isNotNull();
    assertThat(business.getApprovalValidity()).isEqualTo(ApprovalValidity.VALID);
    assertThat(business.getPublicationState()).isEqualTo(PublicationState.PUBLISHED);
    verify(businessRepository).save(business);
    verify(subscriptionRepository).save(any(PartnerSubscription.class));
    verify(notificationRepository).save(any(PartnerNotification.class));
  }

  @Test
  void handlePaidWebhook_activatesSubscriptionAndNotifiesOwner() {
    PartnerSubscriptionOrder order = PartnerSubscriptionOrder.builder()
        .id(UUID.randomUUID())
        .orderCode(30000001L)
        .businessId(businessId)
        .planId("REST_PLAN_1_YEAR")
        .amount(BigDecimal.valueOf(1599000))
        .paymentStatus(SubscriptionPaymentStatus.PENDING)
        .build();

    when(orderRepository.findByOrderCode(30000001L)).thenReturn(Optional.of(order));
    when(planRepository.findById("REST_PLAN_1_YEAR")).thenReturn(Optional.of(plan));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.empty());
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    subscriptionService.handlePaidWebhook(30000001L, 1599000L, "VND", "ref-123", Instant.now());

    assertThat(order.getPaymentStatus()).isEqualTo(SubscriptionPaymentStatus.PAID);
    assertThat(business.getApprovalValidity()).isEqualTo(ApprovalValidity.VALID);
    assertThat(business.getPublicationState()).isEqualTo(PublicationState.PUBLISHED);
    verify(businessRepository).save(business);
    verify(subscriptionRepository).save(any(PartnerSubscription.class));
    verify(notificationRepository).save(any(PartnerNotification.class));
  }

  @Test
  void handlePaidWebhook_accumulatesDaysIfAlreadyActive() {
    Instant now = Instant.now();
    Instant currentExpiry = now.plus(Duration.ofDays(10));

    PartnerSubscriptionOrder order = PartnerSubscriptionOrder.builder()
        .id(UUID.randomUUID())
        .orderCode(30000001L)
        .businessId(businessId)
        .planId("REST_PLAN_1_YEAR")
        .amount(BigDecimal.valueOf(1599000))
        .paymentStatus(SubscriptionPaymentStatus.PENDING)
        .build();

    PartnerSubscription existingSub = PartnerSubscription.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .status(SubscriptionStatus.ACTIVE)
        .validFrom(now.minus(Duration.ofDays(20)))
        .validTo(currentExpiry)
        .build();

    when(orderRepository.findByOrderCode(30000001L)).thenReturn(Optional.of(order));
    when(planRepository.findById("REST_PLAN_1_YEAR")).thenReturn(Optional.of(plan));
    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.of(existingSub));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    subscriptionService.handlePaidWebhook(30000001L, 1599000L, "VND", "ref-123", now);

    assertThat(order.getPaymentStatus()).isEqualTo(SubscriptionPaymentStatus.PAID);
    assertThat(existingSub.getValidTo()).isAfter(currentExpiry.plus(Duration.ofDays(360)));
    verify(businessRepository).save(business);
  }

  @Test
  void expireOverdueSubscriptions_marksStatusAsExpired() {
    Instant past = Instant.now().minus(Duration.ofDays(1));
    PartnerSubscription overdueSub = PartnerSubscription.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .status(SubscriptionStatus.ACTIVE)
        .validTo(past)
        .build();

    when(subscriptionRepository.findByStatusAndValidToBefore(eq(SubscriptionStatus.ACTIVE), any(Instant.class)))
        .thenReturn(List.of(overdueSub));
    when(businessRepository.findById(businessId)).thenReturn(Optional.of(business));

    subscriptionService.expireOverdueSubscriptions();

    assertThat(overdueSub.getStatus()).isEqualTo(SubscriptionStatus.EXPIRED);
    verify(subscriptionRepository).save(overdueSub);
    verify(notificationRepository).save(any(PartnerNotification.class));
  }

  @Test
  void isVerifiedPartner_returnsTrueOnlyWhenActiveAndValid() {
    Instant now = Instant.now();
    PartnerSubscription activeSub = PartnerSubscription.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .status(SubscriptionStatus.ACTIVE)
        .validTo(now.plus(Duration.ofDays(10)))
        .build();

    when(subscriptionRepository.findByBusinessId(businessId)).thenReturn(Optional.of(activeSub));

    boolean verified = subscriptionService.isVerifiedPartner(businessId);
    assertThat(verified).isTrue();
  }
}
