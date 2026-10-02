package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.BusinessDetailDto;
import fu.tripsense.tripservice.partner.service.PartnerBusinessService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners/invitations")
@RequiredArgsConstructor
public class PartnerInvitationController {

  private final PartnerBusinessService businessService;

  @PostMapping("/{token}/accept")
  public ResponseEntity<ApiResponse<BusinessDetailDto>> acceptInvitation(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable String token) {
    return ResponseEntity.ok(ApiResponse.success(businessService.acceptInvitation(user, token)));
  }
}
