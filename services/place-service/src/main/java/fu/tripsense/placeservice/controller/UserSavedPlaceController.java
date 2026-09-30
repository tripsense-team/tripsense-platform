package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.*;
import fu.tripsense.placeservice.security.CurrentUserProvider;
import fu.tripsense.placeservice.service.UserSavedPlaceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/places/me")
@RequiredArgsConstructor
public class UserSavedPlaceController {
  private final UserSavedPlaceService service;
  private final CurrentUserProvider currentUser;

  @GetMapping("/collections")
  public ApiResponse<List<PlaceCollectionDto>> collections() {
    return ApiResponse.ok(service.listCollections(currentUser.userId()));
  }

  @PostMapping("/collections")
  public ResponseEntity<ApiResponse<PlaceCollectionDto>> create(
      @Valid @RequestBody CreateCollectionRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(service.createCollection(currentUser.userId(), request.name())));
  }

  @PatchMapping("/collections/{collectionId}")
  public ApiResponse<PlaceCollectionDto> rename(
      @PathVariable UUID collectionId, @Valid @RequestBody CreateCollectionRequest request) {
    return ApiResponse.ok(
        service.renameCollection(currentUser.userId(), collectionId, request.name()));
  }

  @DeleteMapping("/collections/{collectionId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID collectionId) {
    service.deleteCollection(currentUser.userId(), collectionId);
  }

  @PutMapping("/collections/{collectionId}/places/{placeRef}")
  public ApiResponse<SavedStatusDto> save(
      @PathVariable UUID collectionId, @PathVariable String placeRef) {
    return ApiResponse.ok(service.savePlace(currentUser.userId(), collectionId, placeRef));
  }

  @DeleteMapping("/collections/{collectionId}/places/{placeRef}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable UUID collectionId, @PathVariable String placeRef) {
    service.removePlace(currentUser.userId(), collectionId, placeRef);
  }

  @PostMapping("/saved-status:batch")
  public ApiResponse<SavedStatusBatchResponse> statuses(
      @Valid @RequestBody SavedStatusBatchRequest request) {
    return ApiResponse.ok(service.statuses(currentUser.userId(), request.placeRefs()));
  }

  @GetMapping("/saved")
  public ApiResponse<SavedPlacesPage> saved(
      @RequestParam(required = false) UUID collectionId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ApiResponse.ok(
        service.listSaved(currentUser.userId(), collectionId, page, size));
  }
}
