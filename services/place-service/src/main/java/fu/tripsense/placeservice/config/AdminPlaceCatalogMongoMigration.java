package fu.tripsense.placeservice.config;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.model.PlaceManagementSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminPlaceCatalogMongoMigration {
  private final MongoTemplate mongo;

  @EventListener(ApplicationReadyEvent.class)
  public void migrate() {
    try {
      mongo.updateMulti(Query.query(Criteria.where("managementSource").exists(false)),
          new Update().set("managementSource", PlaceManagementSource.PROVIDER), Place.class);
      mongo.updateMulti(Query.query(Criteria.where("lifecycleStatus").exists(false)),
          new Update().set("lifecycleStatus", PlaceLifecycleStatus.ACTIVE), Place.class);
      mongo.updateMulti(Query.query(Criteria.where("manualOverrideFields").exists(false)),
          new Update().set("manualOverrideFields", java.util.Set.of()), Place.class);
      mongo.updateMulti(Query.query(Criteria.where("version").exists(false)),
          new Update().set("version", 0L), Place.class);
      var operations = mongo.indexOps(Place.class);
      new MongoPersistentEntityIndexResolver(mongo.getConverter().getMappingContext())
          .resolveIndexFor(Place.class).forEach(operations::ensureIndex);
    } catch (RuntimeException exception) {
      log.warn("Admin place catalog migration could not complete type={}", exception.getClass().getSimpleName());
    }
  }
}
