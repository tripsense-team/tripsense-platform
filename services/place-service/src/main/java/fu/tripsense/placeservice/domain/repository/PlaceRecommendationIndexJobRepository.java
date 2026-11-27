package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaceRecommendationIndexJobRepository
    extends MongoRepository<PlaceRecommendationIndexJob, String> {}
