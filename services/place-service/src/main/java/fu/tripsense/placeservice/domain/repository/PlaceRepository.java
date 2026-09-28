package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.Place;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaceRepository extends MongoRepository<Place, String> {

  Optional<Place> findByProviderAndProviderPlaceId(String provider, String providerPlaceId);

  List<Place> findByProviderPlaceIdIn(List<String> providerPlaceIds);

  List<Place> findByNormalizedName(String normalizedName);

  List<Place> findByLocationNear(Point point, Distance distance, Pageable pageable);

  @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
  List<Place> findByNameRegex(String name, Pageable pageable);

  @Query("{ $text: { $search: ?0 } }")
  List<Place> searchByText(String text, Pageable pageable);

  @Query("{ $or: [ { 'reviews': { $size: 0 } }, { 'reviews': null }, { 'photos': { $size: 0 } }, { 'photos': null }, { 'rating': null } ] }")
  List<Place> findPendingEnrichment(Pageable pageable);

  @Query(value = "{ $or: [ { 'reviews': { $size: 0 } }, { 'reviews': null }, { 'photos': { $size: 0 } }, { 'photos': null }, { 'rating': null } ] }", count = true)
  long countPendingEnrichment();
}

