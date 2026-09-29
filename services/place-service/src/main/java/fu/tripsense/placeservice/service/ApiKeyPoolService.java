package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.domain.repository.ApiKeyPoolRepository;
import fu.tripsense.placeservice.security.ApiKeyCryptoService;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyPoolService {

  private final ApiKeyPoolRepository repository;
  private final ZioMapProperties zioMapProperties;
  private final ApiKeyCryptoService apiKeyCryptoService;
  private final MongoTemplate mongoTemplate;

  @Value("${EMBEDDING_API_KEY:${embedding.api-key:}}")
  private String defaultGeminiKey;

  /** In-memory cache for decrypted active raw keys to avoid repeated AES decryption on every request. */
  private final Map<ApiKeyProvider, CachedActiveKey> activeKeyCache = new ConcurrentHashMap<>();
  private static final Duration CACHE_TTL = Duration.ofMinutes(2);

  private record CachedActiveKey(String keyHash, String rawKey, Instant expiresAt) {}

  @PostConstruct
  public void seedInitialKeys() {
    try {
      // Seed ZioMap key if pool has no active or standby key
      if (repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.INACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.AVAILABLE) == 0) {
        String initialZioKey = zioMapProperties.getApiKey();
        if (initialZioKey != null && !initialZioKey.isBlank()) {
          saveKeyIfAbsent(ApiKeyProvider.ZIOMAP, initialZioKey, ApiKeyStatus.ACTIVE);
          log.info(
              "[ApiKeyPool] Seeded initial ZioMap API Key from properties: {}",
              ApiKeyPoolItem.mask(initialZioKey));
        }
      }

      // Seed Gemini key if pool has no active or standby key
      if (repository.countByProviderAndStatus(ApiKeyProvider.GEMINI, ApiKeyStatus.ACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.GEMINI, ApiKeyStatus.INACTIVE) == 0
          && repository.countByProviderAndStatus(ApiKeyProvider.GEMINI, ApiKeyStatus.AVAILABLE) == 0) {
        if (defaultGeminiKey != null && !defaultGeminiKey.isBlank()) {
          saveKeyIfAbsent(ApiKeyProvider.GEMINI, defaultGeminiKey, ApiKeyStatus.ACTIVE);
          log.info(
              "[ApiKeyPool] Seeded initial Gemini API Key from environment: {}",
              ApiKeyPoolItem.mask(defaultGeminiKey));
        }
      }
    } catch (Exception e) {
      log.warn("[ApiKeyPool] Could not seed initial API keys: {}", e.getMessage());
    }
  }

  public String resolveRawKey(ApiKeyPoolItem item) {
    if (item == null) return null;
    if (item.getRawKey() != null && !item.getRawKey().isBlank()) {
      return item.getRawKey();
    }
    if (item.getEncryptedKey() != null && !item.getEncryptedKey().isBlank()) {
      String decrypted = apiKeyCryptoService.decrypt(item.getEncryptedKey());
      item.setRawKey(decrypted);
      return decrypted;
    }
    return null;
  }

  public List<ApiKeyPoolItem> listKeys(ApiKeyProvider provider) {
    return repository.findByProviderOrderByCreatedAtAsc(provider);
  }

  public synchronized List<ApiKeyPoolItem> addKeys(ApiKeyProvider provider, List<String> rawKeys) {
    List<ApiKeyPoolItem> saved = new ArrayList<>();
    boolean hasActive =
        repository
            .findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE)
            .isPresent();

    for (String raw : rawKeys) {
      if (raw == null || raw.isBlank()) continue;
      String trimmed = raw.trim();
      String keyHash = apiKeyCryptoService.hashKey(trimmed);
      Optional<ApiKeyPoolItem> existing = repository.findByProviderAndKeyHash(provider, keyHash);
      if (existing.isPresent()) {
        ApiKeyPoolItem item = existing.get();
        item.setRawKey(trimmed);
        saved.add(item);
        continue;
      }

      // First key becomes ACTIVE only if no ACTIVE key currently exists
      ApiKeyStatus initialStatus =
          (!hasActive && saved.isEmpty()) ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE;

      ApiKeyPoolItem item =
          ApiKeyPoolItem.builder()
              .provider(provider)
              .rawKey(trimmed)
              .encryptedKey(apiKeyCryptoService.encrypt(trimmed))
              .keyHash(keyHash)
              .maskedKey(ApiKeyPoolItem.mask(trimmed))
              .status(initialStatus)
              .createdAt(Instant.now())
              .build();

      ApiKeyPoolItem persisted = repository.save(item);
      saved.add(persisted);

      if (initialStatus == ApiKeyStatus.ACTIVE) {
        hasActive = true;
        cacheActiveKey(provider, keyHash, trimmed);
        if (provider == ApiKeyProvider.ZIOMAP) {
          zioMapProperties.setApiKey(trimmed);
        }
      }
    }
    return saved;
  }

  /**
   * Retrieves the current ACTIVE key item from database.
   * If none is found, attempts to promote the first available standby (INACTIVE / AVAILABLE) key.
   */
  public synchronized Optional<ApiKeyPoolItem> getActiveKeyItem(ApiKeyProvider provider) {
    Optional<ApiKeyPoolItem> active =
        repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE);
    if (active.isPresent()) {
      resolveRawKey(active.get());
      return active;
    }

    // Auto-promote first standby key if no active key exists
    Optional<ApiKeyPoolItem> standby =
        repository.findFirstByProviderAndStatusInOrderByCreatedAtAsc(
            provider, List.of(ApiKeyStatus.INACTIVE, ApiKeyStatus.AVAILABLE));

    if (standby.isPresent()) {
      return Optional.of(setActiveKey(standby.get().getId()));
    }

    return Optional.empty();
  }

  /**
   * Fast resolution of effective active raw key with in-memory caching.
   */
  public String getActiveKey(ApiKeyProvider provider) {
    CachedActiveKey cached = activeKeyCache.get(provider);
    Instant now = Instant.now();
    if (cached != null && cached.expiresAt().isAfter(now) && cached.rawKey() != null) {
      return cached.rawKey();
    }

    Optional<ApiKeyPoolItem> activeItem = getActiveKeyItem(provider);
    if (activeItem.isPresent()) {
      String raw = resolveRawKey(activeItem.get());
      if (raw != null) {
        cacheActiveKey(provider, activeItem.get().getKeyHash(), raw);
        return raw;
      }
    }

    // Fallback to static properties if pool is empty
    if (provider == ApiKeyProvider.ZIOMAP) {
      return zioMapProperties.getApiKey();
    } else if (provider == ApiKeyProvider.GEMINI) {
      return defaultGeminiKey;
    }
    return null;
  }

  /**
   * Atomically activates a key and demotes any existing active keys of the same provider to INACTIVE.
   * Immediately invalidates in-memory cache so subsequent requests use the new key without restart.
   */
  public synchronized ApiKeyPoolItem setActiveKey(String id) {
    ApiKeyPoolItem target =
        repository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("API Key not found with id: " + id));

    ApiKeyProvider provider = target.getProvider();

    if (target.getStatus() == ApiKeyStatus.DISABLED) {
      throw new IllegalArgumentException(
          "API Key này đang bị vô hiệu hóa (DISABLED). Vui lòng chuyển sang INACTIVE trước khi kích hoạt.");
    }
    if (target.getStatus() == ApiKeyStatus.INVALID) {
      throw new IllegalArgumentException("API Key này không hợp lệ (INVALID), không thể kích hoạt.");
    }

    String rawKey = resolveRawKey(target);

    // 1. Demote any currently ACTIVE keys of this provider to INACTIVE
    Query demoteQuery =
        Query.query(
            Criteria.where("provider")
                .is(provider)
                .and("status")
                .is(ApiKeyStatus.ACTIVE)
                .and("id")
                .ne(id));
    Update demoteUpdate = Update.update("status", ApiKeyStatus.INACTIVE);
    mongoTemplate.updateMulti(demoteQuery, demoteUpdate, ApiKeyPoolItem.class);

    // 2. Atomically promote target key to ACTIVE and clear failure marks
    Query promoteQuery = Query.query(Criteria.where("id").is(id));
    Update promoteUpdate =
        new Update()
            .set("status", ApiKeyStatus.ACTIVE)
            .set("failureReason", null)
            .set("exhaustedAt", null);
    ApiKeyPoolItem updated =
        mongoTemplate.findAndModify(
            promoteQuery,
            promoteUpdate,
            FindAndModifyOptions.options().returnNew(true),
            ApiKeyPoolItem.class);

    if (updated == null) {
      throw new IllegalArgumentException("Không thể kích hoạt API Key với id: " + id);
    }

    updated.setRawKey(rawKey);

    // 3. Update cache & properties
    cacheActiveKey(provider, updated.getKeyHash(), rawKey);
    if (provider == ApiKeyProvider.ZIOMAP && rawKey != null) {
      zioMapProperties.setApiKey(rawKey);
    }

    log.info(
        "[ApiKeyPool] Switched active key atomically for provider {}: {}",
        provider,
        updated.getMaskedKey());
    return updated;
  }

  /**
   * Manually disables a key. Disabled keys will NEVER be auto-promoted or resurrected by quota reset.
   */
  public synchronized ApiKeyPoolItem disableKey(String id) {
    ApiKeyPoolItem target =
        repository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("API Key not found with id: " + id));

    boolean wasActive = target.getStatus() == ApiKeyStatus.ACTIVE;
    ApiKeyProvider provider = target.getProvider();

    target.setStatus(ApiKeyStatus.DISABLED);
    target.setFailureReason("Manually disabled by administrator");
    ApiKeyPoolItem saved = repository.save(target);

    if (wasActive) {
      invalidateCache(provider);
      // Promote next standby key
      getActiveKeyItem(provider);
    }

    log.info("[ApiKeyPool] Key disabled: id={}, provider={}, masked={}", id, provider, target.getMaskedKey());
    return saved;
  }

  /**
   * Re-enables a DISABLED or INVALID key, putting it into INACTIVE standby state.
   */
  public synchronized ApiKeyPoolItem enableKey(String id) {
    ApiKeyPoolItem target =
        repository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("API Key not found with id: " + id));

    target.setStatus(ApiKeyStatus.INACTIVE);
    target.setFailureReason(null);
    target.setExhaustedAt(null);
    ApiKeyPoolItem saved = repository.save(target);

    // If no active key exists, promote this one
    if (repository.countByProviderAndStatus(target.getProvider(), ApiKeyStatus.ACTIVE) == 0) {
      return setActiveKey(id);
    }

    log.info("[ApiKeyPool] Key enabled to INACTIVE: id={}, provider={}, masked={}", id, target.getProvider(), target.getMaskedKey());
    return saved;
  }

  /**
   * Handles quota/rate-limit/auth failure with Anti-Thundering-Herd check.
   * Only rotates if the failed key is STILL the current ACTIVE key.
   */
  public synchronized Optional<ApiKeyPoolItem> markExhaustedAndRotate(
      ApiKeyProvider provider, String failedRawKey, ApiKeyStatus failureStatus, String reason) {
    if (failedRawKey == null || failedRawKey.isBlank()) {
      return getActiveKeyItem(provider);
    }

    String failedKeyHash = apiKeyCryptoService.hashKey(failedRawKey);

    Optional<ApiKeyPoolItem> currentActiveOpt =
        repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(provider, ApiKeyStatus.ACTIVE);

    if (currentActiveOpt.isEmpty()) {
      return promoteNextStandbyKey(provider);
    }

    ApiKeyPoolItem currentActive = currentActiveOpt.get();

    // Anti-Thundering-Herd: If the failed key is NOT the current active key, skip rotating again!
    if (!currentActive.getKeyHash().equals(failedKeyHash)) {
      log.info(
          "[ApiKeyPool] Key {} was already rotated by another thread. Current active key is: {}. Skipping duplicate rotation.",
          ApiKeyPoolItem.mask(failedRawKey),
          currentActive.getMaskedKey());
      return Optional.of(currentActive);
    }

    currentActive.setStatus(failureStatus != null ? failureStatus : ApiKeyStatus.EXHAUSTED);
    currentActive.setExhaustedAt(Instant.now());
    currentActive.setFailureReason(reason);
    repository.save(currentActive);
    invalidateCache(provider);

    log.warn(
        "[ApiKeyPool] Active key marked {}: provider={}, key={}, reason={}",
        currentActive.getStatus(),
        provider,
        currentActive.getMaskedKey(),
        reason);

    return promoteNextStandbyKey(provider);
  }

  public Optional<ApiKeyPoolItem> markExhaustedAndRotate(
      ApiKeyProvider provider, String failedRawKey, String reason) {
    return markExhaustedAndRotate(provider, failedRawKey, ApiKeyStatus.EXHAUSTED, reason);
  }

  private Optional<ApiKeyPoolItem> promoteNextStandbyKey(ApiKeyProvider provider) {
    Optional<ApiKeyPoolItem> nextStandby =
        repository.findFirstByProviderAndStatusInOrderByCreatedAtAsc(
            provider, List.of(ApiKeyStatus.INACTIVE, ApiKeyStatus.AVAILABLE));

    if (nextStandby.isPresent()) {
      ApiKeyPoolItem next = nextStandby.get();
      return Optional.of(setActiveKey(next.getId()));
    }

    log.error("[ApiKeyPool] All keys in pool are exhausted/unavailable for provider={}!", provider);
    return Optional.empty();
  }

  public void recordSuccess(ApiKeyProvider provider, String rawKey) {
    if (rawKey == null || rawKey.isBlank()) return;
    String keyHash = apiKeyCryptoService.hashKey(rawKey);
    repository
        .findByProviderAndKeyHash(provider, keyHash)
        .ifPresent(
            item -> {
              item.setSuccessCount(item.getSuccessCount() + 1);
              item.setLastUsedAt(Instant.now());
              repository.save(item);
            });
  }

  public boolean testKey(ApiKeyProvider provider, String rawKey) {
    if (rawKey == null || rawKey.isBlank()) return false;
    String trimmed = rawKey.trim();

    try {
      if (provider == ApiKeyProvider.ZIOMAP) {
        String baseUrl = zioMapProperties.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://ziomap-api.socibi.com";
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder().baseUrl(baseUrl).build();
        var res =
            client
                .get()
                .uri(
                    builder ->
                        builder
                            .path("/api/place/autocomplete")
                            .queryParam("input", "test")
                            .queryParam("language", "vi")
                            .queryParam("region", "vn")
                            .build())
                .header("x-api-key", trimmed)
                .retrieve()
                .toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      } else if (provider == ApiKeyProvider.GEMINI) {
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        var res =
            client.get().uri("/v1beta/models?key=" + trimmed).retrieve().toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      } else if (provider == ApiKeyProvider.OPENAI) {
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder()
                .baseUrl("https://api.openai.com")
                .build();
        var res =
            client
                .get()
                .uri("/v1/models")
                .header("Authorization", "Bearer " + trimmed)
                .retrieve()
                .toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      } else if (provider == ApiKeyProvider.GOOGLE_MAPS) {
        org.springframework.web.client.RestClient client =
            org.springframework.web.client.RestClient.builder()
                .baseUrl("https://maps.googleapis.com")
                .build();
        var res =
            client
                .get()
                .uri("/maps/api/place/autocomplete/json?input=test&key=" + trimmed)
                .retrieve()
                .toBodilessEntity();
        return res.getStatusCode().is2xxSuccessful();
      }
    } catch (Exception e) {
      log.warn("[ApiKeyPool] Validation failed for provider {}: {}", provider, e.getMessage());
      return false;
    }
    return false;
  }

  public Map<String, Object> testKeyById(String id) {
    ApiKeyPoolItem target =
        repository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("API Key not found with id: " + id));

    ApiKeyProvider provider = target.getProvider();
    String rawKey = resolveRawKey(target);
    boolean valid = testKey(provider, rawKey);

    if (valid) {
      if (target.getStatus() == ApiKeyStatus.EXHAUSTED) {
        target.setStatus(ApiKeyStatus.INACTIVE);
        target.setFailureReason(null);
        target.setExhaustedAt(null);
        repository.save(target);
      }
    } else {
      boolean wasActive = target.getStatus() == ApiKeyStatus.ACTIVE;
      target.setStatus(ApiKeyStatus.EXHAUSTED);
      target.setFailureReason("Connection test failed (403 / 429 Quota Exceeded / Invalid Key)");
      target.setExhaustedAt(Instant.now());
      repository.save(target);
      if (wasActive) {
        invalidateCache(provider);
        getActiveKeyItem(provider);
      }
    }

    return Map.of(
        "id", id,
        "valid", valid,
        "status", target.getStatus().name(),
        "maskedKey", target.getMaskedKey() != null ? target.getMaskedKey() : "",
        "failureReason", target.getFailureReason() != null ? target.getFailureReason() : "");
  }

  public synchronized void deleteKey(String id) {
    repository
        .findById(id)
        .ifPresent(
            item -> {
              boolean wasActive = item.getStatus() == ApiKeyStatus.ACTIVE;
              ApiKeyProvider provider = item.getProvider();
              repository.deleteById(id);
              if (wasActive) {
                invalidateCache(provider);
                getActiveKeyItem(provider);
              }
            });
  }

  /**
   * Resets ONLY EXHAUSTED keys for a provider back to INACTIVE standby.
   * Never modifies DISABLED or INVALID keys.
   */
  public synchronized int resetQuotaAll(ApiKeyProvider provider) {
    List<ApiKeyPoolItem> exhausted =
        repository.findByProviderAndStatus(provider, ApiKeyStatus.EXHAUSTED);
    int count = 0;
    for (ApiKeyPoolItem item : exhausted) {
      item.setStatus(ApiKeyStatus.INACTIVE);
      item.setFailureReason(null);
      item.setExhaustedAt(null);
      repository.save(item);
      count++;
    }

    if (repository.countByProviderAndStatus(provider, ApiKeyStatus.ACTIVE) == 0) {
      getActiveKeyItem(provider);
    }
    invalidateCache(provider);
    log.info("[ApiKeyPool] Reset quota for {} EXHAUSTED keys of provider {}", count, provider);
    return count;
  }

  public void invalidateCache(ApiKeyProvider provider) {
    activeKeyCache.remove(provider);
  }

  private void cacheActiveKey(ApiKeyProvider provider, String keyHash, String rawKey) {
    if (rawKey != null && !rawKey.isBlank()) {
      activeKeyCache.put(
          provider, new CachedActiveKey(keyHash, rawKey, Instant.now().plus(CACHE_TTL)));
    }
  }

  private void saveKeyIfAbsent(ApiKeyProvider provider, String rawKey, ApiKeyStatus status) {
    if (rawKey == null || rawKey.isBlank()) return;
    String trimmed = rawKey.trim();
    String keyHash = apiKeyCryptoService.hashKey(trimmed);
    if (repository.findByProviderAndKeyHash(provider, keyHash).isEmpty()) {
      repository.save(
          ApiKeyPoolItem.builder()
              .provider(provider)
              .rawKey(trimmed)
              .encryptedKey(apiKeyCryptoService.encrypt(trimmed))
              .keyHash(keyHash)
              .maskedKey(ApiKeyPoolItem.mask(trimmed))
              .status(status)
              .createdAt(Instant.now())
              .build());
    }
  }
}
