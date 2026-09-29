package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.domain.repository.ApiKeyPoolRepository;
import fu.tripsense.placeservice.security.ApiKeyCryptoService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class ApiKeyPoolServiceTest {

  private ApiKeyPoolRepository repository;
  private ZioMapProperties properties;
  private ApiKeyCryptoService cryptoService;
  private MongoTemplate mongoTemplate;
  private ApiKeyPoolService service;

  @BeforeEach
  void setUp() {
    repository = mock(ApiKeyPoolRepository.class);
    properties = new ZioMapProperties();
    cryptoService = new ApiKeyCryptoService("test-secret-at-least-32-bytes-long!!");
    mongoTemplate = mock(MongoTemplate.class);
    service = new ApiKeyPoolService(repository, properties, cryptoService, mongoTemplate);
  }

  @Test
  void addKeys_promotesFirstKeyToActive_whenPoolEmpty() {
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(
            ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    List<ApiKeyPoolItem> result = service.addKeys(ApiKeyProvider.ZIOMAP, List.of("key-1", "key-2"));

    assertThat(result).hasSize(2);
    assertThat(result.get(0).getStatus()).isEqualTo(ApiKeyStatus.ACTIVE);
    assertThat(result.get(0).getRawKey()).isEqualTo("key-1");
    assertThat(result.get(0).getEncryptedKey()).isNotNull();
    assertThat(result.get(0).getKeyHash()).isEqualTo(cryptoService.hashKey("key-1"));
    assertThat(result.get(1).getStatus()).isEqualTo(ApiKeyStatus.INACTIVE);
    assertThat(result.get(1).getRawKey()).isEqualTo("key-2");
    assertThat(result.get(1).getEncryptedKey()).isNotNull();
    assertThat(result.get(1).getKeyHash()).isEqualTo(cryptoService.hashKey("key-2"));
    assertThat(properties.getApiKey()).isEqualTo("key-1");
  }

  @Test
  void markExhaustedAndRotate_promotesNextAvailableKey() {
    ApiKeyPoolItem key1 =
        ApiKeyPoolItem.builder()
            .id("id-1")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-1")
            .encryptedKey(cryptoService.encrypt("key-1"))
            .keyHash(cryptoService.hashKey("key-1"))
            .status(ApiKeyStatus.ACTIVE)
            .build();

    ApiKeyPoolItem key2 =
        ApiKeyPoolItem.builder()
            .id("id-2")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-2")
            .encryptedKey(cryptoService.encrypt("key-2"))
            .keyHash(cryptoService.hashKey("key-2"))
            .status(ApiKeyStatus.INACTIVE)
            .build();

    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(
            ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.of(key1));
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));
    when(repository.findFirstByProviderAndStatusInOrderByCreatedAtAsc(
            eq(ApiKeyProvider.ZIOMAP), any()))
        .thenReturn(Optional.of(key2));
    when(repository.findById("id-2")).thenReturn(Optional.of(key2));
    when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ApiKeyPoolItem.class)))
        .thenReturn(key2);

    Optional<ApiKeyPoolItem> rotated =
        service.markExhaustedAndRotate(ApiKeyProvider.ZIOMAP, "key-1", ApiKeyStatus.EXHAUSTED, "429: Too Many Requests");

    assertThat(rotated).isPresent();
    assertThat(key1.getStatus()).isEqualTo(ApiKeyStatus.EXHAUSTED);
    assertThat(key1.getFailureReason()).contains("429");
  }

  @Test
  void markExhaustedAndRotate_skipsWhenAlreadyRotatedByAnotherThread() {
    ApiKeyPoolItem currentActiveKey =
        ApiKeyPoolItem.builder()
            .id("id-2")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-2")
            .encryptedKey(cryptoService.encrypt("key-2"))
            .keyHash(cryptoService.hashKey("key-2"))
            .status(ApiKeyStatus.ACTIVE)
            .build();

    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(
            ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.of(currentActiveKey));

    // A stale request failed on "key-1", but the active key is now "key-2"
    Optional<ApiKeyPoolItem> result =
        service.markExhaustedAndRotate(ApiKeyProvider.ZIOMAP, "key-1", ApiKeyStatus.EXHAUSTED, "429: Too Many Requests");

    assertThat(result).isPresent();
    assertThat(result.get().getId()).isEqualTo("id-2");
    // Verify key2 was NOT modified
    verify(repository, never()).save(any());
  }

  @Test
  void disableKey_setsStatusToDisabled_andPromotesNextStandbyIfActive() {
    ApiKeyPoolItem activeKey =
        ApiKeyPoolItem.builder()
            .id("id-1")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-1")
            .encryptedKey(cryptoService.encrypt("key-1"))
            .keyHash(cryptoService.hashKey("key-1"))
            .status(ApiKeyStatus.ACTIVE)
            .build();

    ApiKeyPoolItem standbyKey =
        ApiKeyPoolItem.builder()
            .id("id-2")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-2")
            .encryptedKey(cryptoService.encrypt("key-2"))
            .keyHash(cryptoService.hashKey("key-2"))
            .status(ApiKeyStatus.INACTIVE)
            .build();

    when(repository.findById("id-1")).thenReturn(Optional.of(activeKey));
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(
            ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repository.findFirstByProviderAndStatusInOrderByCreatedAtAsc(
            eq(ApiKeyProvider.ZIOMAP), any()))
        .thenReturn(Optional.of(standbyKey));
    when(repository.findById("id-2")).thenReturn(Optional.of(standbyKey));
    when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ApiKeyPoolItem.class)))
        .thenReturn(standbyKey);

    ApiKeyPoolItem disabled = service.disableKey("id-1");

    assertThat(disabled.getStatus()).isEqualTo(ApiKeyStatus.DISABLED);
    verify(repository).save(activeKey);
  }

  @Test
  void resetQuotaAll_restoresOnlyExhaustedKeysToInactive() {
    ApiKeyPoolItem exhaustedKey =
        ApiKeyPoolItem.builder()
            .id("id-1")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-1")
            .status(ApiKeyStatus.EXHAUSTED)
            .failureReason("Quota exceeded")
            .build();

    List<ApiKeyPoolItem> exhaustedList = new ArrayList<>(List.of(exhaustedKey));
    when(repository.findByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.EXHAUSTED))
        .thenReturn(exhaustedList);
    when(repository.countByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(0L);
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(
            ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repository.findFirstByProviderAndStatusInOrderByCreatedAtAsc(
            eq(ApiKeyProvider.ZIOMAP), any()))
        .thenReturn(Optional.of(exhaustedKey));
    when(repository.findById("id-1")).thenReturn(Optional.of(exhaustedKey));
    when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ApiKeyPoolItem.class)))
        .thenReturn(exhaustedKey);
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    int count = service.resetQuotaAll(ApiKeyProvider.ZIOMAP);

    assertThat(count).isEqualTo(1);
    assertThat(exhaustedKey.getStatus()).isEqualTo(ApiKeyStatus.INACTIVE);
    assertThat(exhaustedKey.getFailureReason()).isNull();
  }

  @Test
  void setActiveKey_performsAtomicUpdate() {
    ApiKeyPoolItem key3 =
        ApiKeyPoolItem.builder()
            .id("id-3")
            .provider(ApiKeyProvider.ZIOMAP)
            .rawKey("key-3")
            .status(ApiKeyStatus.INACTIVE)
            .build();

    when(repository.findById("id-3")).thenReturn(Optional.of(key3));
    when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ApiKeyPoolItem.class)))
        .thenReturn(key3);

    ApiKeyPoolItem activated = service.setActiveKey("id-3");

    assertThat(activated.getId()).isEqualTo("id-3");
    verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(ApiKeyPoolItem.class));
    verify(mongoTemplate).findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(ApiKeyPoolItem.class));
  }

  @Test
  void testKeyById_handlesUndecryptableKey() {
    ApiKeyPoolItem badKey =
        ApiKeyPoolItem.builder()
            .id("bad-id")
            .provider(ApiKeyProvider.ZIOMAP)
            .encryptedKey("corrupted-base64-payload")
            .status(ApiKeyStatus.INACTIVE)
            .build();

    when(repository.findById("bad-id")).thenReturn(Optional.of(badKey));
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> result = service.testKeyById("bad-id");

    assertThat(result.get("valid")).isEqualTo(false);
    assertThat(result.get("status")).isEqualTo("INVALID");
    assertThat((String) result.get("failureReason")).contains("Không thể giải mã API Key");
  }
}
