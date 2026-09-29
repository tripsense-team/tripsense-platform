package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.BusinessKindConfigDto;
import fu.tripsense.tripservice.partner.service.PartnerBusinessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/partners/business-kinds")
@RequiredArgsConstructor
public class PartnerKindController {

  private final PartnerBusinessService businessService;

  @GetMapping
  public ResponseEntity<ApiResponse<BusinessKindConfigDto>> getBusinessKinds(
      @RequestParam(required = false) String region) {
    return ResponseEntity.ok(ApiResponse.success(businessService.getBusinessKindConfig(region)));
  }
}
