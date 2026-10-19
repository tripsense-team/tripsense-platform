package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.PlaceCategoryBatchRequest;
import fu.tripsense.placeservice.service.PlaceCategoryBatchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/places/recommendations/categories")
public class PlaceCategoryBatchController {
  private final PlaceCategoryBatchService service;

  public PlaceCategoryBatchController(PlaceCategoryBatchService service) {
    this.service = service;
  }

  @PostMapping
  public ApiResponse<PlaceCategoryBatchService.Batch> retrieve(
      @Valid @RequestBody PlaceCategoryBatchRequest request) {
    return ApiResponse.ok(service.retrieve(request));
  }
}
