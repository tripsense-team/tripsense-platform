package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerSupportCaseService {

  private final PartnerSupportCaseRepository supportCaseRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerManagementClaimRepository claimRepository;
  private final JdbcTemplate db;

  @Transactional
  public PartnerSupportCaseDto createCase(
      AuthenticatedUser user, PartnerSupportCaseRequest request) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    UUID businessId = null;

    if ("HOTEL_BOOKING".equals(request.resourceType())) {
      var rows =
          db.queryForList(
              "SELECT id, customer_id, property_id, business_id FROM hotel_booking WHERE id = ?",
              request.resourceId());
      if (rows.isEmpty()) {
        throw new TripServiceException(
            "BOOKING_NOT_FOUND", "Hotel booking not found", HttpStatus.NOT_FOUND);
      }
      var b = rows.getFirst();
      UUID customerId = (UUID) b.get("customer_id");
      UUID propId = (UUID) b.get("property_id");
      businessId = (UUID) b.get("business_id");

      boolean isCustomer = user.id().equals(customerId);
      boolean isPropertyMember = false;
      if (businessId != null) {
        isPropertyMember =
            memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
                businessId, user.id(), MembershipState.ACTIVE);
      }
      if (!isCustomer && !isPropertyMember && !user.isAdmin()) {
        throw new TripServiceException(
            "FORBIDDEN", "Not permitted to report this booking", HttpStatus.FORBIDDEN);
      }
    } else if ("MANAGEMENT_CLAIM".equals(request.resourceType())) {
      PartnerManagementClaim claim =
          claimRepository
              .findById(request.resourceId())
              .orElseThrow(
                  () ->
                      new TripServiceException(
                          "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));

      businessId = claim.getTargetBusinessId();
      boolean isClaimant = user.id().equals(claim.getApplicantUserId());
      boolean isOwner =
          memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
              businessId, user.id(), MembershipState.ACTIVE);

      if (!isClaimant && !isOwner && !user.isAdmin()) {
        throw new TripServiceException(
            "FORBIDDEN", "Not permitted to report this claim", HttpStatus.FORBIDDEN);
      }
    }

    PartnerSupportCase sc =
        PartnerSupportCase.builder()
            .id(UUID.randomUUID())
            .resourceType(request.resourceType())
            .resourceId(request.resourceId())
            .businessId(businessId)
            .reporterId(user.id())
            .category(request.category())
            .reason(request.reason())
            .state("OPEN")
            .build();

    sc = supportCaseRepository.save(sc);
    return toDto(sc);
  }

  @Transactional(readOnly = true)
  public PartnerSupportCaseDto getCase(AuthenticatedUser user, UUID caseId) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    PartnerSupportCase sc =
        supportCaseRepository
            .findById(caseId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CASE_NOT_FOUND", "Support case not found", HttpStatus.NOT_FOUND));

    boolean isReporter = user.id().equals(sc.getReporterId());
    boolean isAssigned = user.id().equals(sc.getAssignedAdmin());
    boolean isAdmin = user.isAdmin();

    if (!isReporter && !isAssigned && !isAdmin) {
      throw new TripServiceException(
          "FORBIDDEN", "Access to support case denied", HttpStatus.FORBIDDEN);
    }

    return toDto(sc);
  }

  @Transactional(readOnly = true)
  public List<PartnerSupportCaseDto> getMyCases(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    return supportCaseRepository.findByReporterIdOrderByCreatedAtDesc(user.id()).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<PartnerSupportCaseDto> getAdminQueue(AuthenticatedUser admin, String state) {
    requireAdmin(admin);
    List<PartnerSupportCase> list =
        (state != null && !state.isBlank())
            ? supportCaseRepository.findByStateOrderByCreatedAtDesc(state)
            : supportCaseRepository.findAllByOrderByCreatedAtDesc();
    return list.stream().map(this::toDto).toList();
  }

  @Transactional
  public PartnerSupportCaseDto assignAdmin(
      AuthenticatedUser admin, UUID caseId, SupportCaseAssignmentRequest request) {
    requireAdmin(admin);

    PartnerSupportCase sc =
        supportCaseRepository
            .findById(caseId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CASE_NOT_FOUND", "Support case not found", HttpStatus.NOT_FOUND));

    // Self-conflict check: Assigned admin cannot be reporter or member of target business
    if (request.assignedAdmin().equals(sc.getReporterId())) {
      throw new TripServiceException(
          "CONFLICT_OF_INTEREST",
          "Cannot assign reporter as reviewing admin",
          HttpStatus.FORBIDDEN);
    }
    if (sc.getBusinessId() != null
        && memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
            sc.getBusinessId(), request.assignedAdmin(), MembershipState.ACTIVE)) {
      throw new TripServiceException(
          "CONFLICT_OF_INTEREST",
          "Cannot assign admin with business affiliation",
          HttpStatus.FORBIDDEN);
    }

    sc.setAssignedAdmin(request.assignedAdmin());
    if ("OPEN".equals(sc.getState())) {
      sc.setState("IN_PROGRESS");
    }

    sc = supportCaseRepository.save(sc);
    return toDto(sc);
  }

  @Transactional
  public PartnerSupportCaseDto resolveCase(
      AuthenticatedUser admin, UUID caseId, SupportCaseResolutionRequest request) {
    requireAdmin(admin);

    PartnerSupportCase sc =
        supportCaseRepository
            .findById(caseId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CASE_NOT_FOUND", "Support case not found", HttpStatus.NOT_FOUND));

    if (sc.getAssignedAdmin() != null && !sc.getAssignedAdmin().equals(admin.id())) {
      throw new TripServiceException(
          "NOT_ASSIGNED", "Case is assigned to another admin", HttpStatus.FORBIDDEN);
    }

    sc.setState("RESOLVED");
    sc.setResolutionAction(request.action());
    sc.setResolutionNote(request.resolutionNote());
    sc.setResolvedAt(Instant.now());

    // If HOTEL_SERVICE_FAILURE_CANCEL, cancel the booking if still active and release inventory
    if ("HOTEL_SERVICE_FAILURE_CANCEL".equals(request.action())
        && "HOTEL_BOOKING".equals(sc.getResourceType())) {
      var rows =
          db.queryForList(
              "SELECT id, status, room_type_id, quantity, check_in, check_out FROM hotel_booking WHERE id = ? FOR UPDATE",
              sc.getResourceId());
      if (!rows.isEmpty()) {
        var b = rows.getFirst();
        String status = (String) b.get("status");
        if ("CONFIRMED".equals(status) || "HELD".equals(status)) {
          int q = ((Number) b.get("quantity")).intValue();
          db.update(
              "UPDATE hotel_inventory SET held = CASE WHEN ? = 'HELD' THEN held - ? ELSE held END, booked = CASE WHEN ? = 'CONFIRMED' THEN booked - ? ELSE booked END WHERE room_type_id = ? AND stay_date >= ? AND stay_date < ?",
              status, q, status, q, b.get("room_type_id"), b.get("check_in"), b.get("check_out"));
          db.update(
              "UPDATE hotel_booking SET status = 'CANCELLED', cancelled_by = 'ADMIN', cancellation_reason = ? WHERE id = ?",
              request.resolutionNote(), sc.getResourceId());
        }
      }
    }

    sc = supportCaseRepository.save(sc);
    return toDto(sc);
  }

  private PartnerSupportCaseDto toDto(PartnerSupportCase sc) {
    return PartnerSupportCaseDto.builder()
        .id(sc.getId())
        .resourceType(sc.getResourceType())
        .resourceId(sc.getResourceId())
        .businessId(sc.getBusinessId())
        .reporterId(sc.getReporterId())
        .category(sc.getCategory())
        .reason(sc.getReason())
        .state(sc.getState())
        .assignedAdmin(sc.getAssignedAdmin())
        .resolutionAction(sc.getResolutionAction())
        .resolutionNote(sc.getResolutionNote())
        .resolvedAt(sc.getResolvedAt())
        .createdAt(sc.getCreatedAt())
        .updatedAt(sc.getUpdatedAt())
        .build();
  }

  private void requireAdmin(AuthenticatedUser admin) {
    if (admin == null || !admin.isAdmin()) {
      throw new TripServiceException("FORBIDDEN", "Admin role required", HttpStatus.FORBIDDEN);
    }
  }
}
