package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.InternalApiKeyDto;
import fu.tripsense.placeservice.dto.RecordKeySuccessRequest;
import fu.tripsense.placeservice.dto.RotateApiKeyRequest;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/places/internal/keys")
@RequiredArgsConstructor
public class InternalApiKeyPoolController {

  private final ApiKeyPoolService apiKeyPoolService;

  @GetMapping("/active-raw")
  public ResponseEntity<ApiResponse<InternalApiKeyDto>> getActiveRawKey(
      @RequestParam(name = "provider", defaultValue = "GEMINI") ApiKeyProvider provider) {
    Optional<ApiKeyPoolItem> activeItem = apiKeyPoolService.getActiveKeyItem(provider);
    if (activeItem.isPresent()) {
      ApiKeyPoolItem item = activeItem.get();
      String rawKey = apiKeyPoolService.resolveRawKey(item);
      if (rawKey != null && !rawKey.isBlank()) {
        InternalApiKeyDto dto =
            new InternalApiKeyDto(
                item.getProvider(),
                rawKey,
                item.getKeyHash(),
                item.getMaskedKey(),
                item.getStatus());
        return ResponseEntity.ok(ApiResponse.ok(dto));
      }
    }

    // Fallback to static key if pool is empty
    String fallbackRaw = apiKeyPoolService.getActiveKey(provider);
    if (fallbackRaw != null && !fallbackRaw.isBlank()) {
      InternalApiKeyDto fallbackDto =
          new InternalApiKeyDto(
              provider,
              fallbackRaw,
              null,
              ApiKeyPoolItem.mask(fallbackRaw),
              ApiKeyStatus.ACTIVE);
      return ResponseEntity.ok(ApiResponse.ok(fallbackDto));
    }

    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/rotate")
  public ResponseEntity<ApiResponse<Map<String, Object>>> rotateKey(
      @Valid @RequestBody RotateApiKeyRequest request) {
    log.warn(
        "[InternalApiKeyPool] Received rotation request from internal service for provider={}: reason={}",
        request.provider(),
        request.reason());

    Optional<ApiKeyPoolItem> rotated =
        apiKeyPoolService.markExhaustedAndRotate(
            request.provider(),
            request.failedKey(),
            request.status() != null ? request.status() : ApiKeyStatus.EXHAUSTED,
            request.reason());

    Map<String, Object> result = new HashMap<>();
    if (rotated.isPresent()) {
      ApiKeyPoolItem nextActive = rotated.get();
      String nextRaw = apiKeyPoolService.resolveRawKey(nextActive);
      result.put("rotated", true);
      result.put("provider", nextActive.getProvider());
      result.put("newActiveKey", nextRaw);
      result.put("newMaskedKey", nextActive.getMaskedKey());
      result.put("newKeyHash", nextActive.getKeyHash());
    } else {
      result.put("rotated", false);
      result.put("provider", request.provider());
      result.put("message", "No standby keys available for rotation");
    }

    return ResponseEntity.ok(ApiResponse.ok(result));
  }

  @PostMapping("/record-success")
  public ResponseEntity<ApiResponse<Map<String, Object>>> recordSuccess(
      @Valid @RequestBody RecordKeySuccessRequest request) {
    apiKeyPoolService.recordSuccess(request.provider(), request.rawKey());
    return ResponseEntity.ok(ApiResponse.ok(Map.of("recorded", true)));
  }
}
