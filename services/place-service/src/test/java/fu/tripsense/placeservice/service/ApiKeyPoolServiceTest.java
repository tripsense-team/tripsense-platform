package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.domain.repository.ApiKeyPoolRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ApiKeyPoolServiceTest {

  private ApiKeyPoolRepository repository;
  private ZioMapProperties properties;
  private ApiKeyPoolService service;

  @BeforeEach
  void setUp() {
    repository = mock(ApiKeyPoolRepository.class);
    properties = new ZioMapProperties();
    service = new ApiKeyPoolService(repository, properties);
  }

  @Test
  void addKeys_promotesFirstKeyToActive_whenPoolEmpty() {
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    List<ApiKeyPoolItem> result = service.addKeys(ApiKeyProvider.ZIOMAP, List.of("key-1", "key-2"));

    assertThat(result).hasSize(2);
    assertThat(result.get(0).getStatus()).isEqualTo(ApiKeyStatus.ACTIVE);
    assertThat(result.get(0).getRawKey()).isEqualTo("key-1");
    assertThat(result.get(1).getStatus()).isEqualTo(ApiKeyStatus.AVAILABLE);
    assertThat(result.get(1).getRawKey()).isEqualTo("key-2");
    assertThat(properties.getApiKey()).isEqualTo("key-1");
  }

  @Test
  void markExhaustedAndRotate_promotesNextAvailableKey() {
    ApiKeyPoolItem key1 = ApiKeyPoolItem.builder()
        .id("id-1")
        .provider(ApiKeyProvider.ZIOMAP)
        .rawKey("key-1")
        .status(ApiKeyStatus.ACTIVE)
        .build();

    ApiKeyPoolItem key2 = ApiKeyPoolItem.builder()
        .id("id-2")
        .provider(ApiKeyProvider.ZIOMAP)
        .rawKey("key-2")
        .status(ApiKeyStatus.AVAILABLE)
        .build();

    when(repository.findByProviderAndRawKey(ApiKeyProvider.ZIOMAP, "key-1")).thenReturn(Optional.of(key1));
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(ApiKeyProvider.ZIOMAP, ApiKeyStatus.AVAILABLE))
        .thenReturn(Optional.of(key2));
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    Optional<ApiKeyPoolItem> rotated = service.markExhaustedAndRotate(
        ApiKeyProvider.ZIOMAP, "key-1", "429: Too Many Requests");

    assertThat(rotated).isPresent();
    assertThat(rotated.get().getRawKey()).isEqualTo("key-2");
    assertThat(rotated.get().getStatus()).isEqualTo(ApiKeyStatus.ACTIVE);
    assertThat(key1.getStatus()).isEqualTo(ApiKeyStatus.EXHAUSTED);
    assertThat(key1.getFailureReason()).contains("429");
    assertThat(properties.getApiKey()).isEqualTo("key-2");
  }

  @Test
  void resetQuotaAll_restoresExhaustedKeysToAvailable() {
    ApiKeyPoolItem key1 = ApiKeyPoolItem.builder()
        .id("id-1")
        .provider(ApiKeyProvider.ZIOMAP)
        .rawKey("key-1")
        .status(ApiKeyStatus.EXHAUSTED)
        .failureReason("Quota exceeded")
        .build();

    List<ApiKeyPoolItem> exhaustedList = new ArrayList<>(List.of(key1));
    when(repository.findByProviderAndStatus(ApiKeyProvider.ZIOMAP, ApiKeyStatus.EXHAUSTED)).thenReturn(exhaustedList);
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(ApiKeyProvider.ZIOMAP, ApiKeyStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repository.findFirstByProviderAndStatusOrderByCreatedAtAsc(ApiKeyProvider.ZIOMAP, ApiKeyStatus.AVAILABLE))
        .thenReturn(Optional.of(key1));
    when(repository.save(any(ApiKeyPoolItem.class))).thenAnswer(inv -> inv.getArgument(0));

    int count = service.resetQuotaAll(ApiKeyProvider.ZIOMAP);

    assertThat(count).isEqualTo(1);
    assertThat(key1.getStatus()).isEqualTo(ApiKeyStatus.ACTIVE);
    assertThat(key1.getFailureReason()).isNull();
  }
}
