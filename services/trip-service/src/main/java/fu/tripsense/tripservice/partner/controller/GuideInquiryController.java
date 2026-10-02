package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.enums.GuideInquiryState;
import fu.tripsense.tripservice.partner.service.GuideInquiryService;
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
public class GuideInquiryController {

  private final GuideInquiryService inquiryService;
  private final CurrentUserProvider currentUserProvider;

  @PostMapping("/api/guides/{businessId}/inquiries")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> createInquiry(
      @PathVariable UUID businessId, @Valid @RequestBody GuideInquiryInput input) {
    GuideInquiryDto dto = inquiryService.createInquiry(currentUserProvider.get(), businessId, input);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @GetMapping("/api/me/guide-inquiries")
  public ResponseEntity<ApiResponse<List<GuideInquiryDto>>> listCustomerInquiries(
      @RequestParam(required = false) GuideInquiryState state) {
    List<GuideInquiryDto> list = inquiryService.listCustomerInquiries(currentUserProvider.get(), state);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @GetMapping("/api/partners/businesses/{businessId}/guide-inquiries")
  public ResponseEntity<ApiResponse<List<GuideInquiryDto>>> listBusinessInquiries(
      @PathVariable UUID businessId, @RequestParam(required = false) GuideInquiryState state) {
    List<GuideInquiryDto> list =
        inquiryService.listBusinessInquiries(currentUserProvider.get(), businessId, state);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @GetMapping("/api/guide-inquiries/{inquiryId}")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> getInquiry(@PathVariable UUID inquiryId) {
    GuideInquiryDto dto = inquiryService.getInquiry(currentUserProvider.get(), inquiryId);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @GetMapping("/api/guide-inquiries/{inquiryId}/contacts")
  public ResponseEntity<ApiResponse<InquiryContactsDto>> getInquiryContacts(
      @PathVariable UUID inquiryId) {
    InquiryContactsDto dto = inquiryService.getInquiryContacts(currentUserProvider.get(), inquiryId);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PatchMapping("/api/guide-inquiries/{inquiryId}/requirements")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> updateRequirements(
      @PathVariable UUID inquiryId, @Valid @RequestBody UpdateRequirementsRequest request) {
    GuideInquiryDto dto =
        inquiryService.updateRequirements(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/responses")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> addMessage(
      @PathVariable UUID inquiryId, @Valid @RequestBody InquiryMessageRequest request) {
    GuideInquiryDto dto = inquiryService.addMessage(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/proposals")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> sendProposal(
      @PathVariable UUID inquiryId, @Valid @RequestBody GuideProposalInput input) {
    GuideInquiryDto dto = inquiryService.sendProposal(currentUserProvider.get(), inquiryId, input);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/proposal-decisions")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> decideProposal(
      @PathVariable UUID inquiryId, @Valid @RequestBody ProposalDecisionRequest request) {
    GuideInquiryDto dto = inquiryService.decideProposal(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/contact-consents/revoke")
  public ResponseEntity<ApiResponse<Void>> revokeContactConsent(
      @PathVariable UUID inquiryId, @Valid @RequestBody RevokeConsentRequest request) {
    inquiryService.revokeContactConsent(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/withdraw")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> withdrawInquiry(
      @PathVariable UUID inquiryId, @Valid @RequestBody WithdrawInquiryRequest request) {
    GuideInquiryDto dto = inquiryService.withdrawInquiry(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/guide-inquiries/{inquiryId}/decline")
  public ResponseEntity<ApiResponse<GuideInquiryDto>> declineInquiry(
      @PathVariable UUID inquiryId, @Valid @RequestBody DeclineInquiryRequest request) {
    GuideInquiryDto dto = inquiryService.declineInquiry(currentUserProvider.get(), inquiryId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PutMapping("/api/me/guide-blocks/{guideBusinessId}")
  public ResponseEntity<ApiResponse<Void>> customerBlockGuide(
      @PathVariable UUID guideBusinessId, @RequestBody(required = false) InquiryBlockRequest request) {
    inquiryService.customerBlockGuide(currentUserProvider.get(), guideBusinessId, request);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @DeleteMapping("/api/me/guide-blocks/{guideBusinessId}")
  public ResponseEntity<ApiResponse<Void>> customerUnblockGuide(
      @PathVariable UUID guideBusinessId) {
    inquiryService.customerUnblockGuide(currentUserProvider.get(), guideBusinessId);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/api/me/guide-blocks")
  public ResponseEntity<ApiResponse<List<GuideInquiryBlockDto>>> listCustomerBlocks() {
    List<GuideInquiryBlockDto> list = inquiryService.listCustomerBlocks(currentUserProvider.get());
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @PutMapping("/api/partners/businesses/{businessId}/inquiry-blocks/{customerId}")
  public ResponseEntity<ApiResponse<Void>> guideBlockCustomer(
      @PathVariable UUID businessId,
      @PathVariable UUID customerId,
      @RequestBody(required = false) InquiryBlockRequest request) {
    inquiryService.guideBlockCustomer(currentUserProvider.get(), businessId, customerId, request);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @DeleteMapping("/api/partners/businesses/{businessId}/inquiry-blocks/{customerId}")
  public ResponseEntity<ApiResponse<Void>> guideUnblockCustomer(
      @PathVariable UUID businessId, @PathVariable UUID customerId) {
    inquiryService.guideUnblockCustomer(currentUserProvider.get(), businessId, customerId);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/api/partners/businesses/{businessId}/inquiry-blocks")
  public ResponseEntity<ApiResponse<List<GuideInquiryBlockDto>>> listGuideBlocks(
      @PathVariable UUID businessId) {
    List<GuideInquiryBlockDto> list =
        inquiryService.listGuideBlocks(currentUserProvider.get(), businessId);
    return ResponseEntity.ok(ApiResponse.success(list));
  }
}
