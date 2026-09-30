package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.UserSavedPlace;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserSavedPlaceRepository extends MongoRepository<UserSavedPlace, UUID> {
  List<UserSavedPlace> findByOwnerUserIdOrderBySavedAtDesc(UUID ownerUserId);

  List<UserSavedPlace> findByOwnerUserIdAndCollectionIdOrderBySavedAtDesc(
      UUID ownerUserId, UUID collectionId);

  List<UserSavedPlace> findByOwnerUserIdAndPlaceRef(UUID ownerUserId, String placeRef);

  Optional<UserSavedPlace> findByOwnerUserIdAndCollectionIdAndPlaceRef(
      UUID ownerUserId, UUID collectionId, String placeRef);

  long countByOwnerUserIdAndCollectionId(UUID ownerUserId, UUID collectionId);

  void deleteByOwnerUserIdAndCollectionId(UUID ownerUserId, UUID collectionId);

  void deleteByOwnerUserIdAndCollectionIdAndPlaceRef(
      UUID ownerUserId, UUID collectionId, String placeRef);
}
