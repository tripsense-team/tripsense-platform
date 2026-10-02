package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.PartnerCandidateDto;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners/business-candidates")
@RequiredArgsConstructor
public class PartnerCandidateController {

  private final PartnerBusinessRepository businessRepository;

  @GetMapping
  public ResponseEntity<ApiResponse<List<PartnerCandidateDto>>> searchCandidates(
      @RequestParam(required = false) BusinessKind kind,
      @RequestParam(required = false) String name) {
    List<PartnerBusiness> businesses;
    if (kind != null) {
      businesses =
          businessRepository.findByKindAndPublicationState(kind, PublicationState.PUBLISHED);
    } else {
      businesses =
          businessRepository.findAll().stream()
              .filter(b -> b.getPublicationState() == PublicationState.PUBLISHED)
              .toList();
    }

    if (name != null && !name.isBlank()) {
      String searchName = name.trim().toLowerCase(Locale.ROOT);
      businesses =
          businesses.stream()
              .filter(b -> b.getDisplayName().toLowerCase(Locale.ROOT).contains(searchName))
              .toList();
    }

    List<PartnerCandidateDto> result =
        businesses.stream().limit(50).map(this::toCandidateDto).toList();

    return ResponseEntity.ok(ApiResponse.success(result));
  }

  private PartnerCandidateDto toCandidateDto(PartnerBusiness b) {
    String destination = null;
    String address = null;
    Map<String, Object> profile = b.getDraftProfileJson();
    if (profile != null) {
      if (profile.get("destination") instanceof String dest) destination = dest;
      if (profile.get("address") instanceof String addr) address = addr;
    }

    return PartnerCandidateDto.builder()
        .id(b.getId())
        .kind(b.getKind())
        .displayName(b.getDisplayName())
        .publicationState(b.getPublicationState())
        .destination(destination)
        .address(address)
        .build();
  }
}
