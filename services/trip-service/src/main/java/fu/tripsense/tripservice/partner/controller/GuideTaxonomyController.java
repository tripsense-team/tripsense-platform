package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.GuideTaxonomyDto;
import fu.tripsense.tripservice.partner.service.GuideTaxonomyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class GuideTaxonomyController {

  private final GuideTaxonomyService taxonomyService;

  @GetMapping("/api/guide-taxonomy")
  public ResponseEntity<ApiResponse<GuideTaxonomyDto>> getTaxonomy() {
    return ResponseEntity.ok(ApiResponse.success(taxonomyService.getTaxonomy()));
  }
}
