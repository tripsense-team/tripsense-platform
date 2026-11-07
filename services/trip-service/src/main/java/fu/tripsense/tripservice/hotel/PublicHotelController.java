package fu.tripsense.tripservice.hotel;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.PublicHotelListingDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PublicHotelController {

  private final PublicHotelService publicHotelService;

  @GetMapping("/api/public/hotels")
  public ResponseEntity<ApiResponse<List<PublicHotelListingDto>>> searchPublicHotels(
      @RequestParam(required = false) String query) {
    List<PublicHotelListingDto> dtos = publicHotelService.searchPublicHotels(query);
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @GetMapping("/api/public/hotels/{id}")
  public ResponseEntity<ApiResponse<PublicHotelListingDto>> getPublicHotel(
      @PathVariable UUID id) {
    PublicHotelListingDto dto = publicHotelService.getPublicHotel(id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
