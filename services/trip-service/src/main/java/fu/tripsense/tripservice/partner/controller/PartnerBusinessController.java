package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import fu.tripsense.tripservice.partner.service.PartnerBusinessService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners/businesses")
@RequiredArgsConstructor
public class PartnerBusinessController {

  private final PartnerBusinessService businessService;

  @GetMapping
  public ResponseEntity<ApiResponse<PartnerContextDto>> getMyBusinesses(
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getPartnerContext(user)));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<BusinessDetailDto>> createDraft(
      @AuthenticationPrincipal AuthenticatedUser user,
      @Valid @RequestBody CreateBusinessDraftRequest request) {
    BusinessDetailDto created = businessService.createDraft(user, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> getBusinessDetail(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getBusinessDetail(user, id)));
  }

  @PatchMapping("/{id}")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> updateDraft(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody UpdateBusinessDraftRequest request) {
    return ResponseEntity.ok(ApiResponse.success(businessService.updateDraft(user, id, request)));
  }

  @PostMapping("/{id}/applications")
  public ResponseEntity<ApiResponse<ApplicationDetailDto>> submitApplication(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody SubmitApplicationRequest request) {
    ApplicationDetailDto app = businessService.submitApplication(user, id, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(app));
  }

  @PostMapping("/{id}/applications/{appId}/withdraw")
  public ResponseEntity<ApiResponse<ApplicationDetailDto>> withdrawApplication(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @PathVariable UUID appId) {
    return ResponseEntity.ok(
        ApiResponse.success(businessService.withdrawApplication(user, id, appId)));
  }

  @GetMapping("/{id}/applications")
  public ResponseEntity<ApiResponse<List<ApplicationDetailDto>>> getApplications(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getApplications(user, id)));
  }

  @GetMapping("/{id}/readiness")
  public ResponseEntity<ApiResponse<BusinessReadinessDto>> getReadiness(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getReadiness(user, id)));
  }

  @GetMapping("/{id}/capabilities")
  public ResponseEntity<ApiResponse<List<PartnerCapability>>> getCapabilities(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getCapabilities(user, id)));
  }

  @PutMapping("/{id}/publication")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> updatePublication(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody PublicationRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(businessService.updatePublication(user, id, request)));
  }

  @PutMapping("/{id}/intake")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> updateIntake(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody IntakeRequest request) {
    return ResponseEntity.ok(ApiResponse.success(businessService.updateIntake(user, id, request)));
  }

  @PostMapping("/{id}/material-changes")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> declareMaterialChange(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody MaterialChangeRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(businessService.declareMaterialChange(user, id, request)));
  }

  @PostMapping("/{id}/invitations")
  public ResponseEntity<ApiResponse<InvitationDto>> inviteMember(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody MemberInvitationRequest request) {
    InvitationDto dto = businessService.inviteMember(user, id, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @PostMapping("/invitations/{token}/accept")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> acceptInvitation(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable String token) {
    return ResponseEntity.ok(ApiResponse.success(businessService.acceptInvitation(user, token)));
  }

  @DeleteMapping("/{id}/members/{targetUserId}")
  public ResponseEntity<ApiResponse<Void>> removeMember(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @PathVariable UUID targetUserId) {
    businessService.removeMember(user, id, targetUserId);
    return ResponseEntity.ok(ApiResponse.success("Member removed", null));
  }
}
