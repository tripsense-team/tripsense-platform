package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.PartnerApplication;
import fu.tripsense.tripservice.partner.entity.PartnerManagementClaim;
import fu.tripsense.tripservice.partner.enums.ApplicationState;
import fu.tripsense.tripservice.partner.enums.ManagementClaimState;
import fu.tripsense.tripservice.partner.repository.PartnerApplicationRepository;
import fu.tripsense.tripservice.partner.repository.PartnerManagementClaimRepository;
import fu.tripsense.tripservice.partner.service.PartnerAdminService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class PartnerAdminController {

  private final PartnerAdminService adminService;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerManagementClaimRepository claimRepository;
  private final fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository businessRepository;

  @GetMapping({"/partner-applications", "/partners/applications"})
  public ResponseEntity<ApiResponse<List<ApplicationDetailDto>>> listApplications(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @RequestParam(required = false, defaultValue = "SUBMITTED") String state) {
    adminService.requireAdmin(admin);
    ApplicationState appState = ApplicationState.valueOf(state);
    List<PartnerApplication> list = applicationRepository.findByStateOrderBySubmittedAtAsc(appState);
    List<ApplicationDetailDto> dtos =
        list.stream()
            .map(
                a -> {
                  Long bizVer =
                      businessRepository.findById(a.getBusinessId()).map(fu.tripsense.tripservice.partner.entity.PartnerBusiness::getVersion).orElse(0L);
                  return ApplicationDetailDto.builder()
                      .id(a.getId())
                      .businessId(a.getBusinessId())
                      .revision(a.getRevision())
                      .profileSnapshot(a.getProfileSnapshot())
                      .checklistId(a.getChecklistId())
                      .checklistVersion(a.getChecklistVersion())
                      .requestedCapabilities(a.getRequestedCapabilities())
                      .state(a.getState())
                      .isReverification(a.isReverification())
                      .version(a.getVersion())
                      .businessVersion(bizVer)
                      .submittedAt(a.getSubmittedAt())
                      .decidedAt(a.getDecidedAt())
                      .createdAt(a.getCreatedAt())
                      .updatedAt(a.getUpdatedAt())
                      .build();
                })
            .toList();
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @PostMapping({
    "/partner-applications/{id}/decision",
    "/partners/applications/{id}/decision",
    "/partner-applications/{id}/review",
    "/partners/applications/{id}/review"
  })
  public ResponseEntity<ApiResponse<ApplicationDetailDto>> reviewDecision(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @PathVariable UUID id,
      @Valid @RequestBody AdminReviewDecisionRequest request) {
    return ResponseEntity.ok(ApiResponse.success(adminService.reviewDecision(admin, id, request)));
  }

  @PostMapping("/partner-businesses/{id}/suspension")
  public ResponseEntity<ApiResponse<Void>> suspendBusiness(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @PathVariable UUID id,
      @Valid @RequestBody AdminSuspensionRequest request) {
    adminService.suspendBusiness(admin, id, request);
    return ResponseEntity.ok(ApiResponse.success("Business suspended successfully", null));
  }

  @PostMapping("/partner-businesses/{id}/reinstatement")
  public ResponseEntity<ApiResponse<Void>> reinstateBusiness(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @PathVariable UUID id,
      @Valid @RequestBody AdminReinstatementRequest request) {
    adminService.reinstateBusiness(admin, id, request);
    return ResponseEntity.ok(ApiResponse.success("Business reinstated successfully", null));
  }

  @PostMapping("/partner-businesses/{id}/capability-revocations")
  public ResponseEntity<ApiResponse<Void>> revokeCapabilities(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @PathVariable UUID id,
      @Valid @RequestBody AdminCapabilityRevocationRequest request) {
    adminService.revokeCapabilities(admin, id, request);
    return ResponseEntity.ok(ApiResponse.success("Capabilities revoked successfully", null));
  }

  @GetMapping({"/management-claims", "/partners/management-claims"})
  public ResponseEntity<ApiResponse<List<ManagementClaimDto>>> listManagementClaims(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @RequestParam(required = false, defaultValue = "SUBMITTED") String state) {
    adminService.requireAdmin(admin);
    ManagementClaimState claimState = ManagementClaimState.valueOf(state);
    List<PartnerManagementClaim> list = claimRepository.findByStateOrderByCreatedAtAsc(claimState);
    List<ManagementClaimDto> dtos =
        list.stream()
            .map(
                c ->
                    ManagementClaimDto.builder()
                        .id(c.getId())
                        .applicantUserId(c.getApplicantUserId())
                        .targetBusinessId(c.getTargetBusinessId())
                        .reason(c.getReason())
                        .state(c.getState())
                        .version(c.getVersion())
                        .decisionOutcome(c.getDecisionOutcome())
                        .decisionReason(c.getDecisionReason())
                        .decidedBy(c.getDecidedBy())
                        .decidedAt(c.getDecidedAt())
                        .createdAt(c.getCreatedAt())
                        .updatedAt(c.getUpdatedAt())
                        .build())
            .toList();
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @PostMapping({"/management-claims/{id}/decision", "/partners/management-claims/{id}/decision"})
  public ResponseEntity<ApiResponse<ManagementClaimDto>> reviewManagementClaim(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @PathVariable UUID id,
      @Valid @RequestBody ManagementClaimDecisionRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(adminService.reviewManagementClaim(admin, id, request)));
  }
}
