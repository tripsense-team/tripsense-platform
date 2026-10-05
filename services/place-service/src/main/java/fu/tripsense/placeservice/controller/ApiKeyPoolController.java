package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.dto.AddApiKeysRequest;
import fu.tripsense.placeservice.dto.ApiKeyPoolItemDto;
import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/places/admin/keys")
@RequiredArgsConstructor
public class ApiKeyPoolController {

  private final ApiKeyPoolService apiKeyPoolService;

  @GetMapping
  public ResponseEntity<ApiResponse<List<ApiKeyPoolItemDto>>> listKeys(
      @RequestParam(name = "provider", defaultValue = "ZIOMAP") ApiKeyProvider provider) {
    List<ApiKeyPoolItemDto> dtos =
        apiKeyPoolService.listKeys(provider).stream().map(ApiKeyPoolItemDto::from).toList();
    return ResponseEntity.ok(ApiResponse.ok(dtos));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<List<ApiKeyPoolItemDto>>> addKeys(
      @Valid @RequestBody AddApiKeysRequest request) {
    List<ApiKeyPoolItemDto> saved =
        apiKeyPoolService.addKeys(request.provider(), request.keys()).stream()
            .map(ApiKeyPoolItemDto::from)
            .toList();
    return ResponseEntity.ok(ApiResponse.ok(saved));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Map<String, Object>>> deleteKey(@PathVariable String id) {
    apiKeyPoolService.deleteKey(id);
    return ResponseEntity.ok(ApiResponse.ok(Map.of("deleted", true, "id", id)));
  }

  @PostMapping("/{id}/activate")
  public ResponseEntity<ApiResponse<ApiKeyPoolItemDto>> setActiveKey(@PathVariable String id) {
    var item = apiKeyPoolService.setActiveKey(id);
    return ResponseEntity.ok(ApiResponse.ok(ApiKeyPoolItemDto.from(item)));
  }

  @PostMapping("/{id}/disable")
  public ResponseEntity<ApiResponse<ApiKeyPoolItemDto>> disableKey(@PathVariable String id) {
    var item = apiKeyPoolService.disableKey(id);
    return ResponseEntity.ok(ApiResponse.ok(ApiKeyPoolItemDto.from(item)));
  }

  @PostMapping("/{id}/enable")
  public ResponseEntity<ApiResponse<ApiKeyPoolItemDto>> enableKey(@PathVariable String id) {
    var item = apiKeyPoolService.enableKey(id);
    return ResponseEntity.ok(ApiResponse.ok(ApiKeyPoolItemDto.from(item)));
  }

  @GetMapping("/active")
  public ResponseEntity<ApiResponse<ApiKeyPoolItemDto>> getActiveKey(
      @RequestParam(name = "provider", defaultValue = "ZIOMAP") ApiKeyProvider provider) {
    var item = apiKeyPoolService.getActiveKeyItem(provider);
    return item.map(apiKeyPoolItem -> ResponseEntity.ok(ApiResponse.ok(ApiKeyPoolItemDto.from(apiKeyPoolItem))))
        .orElseGet(() -> ResponseEntity.ok(ApiResponse.ok(null)));
  }

  @PostMapping("/{id}/test")
  public ResponseEntity<ApiResponse<Map<String, Object>>> testKey(@PathVariable String id) {
    var result = apiKeyPoolService.testKeyById(id);
    return ResponseEntity.ok(ApiResponse.ok(result));
  }

  @PostMapping("/reset-quota")
  public ResponseEntity<ApiResponse<Map<String, Object>>> resetQuota(
      @RequestParam(name = "provider", defaultValue = "ZIOMAP") ApiKeyProvider provider) {
    int count = apiKeyPoolService.resetQuotaAll(provider);
    return ResponseEntity.ok(ApiResponse.ok(Map.of("resetCount", count, "provider", provider)));
  }
}
