package fu.tripsense.placeservice.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/** Installs the additive saved-place indexes independently of runtime auto-index creation. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = "tripsense.saved-place-index-migration.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class SavedPlaceMongoIndexMigration {
  private final MongoTemplate mongoTemplate;

  @PostConstruct
  void ensureIndexes() {
    var collections = mongoTemplate.indexOps("user_place_collections");
    collections.createIndex(
        new Index()
            .on("ownerUserId", Direction.ASC)
            .on("normalizedName", Direction.ASC)
            .unique()
            .named("uq_collection_owner_name"));
    collections.createIndex(
        new Index()
            .on("ownerUserId", Direction.ASC)
            .on("updatedAt", Direction.DESC)
            .named("idx_collection_owner_updated"));

    var savedPlaces = mongoTemplate.indexOps("user_saved_places");
    savedPlaces.createIndex(
        new Index()
            .on("ownerUserId", Direction.ASC)
            .on("collectionId", Direction.ASC)
            .on("placeRef", Direction.ASC)
            .unique()
            .named("uq_saved_owner_collection_place"));
    savedPlaces.createIndex(
        new Index()
            .on("ownerUserId", Direction.ASC)
            .on("placeRef", Direction.ASC)
            .named("idx_saved_owner_place"));
    savedPlaces.createIndex(
        new Index()
            .on("ownerUserId", Direction.ASC)
            .on("savedAt", Direction.DESC)
            .named("idx_saved_owner_saved_at"));
  }
}
