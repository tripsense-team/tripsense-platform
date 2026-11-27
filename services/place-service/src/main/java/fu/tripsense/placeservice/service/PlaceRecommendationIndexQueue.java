package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob.Operation;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob.Status;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
public class PlaceRecommendationIndexQueue {
  private static final List<Duration> BACKOFF =
      List.of(
          Duration.ofSeconds(5),
          Duration.ofSeconds(30),
          Duration.ofMinutes(2),
          Duration.ofMinutes(10),
          Duration.ofMinutes(30));

  private final MongoTemplate mongo;
  private final TripSensePlaceProperties.RecommendationIndexingProperties settings;
  private final Clock clock;

  @Autowired
  public PlaceRecommendationIndexQueue(
      Optional<MongoTemplate> mongo, TripSensePlaceProperties properties) {
    this(
        requiredMongo(mongo, properties.getRecommendationIndexing()),
        properties.getRecommendationIndexing(),
        Clock.systemUTC());
  }

  PlaceRecommendationIndexQueue(
      MongoTemplate mongo,
      TripSensePlaceProperties.RecommendationIndexingProperties settings,
      Clock clock) {
    this.mongo = mongo;
    this.settings = settings;
    this.clock = clock;
  }

  public boolean enabled() {
    return settings.isEnabled();
  }

  public void enqueue(Place place, Operation hint) {
    if (!enabled() || place == null || place.getId() == null) return;
    long version = place.getVersion() == null ? 0 : place.getVersion();
    Instant now = clock.instant();
    Query query =
        Query.query(
            new Criteria()
                .andOperator(
                    Criteria.where("_id").is(place.getId()),
                    new Criteria()
                        .orOperator(
                            Criteria.where("desiredVersion").exists(false),
                            Criteria.where("desiredVersion").lte(version))));
    Update update =
        new Update()
            .set("desiredVersion", version)
            .set("operationHint", hint)
            .set("status", Status.PENDING)
            .set("attempts", 0)
            .set("nextAttemptAt", now)
            .unset("leaseToken")
            .unset("leaseUntil")
            .unset("lastErrorCode")
            .set("updatedAt", now)
            .setOnInsert("createdAt", now);
    try {
      mongo.upsert(query, update, PlaceRecommendationIndexJob.class);
    } catch (DuplicateKeyException newerJobAlreadyExists) {
      // A newer desired revision already owns the coalescing key.
    }
  }

  public List<PlaceRecommendationIndexJob> claimDue(int maximum) {
    if (!enabled() || maximum <= 0) return List.of();
    List<PlaceRecommendationIndexJob> claimed = new ArrayList<>();
    Instant now = clock.instant();
    for (int index = 0; index < maximum; index++) {
      String token = UUID.randomUUID().toString();
      Criteria due =
          new Criteria()
              .orOperator(
                  new Criteria()
                      .andOperator(
                          Criteria.where("status").is(Status.PENDING),
                          Criteria.where("nextAttemptAt").lte(now)),
                  new Criteria()
                      .andOperator(
                          Criteria.where("status").is(Status.IN_PROGRESS),
                          Criteria.where("leaseUntil").lt(now)));
      Query query = Query.query(due).with(Sort.by("nextAttemptAt", "updatedAt", "_id"));
      Update update =
          new Update()
              .set("status", Status.IN_PROGRESS)
              .set("leaseToken", token)
              .set("leaseUntil", now.plusSeconds(settings.getLeaseSeconds()))
              .set("updatedAt", now);
      PlaceRecommendationIndexJob job =
          mongo.findAndModify(
              query,
              update,
              FindAndModifyOptions.options().returnNew(true),
              PlaceRecommendationIndexJob.class);
      if (job == null) break;
      claimed.add(job);
    }
    return List.copyOf(claimed);
  }

  public void complete(PlaceRecommendationIndexJob job) {
    mongo.remove(owned(job), PlaceRecommendationIndexJob.class);
  }

  public void fail(PlaceRecommendationIndexJob job, String errorCode, boolean permanent) {
    int attempts = job.getAttempts() + 1;
    boolean dead = permanent || attempts >= settings.getMaxAttempts();
    Instant now = clock.instant();
    Update update =
        new Update()
            .set("attempts", attempts)
            .set("status", dead ? Status.DEAD_LETTER : Status.PENDING)
            .set("lastErrorCode", safeCode(errorCode))
            .set("updatedAt", now)
            .unset("leaseToken")
            .unset("leaseUntil");
    if (!dead) update.set("nextAttemptAt", now.plus(backoff(attempts, job.getPlaceId())));
    mongo.updateFirst(owned(job), update, PlaceRecommendationIndexJob.class);
  }

  private Query owned(PlaceRecommendationIndexJob job) {
    return Query.query(
        Criteria.where("_id")
            .is(job.getPlaceId())
            .and("desiredVersion")
            .is(job.getDesiredVersion())
            .and("leaseToken")
            .is(job.getLeaseToken()));
  }

  private Duration backoff(int attempts, String placeId) {
    Duration base = BACKOFF.get(Math.min(Math.max(0, attempts - 1), BACKOFF.size() - 1));
    long jitterBound = Math.max(1, base.toMillis() / 5);
    long jitter = Math.floorMod(placeId.hashCode() * 31L + attempts, jitterBound);
    return base.plusMillis(jitter);
  }

  private String safeCode(String value) {
    if (value == null || value.isBlank()) return "INDEX_UNAVAILABLE";
    String normalized = value.replaceAll("[^A-Z0-9_]", "_");
    return normalized.substring(0, Math.min(80, normalized.length()));
  }

  private static MongoTemplate requiredMongo(
      Optional<MongoTemplate> mongo,
      TripSensePlaceProperties.RecommendationIndexingProperties settings) {
    if (mongo.isPresent()) return mongo.get();
    if (settings.isEnabled()) {
      throw new IllegalStateException(
          "MongoDB is required when recommendation indexing is enabled");
    }
    return null;
  }
}
