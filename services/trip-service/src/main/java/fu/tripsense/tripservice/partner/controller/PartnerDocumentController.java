package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.PartnerDocumentService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners/businesses/{businessId}/documents")
@RequiredArgsConstructor
public class PartnerDocumentController {

  private final PartnerDocumentService documentService;

  @PostMapping("/upload-intents")
  public ResponseEntity<ApiResponse<DocumentUploadIntentResponse>> createUploadIntent(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @Valid @RequestBody DocumentUploadIntentRequest request) {
    DocumentUploadIntentResponse res =
        documentService.createBusinessUploadIntent(user, businessId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(res));
  }

  @PostMapping("/{documentId}/complete")
  public ResponseEntity<ApiResponse<DocumentDetailDto>> completeUpload(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @PathVariable UUID documentId) {
    return ResponseEntity.ok(
        ApiResponse.success(documentService.completeBusinessUpload(user, businessId, documentId)));
  }

  @PostMapping("/{documentId}/access")
  public ResponseEntity<ApiResponse<DocumentAccessResponse>> getAccess(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @PathVariable UUID documentId) {
    return ResponseEntity.ok(
        ApiResponse.success(documentService.getBusinessDocumentAccess(user, businessId, documentId)));
  }
}
