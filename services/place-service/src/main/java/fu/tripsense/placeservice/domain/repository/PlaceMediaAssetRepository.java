package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PlaceMediaAssetRepository extends MongoRepository<PlaceMediaAsset, String> {
  List<PlaceMediaAsset> findByPlaceIdAndModerationStatusAndHealthStatusAndDeletedAtIsNullOrderByCreatedAtAsc(
      String placeId,
      PlaceMediaAsset.ModerationStatus moderationStatus,
      PlaceMediaAsset.HealthStatus healthStatus);

  Optional<PlaceMediaAsset> findByIdAndPlaceIdAndDeletedAtIsNull(String id, String placeId);

  Optional<PlaceMediaAsset> findByChecksumSha256AndDeletedAtIsNull(String checksumSha256);

  Page<PlaceMediaAsset> findByHealthStatusInAndDeletedAtIsNull(
      Collection<PlaceMediaAsset.HealthStatus> healthStatuses, Pageable pageable);
}
