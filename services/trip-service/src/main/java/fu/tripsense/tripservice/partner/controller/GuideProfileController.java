package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.PublicGuideProfileDto;
import fu.tripsense.tripservice.partner.service.GuideProfileService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class GuideProfileController {

  private final GuideProfileService guideProfileService;

  @GetMapping("/api/guides")
  public ResponseEntity<ApiResponse<List<PublicGuideProfileDto>>> searchGuides(
      @RequestParam(required = false) String areaId,
      @RequestParam(required = false) List<String> topicIds,
      @RequestParam(required = false) List<String> skillIds,
      @RequestParam(required = false) String language,
      @RequestParam(required = false) String cursor) {
    List<PublicGuideProfileDto> list =
        guideProfileService.searchPublicGuides(areaId, topicIds, skillIds, language, cursor);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @GetMapping("/api/guides/{id}")
  public ResponseEntity<ApiResponse<PublicGuideProfileDto>> getGuide(@PathVariable UUID id) {
    PublicGuideProfileDto dto = guideProfileService.getPublicGuide(id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
