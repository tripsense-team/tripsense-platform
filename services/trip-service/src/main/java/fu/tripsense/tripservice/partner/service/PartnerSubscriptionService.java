package fu.tripsense.tripservice.partner.service;

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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.payos.PayOS;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;

@Service
public class PartnerSubscriptionService {

  private static final Logger log = LoggerFactory.getLogger(PartnerSubscriptionService.class);

  private final PartnerSubscriptionPlanRepository planRepository;
  private final PartnerSubscriptionRepository subscriptionRepository;
  private final PartnerSubscriptionOrderRepository orderRepository;
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerNotificationRepository notificationRepository;

  @Nullable private final PayOS payOS;
  @Nullable private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

  @Value("${payos.enabled:false}")
  private boolean payosEnabled;

  @Value("${payos.return-base-url:http://localhost:3000}")
  private String returnBaseUrl;

  public PartnerSubscriptionService(
      PartnerSubscriptionPlanRepository planRepository,
      PartnerSubscriptionRepository subscriptionRepository,
      PartnerSubscriptionOrderRepository orderRepository,
      PartnerBusinessRepository businessRepository,
      PartnerBusinessMemberRepository memberRepository,
      PartnerNotificationRepository notificationRepository,
      @Autowired(required = false) @Nullable PayOS payOS,
      @Autowired(required = false) @Nullable org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
    this.planRepository = planRepository;
    this.subscriptionRepository = subscriptionRepository;
    this.orderRepository = orderRepository;
    this.businessRepository = businessRepository;
    this.memberRepository = memberRepository;
    this.notificationRepository = notificationRepository;
    this.payOS = payOS;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Transactional(readOnly = true)
  public List<PartnerSubscriptionPlanDto> getPlans(BusinessKind businessKind) {
    return planRepository
        .findByBusinessKindAndActiveOrderByDisplayOrderAsc(businessKind, true)
        .stream()
        .map(PartnerSubscriptionPlanDto::fromEntity)
        .toList();
  }

  @Transactional(readOnly = true)
  public PartnerSubscriptionDto getSubscription(AuthenticatedUser user, UUID businessId) {
    PartnerBusiness business = getBusiness(businessId);
    checkPartnerAccess(user, business, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF));

    PartnerSubscription sub = subscriptionRepository.findByBusinessId(businessId).orElse(null);
    PartnerSubscriptionPlanDto planDto = null;
    if (sub != null && sub.getCurrentPlanId() != null) {
      planDto = planRepository.findById(sub.getCurrentPlanId())
          .map(PartnerSubscriptionPlanDto::fromEntity)
          .orElse(null);
    }

    return PartnerSubscriptionDto.of(sub, business.getKind(), planDto);
  }

  @Transactional
  public SubscriptionCheckoutResponse createCheckout(
      AuthenticatedUser user, UUID businessId, SubscriptionCheckoutRequest request) {
    PartnerBusiness business = getBusiness(businessId);
    checkPartnerAccess(user, business, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    PartnerSubscriptionPlan plan = null;
    if (request.planId() != null && !request.planId().isBlank()) {
      plan = planRepository.findByPlanIdAndActiveTrue(request.planId()).orElse(null);
    }

    if (plan == null || plan.getBusinessKind() != business.getKind()) {
      int targetDuration = plan != null ? plan.getDurationDays() : 30;
      plan = planRepository.findByBusinessKindAndDurationDaysAndActiveTrue(business.getKind(), targetDuration)
          .or(() -> planRepository.findByBusinessKindAndActiveOrderByDisplayOrderAsc(business.getKind(), true).stream().findFirst())
          .orElseThrow(() -> new TripServiceException("PLAN_NOT_FOUND", "No active subscription plan found for " + business.getKind(), HttpStatus.NOT_FOUND));
    }

    BigDecimal amount = plan.getPriceVnd();
    UUID orderId = UUID.randomUUID();

    Long orderCode = null;
    if (jdbcTemplate != null) {
      try {
        orderCode = jdbcTemplate.queryForObject("SELECT nextval('partner_payos_order_code_seq')", Long.class);
      } catch (Exception e) {
        log.warn("Failed to get nextval from sequence, using fallback orderCode: {}", e.getMessage());
      }
    }
    if (orderCode == null) {
      orderCode = 30000000L + (System.currentTimeMillis() % 10000000L) * 100L + (long)(Math.random() * 90 + 10);
    }

    PartnerSubscriptionOrder order = PartnerSubscriptionOrder.builder()
        .id(orderId)
        .orderCode(orderCode)
        .businessId(businessId)
        .planId(plan.getPlanId())
        .amount(amount)
        .paymentStatus(SubscriptionPaymentStatus.PENDING)
        .createdAt(Instant.now())
        .updatedAt(Instant.now())
        .build();

    order = orderRepository.saveAndFlush(order);
    if (order.getOrderCode() != null) {
      orderCode = order.getOrderCode();
    }

    String returnUrl = request.returnUrl() != null && !request.returnUrl().isBlank()
        ? request.returnUrl()
        : returnBaseUrl + "/partner/services?businessId=" + businessId + "&status=success";

    String cancelUrl = request.cancelUrl() != null && !request.cancelUrl().isBlank()
        ? request.cancelUrl()
        : returnBaseUrl + "/partner/services?businessId=" + businessId + "&status=cancelled";

    String qrCode = null;
    String paymentUrl = null;
    String paymentLinkId = null;

    if (payosEnabled && payOS != null) {
      try {
        String description = "TS Sub " + orderCode;
        if (description.length() > 25) {
          description = description.substring(0, 25);
        }

        var payosReq = CreatePaymentLinkRequest.builder()
            .orderCode(orderCode)
            .amount(amount.longValue())
            .description(description)
            .cancelUrl(cancelUrl)
            .returnUrl(returnUrl)
            .build();

        var link = payOS.paymentRequests().create(payosReq);
        paymentUrl = link.getCheckoutUrl();
        paymentLinkId = link.getPaymentLinkId();
        qrCode = link.getQrCode();
        log.info("payos_subscription_created orderCode={} linkId={}", orderCode, paymentLinkId);
      } catch (Exception e) {
        log.error("payos_subscription_create_failed orderCode={} error={}", orderCode, e.getMessage(), e);
        throw new TripServiceException("PAYOS_CREATE_FAILED", "Không thể kết nối cổng thanh toán PayOS: " + e.getMessage(), HttpStatus.SERVICE_UNAVAILABLE);
      }
    } else {
      paymentUrl = returnUrl + "&demoOrderCode=" + orderCode;
      qrCode = "PAYOS_SIMULATED_" + orderCode;
    }

    order.setPayosPaymentLinkId(paymentLinkId);
    order.setQrCode(qrCode);
    order.setPaymentUrl(paymentUrl);
    orderRepository.save(order);

    return new SubscriptionCheckoutResponse(
        orderId,
        orderCode,
        plan.getPlanId(),
        plan.getName(),
        amount,
        qrCode,
        paymentUrl,
        order.getPaymentStatus().name()
    );
  }

  @Transactional
  public Map<String, Object> getOrderStatus(AuthenticatedUser user, UUID businessId, Long orderCode) {
    PartnerBusiness business = getBusiness(businessId);
    checkPartnerAccess(user, business, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER, MembershipRole.STAFF));

    PartnerSubscriptionOrder order = orderRepository
        .findByOrderCode(orderCode)
        .orElseThrow(() -> new TripServiceException("ORDER_NOT_FOUND", "Subscription order not found", HttpStatus.NOT_FOUND));

    if (!order.getBusinessId().equals(businessId)) {
      throw new TripServiceException("FORBIDDEN", "Order belongs to a different business", HttpStatus.FORBIDDEN);
    }

    // Auto-reconciliation via PayOS API during polling
    if (order.getPaymentStatus() == SubscriptionPaymentStatus.PENDING && payosEnabled && payOS != null) {
      try {
        String lookupId = order.getPayosPaymentLinkId() != null && !order.getPayosPaymentLinkId().isBlank()
            ? order.getPayosPaymentLinkId()
            : String.valueOf(orderCode);
        var info = payOS.paymentRequests().get(lookupId);
        String providerStatus = info != null && info.getStatus() != null ? info.getStatus().name() : "";

        if ("PAID".equalsIgnoreCase(providerStatus)) {
          order.setPaymentStatus(SubscriptionPaymentStatus.PAID);
          order.setPaidAt(Instant.now());
          order.setUpdatedAt(Instant.now());
          orderRepository.save(order);
          activateSubscription(businessId, order.getPlanId(), order.getPaidAt());
          log.info("payos_subscription_auto_reconciled_paid orderCode={} businessId={}", orderCode, businessId);
        } else if ("CANCELLED".equalsIgnoreCase(providerStatus) || "EXPIRED".equalsIgnoreCase(providerStatus)) {
          order.setPaymentStatus(SubscriptionPaymentStatus.FAILED);
          order.setUpdatedAt(Instant.now());
          orderRepository.save(order);
          log.info("payos_subscription_marked_{} orderCode={} businessId={}", providerStatus, orderCode, businessId);
        }
      } catch (Exception e) {
        log.warn("payos_subscription_status_check_failed orderCode={} error={}", orderCode, e.getMessage());
      }
    }

    return Map.of(
        "orderCode", order.getOrderCode(),
        "status", order.getPaymentStatus().name(),
        "amount", order.getAmount(),
        "paidAt", order.getPaidAt() != null ? order.getPaidAt().toString() : ""
    );
  }

  @Transactional
  public PartnerSubscriptionDto verifyManualPayment(AuthenticatedUser user, UUID businessId, Long orderCode) {
    PartnerBusiness business = getBusiness(businessId);
    checkPartnerAccess(user, business, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    PartnerSubscriptionOrder order = orderRepository
        .findByOrderCode(orderCode)
        .orElseThrow(() -> new TripServiceException("ORDER_NOT_FOUND", "Subscription order not found", HttpStatus.NOT_FOUND));

    if (!order.getBusinessId().equals(businessId)) {
      throw new TripServiceException("FORBIDDEN", "Order belongs to a different business", HttpStatus.FORBIDDEN);
    }

    if (order.getPaymentStatus() != SubscriptionPaymentStatus.PAID) {
      order.setPaymentStatus(SubscriptionPaymentStatus.PAID);
      order.setPaidAt(Instant.now());
      order.setUpdatedAt(Instant.now());
      orderRepository.save(order);

      activateSubscription(businessId, order.getPlanId(), order.getPaidAt());
    }

    return getSubscription(user, businessId);
  }

  @Transactional
  public void handlePaidWebhook(
      Long orderCode, Long receivedAmount, String currency, String providerReference, Instant receivedAt) {
    Optional<PartnerSubscriptionOrder> optOrder = orderRepository.findByOrderCode(orderCode);
    if (optOrder.isEmpty()) {
      log.warn("subscription_webhook_unknown_order orderCode={}", orderCode);
      return;
    }

    PartnerSubscriptionOrder order = optOrder.get();
    if (order.getPaymentStatus() == SubscriptionPaymentStatus.PAID) {
      log.info("subscription_webhook_already_paid orderCode={}", orderCode);
      return;
    }

    long expectedAmount = order.getAmount().longValue();
    if (receivedAmount != expectedAmount || !"VND".equalsIgnoreCase(currency)) {
      log.warn("subscription_amount_mismatch orderCode={} expected={} received={}", orderCode, expectedAmount, receivedAmount);
      order.setPaymentStatus(SubscriptionPaymentStatus.FAILED);
      orderRepository.save(order);
      return;
    }

    // Mark Order PAID
    order.setPaymentStatus(SubscriptionPaymentStatus.PAID);
    order.setPaidAt(receivedAt != null ? receivedAt : Instant.now());
    order.setUpdatedAt(Instant.now());
    orderRepository.save(order);

    activateSubscription(order.getBusinessId(), order.getPlanId(), order.getPaidAt());
  }

  @Transactional
  public void activateSubscription(UUID businessId, String planId, Instant paidAt) {
    PartnerSubscriptionPlan plan = planRepository.findById(planId).orElse(null);
    int durationDays = plan != null ? plan.getDurationDays() : 30;

    PartnerSubscription sub = subscriptionRepository.findByBusinessId(businessId).orElse(null);
    Instant now = paidAt != null ? paidAt : Instant.now();

    if (sub == null) {
      sub = PartnerSubscription.builder()
          .id(UUID.randomUUID())
          .businessId(businessId)
          .currentPlanId(planId)
          .status(SubscriptionStatus.ACTIVE)
          .validFrom(now)
          .validTo(now.plus(Duration.ofDays(durationDays)))
          .lastPaymentAt(now)
          .createdAt(now)
          .updatedAt(now)
          .build();
    } else {
      Instant startFrom = (sub.getStatus() == SubscriptionStatus.ACTIVE && sub.getValidTo() != null && sub.getValidTo().isAfter(now))
          ? sub.getValidTo()
          : now;

      sub.setCurrentPlanId(planId);
      sub.setStatus(SubscriptionStatus.ACTIVE);
      if (sub.getValidFrom() == null || sub.getValidTo() == null || sub.getValidTo().isBefore(now)) {
        sub.setValidFrom(now);
      }
      sub.setValidTo(startFrom.plus(Duration.ofDays(durationDays)));
      sub.setLastPaymentAt(now);
      sub.setUpdatedAt(now);
    }

    subscriptionRepository.save(sub);
    log.info("partner_subscription_activated businessId={} plan={} validTo={}", businessId, planId, sub.getValidTo());

    // Auto-approve, activate, and publish business upon subscription activation
    PartnerBusiness business = businessRepository.findById(businessId).orElse(null);
    if (business != null) {
      business.setApprovalValidity(ApprovalValidity.VALID);
      business.setOperationState(OperationState.ACTIVE);
      business.setPublicationState(PublicationState.PUBLISHED);
      business.setAcceptingNew(true);
      business.setRequiresReverification(false);
      business.setUpdatedAt(now);
      businessRepository.save(business);
      log.info("partner_business_auto_approved_on_subscription businessId={}", businessId);

      // Send confirmation notification to business owner
      notificationRepository.save(
          PartnerNotification.builder()
              .id(UUID.randomUUID())
              .eventId(UUID.randomUUID())
              .recipientId(business.getOwnerUserId())
              .eventType("PARTNER_SUBSCRIPTION_ACTIVATED")
              .businessId(businessId)
              .message("Chúc mừng! Gói đối tác " + (plan != null ? plan.getName() : "") + " đã được kích hoạt thành công. Quán của bạn đã được ưu tiên hiển thị trên TripSense!")
              .createdAt(Instant.now())
              .build()
      );
    }
  }

  @Transactional(readOnly = true)
  public boolean isVerifiedPartner(UUID businessId) {
    if (businessId == null) return false;
    return subscriptionRepository.findByBusinessId(businessId)
        .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE 
            && s.getValidTo() != null 
            && s.getValidTo().isAfter(Instant.now()))
        .isPresent();
  }

  @org.springframework.scheduling.annotation.Scheduled(fixedDelayString = "${partner.subscription.check-interval-ms:60000}")
  @Transactional
  public void expireOverdueSubscriptions() {
    Instant now = Instant.now();
    List<PartnerSubscription> overdue = subscriptionRepository.findByStatusAndValidToBefore(SubscriptionStatus.ACTIVE, now);
    for (PartnerSubscription sub : overdue) {
      sub.setStatus(SubscriptionStatus.EXPIRED);
      sub.setUpdatedAt(now);
      subscriptionRepository.save(sub);
      log.info("partner_subscription_expired businessId={}", sub.getBusinessId());

      PartnerBusiness business = businessRepository.findById(sub.getBusinessId()).orElse(null);
      if (business != null) {
        notificationRepository.save(
            PartnerNotification.builder()
                .id(UUID.randomUUID())
                .eventId(UUID.randomUUID())
                .recipientId(business.getOwnerUserId())
                .eventType("PARTNER_SUBSCRIPTION_EXPIRED")
                .businessId(sub.getBusinessId())
                .message("Gói đối tác của bạn đã hết hạn. Vui lòng gia hạn ngay để không bị gián đoạn đề xuất AI và các quyền lợi ưu tiên!")
                .createdAt(Instant.now())
                .build()
        );
      }
    }
  }

  private PartnerBusiness getBusiness(UUID businessId) {
    return businessRepository
        .findById(businessId)
        .orElseThrow(() -> new TripServiceException("BUSINESS_NOT_FOUND", "Business not found", HttpStatus.NOT_FOUND));
  }

  private void checkPartnerAccess(AuthenticatedUser user, PartnerBusiness business, Set<MembershipRole> allowedRoles) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    // Direct owner always has access
    if (user.id().equals(business.getOwnerUserId())) {
      return;
    }
    // Otherwise check business membership
    PartnerBusinessMember member = memberRepository
        .findByIdBusinessIdAndIdUserId(business.getId(), user.id())
        .orElseThrow(() -> new TripServiceException("FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));

    if (member.getState() != MembershipState.ACTIVE || !allowedRoles.contains(member.getRole())) {
      throw new TripServiceException("FORBIDDEN", "Insufficient membership permissions", HttpStatus.FORBIDDEN);
    }
  }
}
