package fu.tripsense.placeservice.domain.repository;

import fu.tripsense.placeservice.domain.model.PlaceMediaBackfillJob;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PlaceMediaBackfillJobRepository
    extends MongoRepository<PlaceMediaBackfillJob, String> {
  Optional<PlaceMediaBackfillJob> findByIdempotencyKey(String idempotencyKey);
}
