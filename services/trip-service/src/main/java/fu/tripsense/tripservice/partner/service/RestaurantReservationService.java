package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RestaurantReservationService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final RestaurantReservationRepository reservationRepository;
  private final RestaurantReservationTransitionRepository transitionRepository;
  private final PartnerNotificationRepository notificationRepository;

  @Transactional
  public RestaurantReservationDto createRequest(
      AuthenticatedUser user,
      UUID businessId,
      String requestKey,
      CreateRestaurantReservationRequest req) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    PartnerBusiness business = businessRepository.findById(businessId).orElseThrow(
        () -> new TripServiceException("RESTAURANT_NOT_FOUND", "Restaurant not found", HttpStatus.NOT_FOUND));

    if (business.getKind() != BusinessKind.RESTAURANT) {
      throw new TripServiceException("RESTAURANT_NOT_FOUND", "Business is not a restaurant", HttpStatus.NOT_FOUND);
    }

    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Restaurant is currently suspended", HttpStatus.FORBIDDEN);
    }

    if (!business.isAcceptingNew()) {
      throw new TripServiceException("RESTAURANT_NOT_ACCEPTING", "Restaurant is not currently accepting reservations", HttpStatus.BAD_REQUEST);
    }

    boolean hasListingCap = capabilityRepository
        .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING)
        .filter(c -> c.getRevokedAt() == null)
        .isPresent();

    if (!business.isPublicEligible(hasListingCap)) {
      throw new TripServiceException("RESTAURANT_NOT_ELIGIBLE", "Restaurant is not publicly available", HttpStatus.FORBIDDEN);
    }

    if (req.adults() < 1 || req.adults() > 20) {
      throw new TripServiceException("INVALID_GUESTS", "Adults must be between 1 and 20", HttpStatus.BAD_REQUEST);
    }

    if (req.children() < 0 || req.children() > 20 || (req.adults() + req.children()) > 20) {
      throw new TripServiceException("INVALID_GUESTS", "Total guests must not exceed 20", HttpStatus.BAD_REQUEST);
    }

    Instant now = Instant.now();
    if (!req.startAt().isAfter(now)) {
      throw new TripServiceException("INVALID_START_TIME", "Reservation time must be in the future", HttpStatus.BAD_REQUEST);
    }

    if (req.startAt().isAfter(now.plus(180, ChronoUnit.DAYS))) {
      throw new TripServiceException("INVALID_START_TIME", "Reservation cannot be more than 180 days in advance", HttpStatus.BAD_REQUEST);
    }

    try {
      ZoneId.of(req.timeZone());
    } catch (DateTimeException e) {
      throw new TripServiceException("INVALID_TIME_ZONE", "Invalid IANA time zone identifier", HttpStatus.BAD_REQUEST);
    }

    String hash = computeHash(businessId, req);

    if (requestKey != null && !requestKey.isBlank()) {
      var existing = reservationRepository.findByCustomerIdAndRequestKey(user.id(), requestKey);
      if (existing.isPresent()) {
        RestaurantReservation r = existing.get();
        if (Objects.equals(r.getRequestHash(), hash)) {
          return toDto(r);
        } else {
          throw new TripServiceException("IDEMPOTENCY_CONFLICT", "Idempotency key reused with different request payload", HttpStatus.CONFLICT);
        }
      }
    }

    UUID resId = UUID.randomUUID();
    RestaurantReservation reservation = RestaurantReservation.builder()
        .id(resId)
        .businessId(businessId)
        .customerId(user.id())
        .customerEmail(user.email())
        .customerName(user.email() != null && user.email().contains("@") ? user.email().split("@")[0] : "Customer")
        .businessNameSnapshot(business.getDisplayName())
        .startAt(req.startAt())
        .timeZone(req.timeZone())
        .adults(req.adults())
        .children(req.children())
        .notes(req.notes() != null && !req.notes().isBlank() ? req.notes().trim() : null)
        .state("REQUESTED")
        .requestKey(requestKey != null && !requestKey.isBlank() ? requestKey.trim() : null)
        .requestHash(hash)
        .version(0L)
        .createdAt(now)
        .updatedAt(now)
        .build();

    try {
      reservation = reservationRepository.saveAndFlush(reservation);
    } catch (DataIntegrityViolationException ex) {
      if (requestKey != null && !requestKey.isBlank()) {
        var existing = reservationRepository.findByCustomerIdAndRequestKey(user.id(), requestKey.trim());
        if (existing.isPresent()) {
          RestaurantReservation r = existing.get();
          if (Objects.equals(r.getRequestHash(), hash)) {
            return toDto(r);
          } else {
            throw new TripServiceException("IDEMPOTENCY_CONFLICT", "Idempotency key reused with different request payload", HttpStatus.CONFLICT);
          }
        }
      }
      throw new TripServiceException("IDEMPOTENCY_CONFLICT", "Duplicate concurrent request", HttpStatus.CONFLICT);
    }

    transitionRepository.save(RestaurantReservationTransition.builder()
        .id(UUID.randomUUID())
        .reservationId(resId)
        .actorId(user.id())
        .actorRole("CUSTOMER")
        .fromState("NONE")
        .toState("REQUESTED")
        .reason("Initial reservation request")
        .createdAt(now)
        .build());

    // Notify business owners and managers
    try {
      List<PartnerBusinessMember> activeMembers =
          memberRepository.findByIdBusinessIdAndState(businessId, MembershipState.ACTIVE);
      for (PartnerBusinessMember member : activeMembers) {
        if (member.getRole() == MembershipRole.OWNER || member.getRole() == MembershipRole.MANAGER) {
          String msg = String.format(
              "Yêu cầu đặt bàn mới từ %s (%d khách) vào lúc %s.",
              reservation.getCustomerName() != null ? reservation.getCustomerName() : "Khách hàng",
              req.adults() + req.children(),
              req.startAt());
          notificationRepository.save(
              PartnerNotification.builder()
                  .id(UUID.randomUUID())
                  .eventId(resId)
                  .recipientId(member.getId().getUserId())
                  .eventType("RESTAURANT_RESERVATION_REQUESTED")
                  .businessId(businessId)
                  .message(msg)
                  .createdAt(now)
                  .build());
        }
      }

      // Also notify the customer that request was placed
      String customerMsg = String.format(
          "Yêu cầu đặt bàn tại %s (%d khách) vào lúc %s đã được gửi thành công. Vui lòng chờ quán xác nhận.",
          reservation.getBusinessNameSnapshot(),
          req.adults() + req.children(),
          req.startAt());
      notificationRepository.save(
          PartnerNotification.builder()
              .id(UUID.randomUUID())
              .eventId(UUID.randomUUID())
              .recipientId(user.id())
              .eventType("RESTAURANT_RESERVATION_PLACED")
              .businessId(businessId)
              .message(customerMsg)
              .createdAt(now)
              .build());
    } catch (Exception ex) {
      log.warn("Failed to dispatch restaurant reservation notification: {}", ex.getMessage());
    }

    return toDto(reservation);
  }

  @Transactional(readOnly = true)
  public Page<RestaurantReservationDto> getCustomerReservations(AuthenticatedUser user, int page, int size) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    int p = Math.max(0, page);
    int s = Math.min(50, Math.max(1, size));
    return reservationRepository.findByCustomerIdOrderByCreatedAtDesc(user.id(), PageRequest.of(p, s))
        .map(this::toDto);
  }

  @Transactional(readOnly = true)
  public RestaurantReservationDto getReservation(AuthenticatedUser user, UUID reservationId) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    RestaurantReservation reservation = reservationRepository.findById(reservationId).orElseThrow(
        () -> new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND));

    boolean isCustomer = user.id().equals(reservation.getCustomerId());
    boolean isBusinessMember = isMember(user, reservation.getBusinessId(), Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    if (!isCustomer && !isBusinessMember && !"ROLE_ADMIN".equals(user.role())) {
      throw new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND);
    }

    return toDto(reservation);
  }

  @Transactional
  public RestaurantReservationDto cancelByCustomer(
      AuthenticatedUser user, UUID reservationId, CancelRestaurantReservationRequest req) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    RestaurantReservation reservation = reservationRepository.lockById(reservationId).orElseThrow(
        () -> new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND));

    if (!user.id().equals(reservation.getCustomerId())) {
      throw new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND);
    }

    if ("CANCELLED".equals(reservation.getState())) {
      return toDto(reservation);
    }

    if ("REJECTED".equals(reservation.getState())) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Reservation has already been rejected", HttpStatus.BAD_REQUEST);
    }

    if (!Objects.equals(reservation.getVersion(), req.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Reservation was modified by another party", HttpStatus.CONFLICT);
    }

    String fromState = reservation.getState();
    Instant now = Instant.now();
    reservation.setState("CANCELLED");
    reservation.setCancellationReason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Cancelled by customer");
    reservation.setUpdatedAt(now);
    reservation = reservationRepository.save(reservation);

    transitionRepository.save(RestaurantReservationTransition.builder()
        .id(UUID.randomUUID())
        .reservationId(reservation.getId())
        .actorId(user.id())
        .actorRole("CUSTOMER")
        .fromState(fromState)
        .toState("CANCELLED")
        .reason(reservation.getCancellationReason())
        .createdAt(now)
        .build());

    return toDto(reservation);
  }

  @Transactional(readOnly = true)
  public Page<RestaurantReservationDto> getBusinessReservations(
      AuthenticatedUser user, UUID businessId, String stateFilter, int page, int size) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    int p = Math.max(0, page);
    int s = Math.min(50, Math.max(1, size));
    PageRequest pageable = PageRequest.of(p, s);

    if (stateFilter != null && !stateFilter.isBlank() && !stateFilter.equalsIgnoreCase("ALL")) {
      return reservationRepository.findByBusinessIdAndStateOrderByStartAtAsc(businessId, stateFilter.toUpperCase(Locale.ROOT), pageable)
          .map(this::toDto);
    }
    return reservationRepository.findByBusinessIdOrderByStartAtAsc(businessId, pageable)
        .map(this::toDto);
  }

  @Transactional
  public RestaurantReservationDto decideByPartner(
      AuthenticatedUser user,
      UUID businessId,
      UUID reservationId,
      RestaurantReservationDecisionRequest req) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));

    RestaurantReservation reservation = reservationRepository.lockById(reservationId).orElseThrow(
        () -> new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND));

    if (!businessId.equals(reservation.getBusinessId())) {
      throw new TripServiceException("RESERVATION_NOT_FOUND", "Reservation not found", HttpStatus.NOT_FOUND);
    }

    if (!Objects.equals(reservation.getVersion(), req.expectedVersion())) {
      throw new TripServiceException("VERSION_CONFLICT", "Reservation was modified by another party", HttpStatus.CONFLICT);
    }

    String decision = req.decision().toUpperCase(Locale.ROOT);
    String fromState = reservation.getState();
    Instant now = Instant.now();

    if ("CONFIRM".equals(decision)) {
      if (!"REQUESTED".equals(fromState)) {
        throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only confirm a requested reservation", HttpStatus.BAD_REQUEST);
      }
      reservation.setState("CONFIRMED");
      reservation.setDecisionReason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : null);
    } else if ("REJECT".equals(decision)) {
      if (!"REQUESTED".equals(fromState)) {
        throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only reject a requested reservation", HttpStatus.BAD_REQUEST);
      }
      reservation.setState("REJECTED");
      reservation.setDecisionReason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : null);
    } else if ("CANCEL".equals(decision)) {
      if (!Set.of("REQUESTED", "CONFIRMED").contains(fromState)) {
        throw new TripServiceException("INVALID_STATE_TRANSITION", "Reservation is not active", HttpStatus.BAD_REQUEST);
      }
      reservation.setState("CANCELLED");
      reservation.setCancellationReason(req.reason() != null && !req.reason().isBlank() ? req.reason().trim() : "Cancelled by restaurant");
    } else {
      throw new TripServiceException("INVALID_DECISION", "Decision must be CONFIRM, REJECT, or CANCEL", HttpStatus.BAD_REQUEST);
    }

    reservation.setUpdatedAt(now);
    reservation = reservationRepository.save(reservation);

    transitionRepository.save(RestaurantReservationTransition.builder()
        .id(UUID.randomUUID())
        .reservationId(reservation.getId())
        .actorId(user.id())
        .actorRole("PARTNER")
        .fromState(fromState)
        .toState(reservation.getState())
        .reason(req.reason() != null ? req.reason().trim() : null)
        .createdAt(now)
        .build());

    // Notify customer about reservation decision
    try {
      String decisionMsg;
      String eventType;
      if ("CONFIRMED".equals(reservation.getState())) {
        decisionMsg = String.format("Nhà hàng %s đã XÁC NHẬN yêu cầu đặt bàn của bạn vào lúc %s.",
            reservation.getBusinessNameSnapshot(), reservation.getStartAt());
        eventType = "RESTAURANT_RESERVATION_CONFIRMED";
      } else if ("REJECTED".equals(reservation.getState())) {
        decisionMsg = String.format("Nhà hàng %s đã TỪ CHỐI yêu cầu đặt bàn của bạn.%s",
            reservation.getBusinessNameSnapshot(),
            req.reason() != null && !req.reason().isBlank() ? " Lý do: " + req.reason().trim() : "");
        eventType = "RESTAURANT_RESERVATION_REJECTED";
      } else {
        decisionMsg = String.format("Nhà hàng %s đã HỦY yêu cầu đặt bàn của bạn.%s",
            reservation.getBusinessNameSnapshot(),
            req.reason() != null && !req.reason().isBlank() ? " Lý do: " + req.reason().trim() : "");
        eventType = "RESTAURANT_RESERVATION_CANCELLED";
      }

      notificationRepository.save(
          PartnerNotification.builder()
              .id(UUID.randomUUID())
              .eventId(UUID.randomUUID())
              .recipientId(reservation.getCustomerId())
              .eventType(eventType)
              .businessId(businessId)
              .message(decisionMsg)
              .createdAt(now)
              .build());
    } catch (Exception ex) {
      log.warn("Failed to dispatch restaurant reservation decision notification: {}", ex.getMessage());
    }

    return toDto(reservation);
  }

  private void requireMember(AuthenticatedUser user, UUID businessId, Set<MembershipRole> allowedRoles) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerBusinessMember member = memberRepository.findByIdBusinessIdAndIdUserId(businessId, user.id()).orElseThrow(
        () -> new TripServiceException("FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));

    if (member.getState() != MembershipState.ACTIVE || !allowedRoles.contains(member.getRole())) {
      throw new TripServiceException("FORBIDDEN", "Insufficient membership permissions", HttpStatus.FORBIDDEN);
    }
  }

  private boolean isMember(AuthenticatedUser user, UUID businessId, Set<MembershipRole> allowedRoles) {
    if (user == null) return false;
    return memberRepository.findByIdBusinessIdAndIdUserId(businessId, user.id())
        .filter(m -> m.getState() == MembershipState.ACTIVE && allowedRoles.contains(m.getRole()))
        .isPresent();
  }

  private String computeHash(UUID businessId, CreateRestaurantReservationRequest req) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      String input = businessId + ":" + req.startAt().toEpochMilli() + ":" + req.timeZone() + ":"
          + req.adults() + ":" + req.children() + ":" + (req.notes() == null ? "" : req.notes().trim());
      byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (Exception e) {
      return UUID.randomUUID().toString().replace("-", "");
    }
  }

  private RestaurantReservationDto toDto(RestaurantReservation r) {
    return RestaurantReservationDto.builder()
        .id(r.getId())
        .businessId(r.getBusinessId())
        .businessName(r.getBusinessNameSnapshot())
        .customerId(r.getCustomerId())
        .customerEmail(r.getCustomerEmail())
        .customerName(r.getCustomerName())
        .startAt(r.getStartAt())
        .timeZone(r.getTimeZone())
        .adults(r.getAdults())
        .children(r.getChildren())
        .notes(r.getNotes())
        .state(r.getState())
        .cancellationReason(r.getCancellationReason())
        .decisionReason(r.getDecisionReason())
        .version(r.getVersion())
        .createdAt(r.getCreatedAt())
        .updatedAt(r.getUpdatedAt())
        .build();
  }
}
