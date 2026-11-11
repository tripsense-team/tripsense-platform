package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.PublicRentalListingDto;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import fu.tripsense.tripservice.partner.service.PublicRentalService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public discovery endpoints for published rental partner businesses. */
@RestController
@RequiredArgsConstructor
public class PublicRentalController {

  private final PublicRentalService publicRentalService;

  @GetMapping("/api/public/rentals")
  public ResponseEntity<ApiResponse<List<PublicRentalListingDto>>> searchPublicRentals(
      @RequestParam(required = false) String query,
      @RequestParam(required = false) RentalCategory category,
      @RequestParam(required = false, defaultValue = "false") boolean onlyAccepting) {
    return ResponseEntity.ok(
        ApiResponse.success(
            publicRentalService.searchPublicRentals(query, category, onlyAccepting)));
  }

  @GetMapping("/api/public/rentals/{id}")
  public ResponseEntity<ApiResponse<PublicRentalListingDto>> getPublicRental(
      @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(publicRentalService.getPublicRental(id)));
  }
}

