package fu.tripsense.tripservice.controller;

import fu.tripsense.tripservice.dto.request.UpdateAdminTripArchiveRequest;
import fu.tripsense.tripservice.dto.response.AdminTripArchiveResponse;
import fu.tripsense.tripservice.dto.response.AdminTripPageResponse;
import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.AdminTripManagementService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/trips")
@RequiredArgsConstructor
public class AdminTripManagementController {

  private final AdminTripManagementService adminTripManagementService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping
  public ApiResponse<AdminTripPageResponse> listTrips(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) String search,
      @RequestParam(defaultValue = "ALL") String visibility,
      @RequestParam(defaultValue = "ALL") String archived) {
    return ApiResponse.success(
        adminTripManagementService.listTrips(
            currentUserProvider.get(), page, size, search, visibility, archived));
  }

  @PatchMapping("/{tripId}/archive")
  public ApiResponse<AdminTripArchiveResponse> updateArchiveState(
      @PathVariable UUID tripId,
      @Valid @RequestBody UpdateAdminTripArchiveRequest request) {
    return ApiResponse.success(
        "Trip archive state updated",
        adminTripManagementService.updateArchiveState(
            currentUserProvider.get(), tripId, request));
  }
}
