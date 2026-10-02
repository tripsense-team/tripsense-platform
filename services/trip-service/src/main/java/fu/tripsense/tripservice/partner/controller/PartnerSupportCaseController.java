package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.PartnerSupportCaseService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PartnerSupportCaseController {

  private final PartnerSupportCaseService supportCaseService;
  private final CurrentUserProvider currentUserProvider;

  @PostMapping("/api/partner-support-cases")
  public ResponseEntity<ApiResponse<PartnerSupportCaseDto>> createCase(
      @Valid @RequestBody PartnerSupportCaseRequest request) {
    PartnerSupportCaseDto dto = supportCaseService.createCase(currentUserProvider.get(), request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @GetMapping("/api/partner-support-cases/{id}")
  public ResponseEntity<ApiResponse<PartnerSupportCaseDto>> getCase(@PathVariable UUID id) {
    PartnerSupportCaseDto dto = supportCaseService.getCase(currentUserProvider.get(), id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @GetMapping("/api/me/partner-support-cases")
  public ResponseEntity<ApiResponse<List<PartnerSupportCaseDto>>> getMyCases() {
    List<PartnerSupportCaseDto> list = supportCaseService.getMyCases(currentUserProvider.get());
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @GetMapping("/api/admin/partner-support-cases")
  public ResponseEntity<ApiResponse<List<PartnerSupportCaseDto>>> getAdminQueue(
      @RequestParam(required = false) String state) {
    List<PartnerSupportCaseDto> list =
        supportCaseService.getAdminQueue(currentUserProvider.get(), state);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @PostMapping("/api/admin/partner-support-cases/{id}/assignment")
  public ResponseEntity<ApiResponse<PartnerSupportCaseDto>> assignAdmin(
      @PathVariable UUID id, @Valid @RequestBody SupportCaseAssignmentRequest request) {
    PartnerSupportCaseDto dto =
        supportCaseService.assignAdmin(currentUserProvider.get(), id, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/admin/partner-support-cases/{id}/resolution")
  public ResponseEntity<ApiResponse<PartnerSupportCaseDto>> resolveCase(
      @PathVariable UUID id, @Valid @RequestBody SupportCaseResolutionRequest request) {
    PartnerSupportCaseDto dto =
        supportCaseService.resolveCase(currentUserProvider.get(), id, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
