package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.PartnerClaimService;
import fu.tripsense.tripservice.partner.service.PartnerDocumentService;
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
@RequestMapping("/api/partners/management-claims")
@RequiredArgsConstructor
public class PartnerClaimController {

  private final PartnerClaimService claimService;
  private final PartnerDocumentService documentService;

  @PostMapping
  public ResponseEntity<ApiResponse<ManagementClaimDto>> createClaim(
      @AuthenticationPrincipal AuthenticatedUser user,
      @Valid @RequestBody ManagementClaimRequest request) {
    ManagementClaimDto created = claimService.createClaim(user, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<ManagementClaimDto>>> getMyClaims(
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.success(claimService.getMyClaims(user)));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ManagementClaimDto>> getClaim(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(claimService.getClaim(user, id)));
  }

  @PostMapping("/{id}/submit")
  public ResponseEntity<ApiResponse<ManagementClaimDto>> submitClaim(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @RequestParam(required = false) Long expectedVersion) {
    return ResponseEntity.ok(
        ApiResponse.success(claimService.submitClaim(user, id, expectedVersion)));
  }

  @PostMapping("/{id}/documents/upload-intents")
  public ResponseEntity<ApiResponse<DocumentUploadIntentResponse>> createClaimUploadIntent(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody DocumentUploadIntentRequest request) {
    DocumentUploadIntentResponse res =
        documentService.createClaimUploadIntent(user, id, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(res));
  }

  @PostMapping("/{id}/documents/{documentId}/complete")
  public ResponseEntity<ApiResponse<DocumentDetailDto>> completeClaimUpload(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @PathVariable UUID documentId) {
    return ResponseEntity.ok(
        ApiResponse.success(documentService.completeClaimUpload(user, id, documentId)));
  }

  @PostMapping("/{id}/documents/{documentId}/access")
  public ResponseEntity<ApiResponse<DocumentAccessResponse>> getClaimDocumentAccess(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @PathVariable UUID documentId) {
    return ResponseEntity.ok(
        ApiResponse.success(documentService.getClaimDocumentAccess(user, id, documentId)));
  }
}
