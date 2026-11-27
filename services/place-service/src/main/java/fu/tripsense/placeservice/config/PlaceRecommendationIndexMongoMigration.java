package fu.tripsense.placeservice.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "tripsense.places.recommendation-indexing",
    name = "enabled",
    havingValue = "true")
public class PlaceRecommendationIndexMongoMigration {
  private final MongoTemplate mongo;

  public PlaceRecommendationIndexMongoMigration(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @PostConstruct
  void installIndexes() {
    var indexes = mongo.indexOps("place_recommendation_index_jobs");
    indexes.ensureIndex(
        new Index()
            .on("status", Sort.Direction.ASC)
            .on("nextAttemptAt", Sort.Direction.ASC)
            .on("leaseUntil", Sort.Direction.ASC)
            .on("updatedAt", Sort.Direction.ASC)
            .named("place_rec_index_due_idx"));
    indexes.ensureIndex(
        new Index()
            .on("status", Sort.Direction.ASC)
            .on("updatedAt", Sort.Direction.ASC)
            .named("place_rec_index_dead_letter_idx"));
  }
}
