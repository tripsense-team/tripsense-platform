package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.UserPlaceCollection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserPlaceCollectionRepository
    extends MongoRepository<UserPlaceCollection, UUID> {
  List<UserPlaceCollection> findByOwnerUserIdOrderByUpdatedAtDesc(UUID ownerUserId);

  Optional<UserPlaceCollection> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

  boolean existsByOwnerUserIdAndNormalizedName(UUID ownerUserId, String normalizedName);

  long countByOwnerUserId(UUID ownerUserId);
}
