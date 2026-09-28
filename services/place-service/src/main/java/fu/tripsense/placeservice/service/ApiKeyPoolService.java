package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.domain.repository.ApiKeyPoolRepository;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyPoolService {

  private final ApiKeyPoolRepository repository;
  private final ZioMapProperties zioMapProperties;

  @Value("${EMBEDDING_API_KEY:${embedding.api-key:}}")
  private String defaultGeminiKey;

  @PostConstruct
  public void seedInitialKeys() {
    try {
      // Seed ZioMap key if pool is empty
      if (repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.AVAILABLE) == 0) {
        String initialZioKey = zioMapProperties.getApiKey();
        if (initialZioKey != null && !initialZioKey.isBlank()) {
          saveKeyIfAbsent(ApiKeyProvider.ZIOMAP, initialZioKey, ApiKeyStatus.ACTIVE);
          log.info("[ApiKeyPool] Seeded initial ZioMap API Key from properties: {}", ApiKeyPoolItem.mask(initialZioKey));
        }
      }

      // Seed Gemini key if pool is empty
      if (repository.countByProviderAndStatus(ApiKeyProvider.GEMINI, ApiKeyStatus.ACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.GEMINI, ApiKeyStatus.AVAILABLE) == 0) {
        if (defaultGeminiKey != null && !defaultGeminiKey.isBlank()) {
          saveKeyIfAbsent(ApiKeyProvider.GEMINI, defaultGeminiKey, ApiKeyStatus.ACTIVE);
          log.info("[ApiKeyPool] Seeded initial Gemini API Key from environment: {}", ApiKeyPoolItem.mask(defaultGeminiKey));
        }
      }
    } catch (Exception e) {
      log.warn("[ApiKeyPool] Could not seed initial API keys: {}", e.getMessage());
    }
  }

  public List<ApiKeyPoolItem> listKeys(ApiKeyProvider provider) {
    return repository.findByProviderOrderByCreatedAtAsc(provider);
  }

  public synchronized List<ApiKeyPoolItem> addKeys(ApiKeyProvider provider, List<String> rawKeys) {
    List<ApiKeyPoolItem> saved = new ArrayList<>();
    boolean hasActive = repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE).isPresent();

    for (String raw : rawKeys) {
      if (raw == null || raw.isBlank()) continue;
      String trimmed = raw.trim();
      Optional<ApiKeyPoolItem> existing = repository.findByProviderAndRawKey(provider, trimmed);
      if (existing.isPresent()) {
        saved.add(existing.get());
        continue;
      }

      ApiKeyStatus initialStatus = (!hasActive && saved.isEmpty()) ? ApiKeyStatus.ACTIVE : ApiKeyStatus.AVAILABLE;
      ApiKeyPoolItem item = ApiKeyPoolItem.builder()
          .provider(provider)
          .rawKey(trimmed)
          .maskedKey(ApiKeyPoolItem.mask(trimmed))
          .status(initialStatus)
          .createdAt(Instant.now())
          .build();
      saved.add(repository.save(item));
      if (initialStatus == ApiKeyStatus.ACTIVE) {
        hasActive = true;
        if (provider == ApiKeyProvider.ZIOMAP) {
          zioMapProperties.setApiKey(trimmed);
        }
      }
    }
    return saved;
  }

  public synchronized Optional<ApiKeyPoolItem> getActiveKeyItem(ApiKeyProvider provider) {
    Optional<ApiKeyPoolItem> active = repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE);
    if (active.isPresent()) {
      return active;
    }

    // If no active, try to promote first AVAILABLE
    Optional<ApiKeyPoolItem> available = repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.AVAILABLE);
    if (available.isPresent()) {
      ApiKeyPoolItem promoted = available.get();
      promoted.setStatus(ApiKeyStatus.ACTIVE);
      repository.save(promoted);
      if (provider == ApiKeyProvider.ZIOMAP) {
        zioMapProperties.setApiKey(promoted.getRawKey());
      }
      return Optional.of(promoted);
    }

    return Optional.empty();
  }

  public String getActiveKey(ApiKeyProvider provider) {
    return getActiveKeyItem(provider)
        .map(ApiKeyPoolItem::getRawKey)
        .orElseGet(() -> {
          if (provider == ApiKeyProvider.ZIOMAP) return zioMapProperties.getApiKey();
          return defaultGeminiKey;
        });
  }

  public synchronized Optional<ApiKeyPoolItem> markExhaustedAndRotate(
      ApiKeyProvider provider, String failedRawKey, String reason) {
    if (failedRawKey != null) {
      repository.findByProviderAndRawKey(provider, failedRawKey.trim()).ifPresent(item -> {
        item.setStatus(ApiKeyStatus.EXHAUSTED);
        item.setExhaustedAt(Instant.now());
        item.setFailureReason(reason);
        repository.save(item);
        log.warn("[ApiKeyPool] Key marked EXHAUSTED: provider={}, key={}, reason={}",
            provider, item.getMaskedKey(), reason);
      });
    }

    // Promote next AVAILABLE key
    Optional<ApiKeyPoolItem> nextAvailable = repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.AVAILABLE);
    if (nextAvailable.isPresent()) {
      ApiKeyPoolItem next = nextAvailable.get();
      next.setStatus(ApiKeyStatus.ACTIVE);
      repository.save(next);
      if (provider == ApiKeyProvider.ZIOMAP) {
        zioMapProperties.setApiKey(next.getRawKey());
      }
      log.info("[ApiKeyPool] Rotated to new ACTIVE key: provider={}, key={}", provider, next.getMaskedKey());
      return Optional.of(next);
    }

    log.error("[ApiKeyPool] All keys in pool are EXHAUSTED for provider={}!", provider);
    return Optional.empty();
  }

  public void recordSuccess(ApiKeyProvider provider, String rawKey) {
    if (rawKey == null || rawKey.isBlank()) return;
    repository.findByProviderAndRawKey(provider, rawKey.trim()).ifPresent(item -> {
      item.setSuccessCount(item.getSuccessCount() + 1);
      item.setLastUsedAt(Instant.now());
      repository.save(item);
    });
  }

  public synchronized ApiKeyPoolItem setActiveKey(String id) {
    ApiKeyPoolItem target = repository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("API Key not found with id: " + id));

    ApiKeyProvider provider = target.getProvider();

    // If key is EXHAUSTED, test with provider endpoint first before allowing activation
    if (target.getStatus() == ApiKeyStatus.EXHAUSTED) {
      boolean valid = testKey(provider, target.getRawKey());
      if (!valid) {
        throw new IllegalArgumentException(
            "API Key này hiện vẫn HẾT HẠN MỨC (429/Quota) hoặc không hợp lệ. Nhà cung cấp từ chối kích hoạt!");
      }
      target.setFailureReason(null);
      target.setExhaustedAt(null);
    } else if (target.getStatus() == ApiKeyStatus.INVALID) {
      throw new IllegalArgumentException("API Key này không hợp lệ, không thể kích hoạt.");
    }

    // Demote current ACTIVE key to AVAILABLE (only if it was ACTIVE)
    repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE)
        .ifPresent(currentActive -> {
          if (!currentActive.getId().equals(id)) {
            currentActive.setStatus(ApiKeyStatus.AVAILABLE);
            repository.save(currentActive);
          }
        });

    target.setStatus(ApiKeyStatus.ACTIVE);
    ApiKeyPoolItem saved = repository.save(target);
    if (provider == ApiKeyProvider.ZIOMAP) {
      zioMapProperties.setApiKey(target.getRawKey());
    }
    log.info("[ApiKeyPool] Manually switched active key for provider {}: {}", provider, target.getMaskedKey());
    return saved;
  }

  public boolean testKey(ApiKeyProvider provider, String rawKey) {
    if (rawKey == null || rawKey.isBlank()) return false;
    if (provider == ApiKeyProvider.ZIOMAP) {
      try {
        String baseUrl = zioMapProperties.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://ziomap-api.socibi.com";
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder().baseUrl(baseUrl).build();
        var res = client.get()
            .uri(builder -> builder.path("/api/place/autocomplete")
                .queryParam("input", "test")
                .queryParam("language", "vi")
                .queryParam("region", "vn")
                .build())
            .header("x-api-key", rawKey.trim())
            .retrieve()
            .toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      } catch (Exception e) {
        log.warn("[ApiKeyPool] ZioMap validation failed: {}", e.getMessage());
        return false;
      }
    } else if (provider == ApiKeyProvider.GEMINI) {
      try {
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        var res = client.get()
            .uri("/v1beta/models?key=" + rawKey.trim())
            .retrieve()
            .toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      } catch (Exception e) {
        log.warn("[ApiKeyPool] Gemini validation failed: {}", e.getMessage());
        return false;
      }
    }
    return false;
  }

  public synchronized void deleteKey(String id) {
    repository.findById(id).ifPresent(item -> {
      boolean wasActive = item.getStatus() == ApiKeyStatus.ACTIVE;
      ApiKeyProvider provider = item.getProvider();
      repository.deleteById(id);
      if (wasActive) {
        // Promote next available
        getActiveKeyItem(provider);
      }
    });
  }

  public synchronized int resetQuotaAll(ApiKeyProvider provider) {
    List<ApiKeyPoolItem> exhausted = repository.findByProviderAndStatus(provider, ApiKeyStatus.EXHAUSTED);
    int count = 0;
    for (ApiKeyPoolItem item : exhausted) {
      item.setStatus(ApiKeyStatus.AVAILABLE);
      item.setFailureReason(null);
      item.setExhaustedAt(null);
      repository.save(item);
      count++;
    }
    // If no active key currently, promote first available
    getActiveKeyItem(provider);
    log.info("[ApiKeyPool] Reset quota for {} keys of provider {}", count, provider);
    return count;
  }

  private void saveKeyIfAbsent(ApiKeyProvider provider, String rawKey, ApiKeyStatus status) {
    if (rawKey == null || rawKey.isBlank()) return;
    String trimmed = rawKey.trim();
    if (repository.findByProviderAndRawKey(provider, trimmed).isEmpty()) {
      repository.save(ApiKeyPoolItem.builder()
          .provider(provider)
          .rawKey(trimmed)
          .maskedKey(ApiKeyPoolItem.mask(trimmed))
          .status(status)
          .createdAt(Instant.now())
          .build());
    }
  }
}
