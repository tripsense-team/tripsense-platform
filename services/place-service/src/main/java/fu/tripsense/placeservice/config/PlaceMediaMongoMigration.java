package fu.tripsense.placeservice.config;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaBackfillJob;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceMediaMongoMigration {
  private final MongoTemplate mongo;

  @EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
  public void migrate() {
    try {
      mongo.updateMulti(
          Query.query(Criteria.where("mediaState").exists(false)),
          new Update()
              .set("mediaState", PlaceMediaState.PENDING)
              .set("mediaVersion", 0L)
              .set("mediaStateReason", "NO_DURABLE_ASSET"),
          Place.class);
      ensureIndexes(Place.class);
      ensureIndexes(PlaceMediaAsset.class);
      ensureIndexes(PlaceMediaBackfillJob.class);
    } catch (RuntimeException exception) {
      log.warn(
          "Place media migration could not complete type={}",
          exception.getClass().getSimpleName());
    }
  }

  private void ensureIndexes(Class<?> type) {
    IndexOperations operations = mongo.indexOps(type);
    new MongoPersistentEntityIndexResolver(mongo.getConverter().getMappingContext())
        .resolveIndexFor(type)
        .forEach(operations::ensureIndex);
  }
}
