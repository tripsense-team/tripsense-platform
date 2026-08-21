package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.Place;
import org.springframework.data.domain.Pageable;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaceRepository extends MongoRepository<Place, String> {

    Optional<Place> findByProviderAndProviderPlaceId(String provider, String providerPlaceId);

    List<Place> findByLocationNear(Point point, Distance distance, Pageable pageable);

    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    List<Place> findByNameRegex(String name, Pageable pageable);

    @Query("{ $text: { $search: ?0 } }")
    List<Place> searchByText(String text, Pageable pageable);
}
