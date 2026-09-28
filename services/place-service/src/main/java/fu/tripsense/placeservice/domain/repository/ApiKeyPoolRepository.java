package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApiKeyPoolRepository extends MongoRepository<ApiKeyPoolItem, String> {

  List<ApiKeyPoolItem> findByProviderOrderByCreatedAtAsc(ApiKeyProvider provider);

  Optional<ApiKeyPoolItem> findFirstByProviderAndStatusOrderByCreatedAtAsc(
      ApiKeyProvider provider, ApiKeyStatus status);

  Optional<ApiKeyPoolItem> findByProviderAndKeyHash(ApiKeyProvider provider, String keyHash);

  Optional<ApiKeyPoolItem> findByProviderAndRawKey(ApiKeyProvider provider, String rawKey);

  List<ApiKeyPoolItem> findByProviderAndStatus(ApiKeyProvider provider, ApiKeyStatus status);

  long countByProviderAndStatus(ApiKeyProvider provider, ApiKeyStatus status);
}
