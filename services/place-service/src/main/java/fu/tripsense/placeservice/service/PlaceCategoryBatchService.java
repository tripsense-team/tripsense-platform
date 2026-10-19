package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.dto.*;
import fu.tripsense.placeservice.observability.RequestDiagnostics;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Local-only category retrieval. Intentionally has no provider dependency. */
@Service
public class PlaceCategoryBatchService {
  private final MongoTemplate mongo;
  private final PlacePersistenceService mapping;
  private final CategoryCacheAccess cache;
  private final ThreadPoolExecutor executor;

  public PlaceCategoryBatchService(
      MongoTemplate mongo,
      PlacePersistenceService mapping,
      CategoryCacheAccess cache,
      @Qualifier("categoryRetrievalExecutor") ThreadPoolExecutor executor) {
    this.mongo = mongo;
    this.mapping = mapping;
    this.cache = cache;
    this.executor = executor;
  }

  public Batch retrieve(PlaceCategoryBatchRequest request) {
    return retrieve(request, Duration.ofMillis(1200));
  }

  Batch retrieve(PlaceCategoryBatchRequest request, Duration budget) {
    long deadline = System.nanoTime() + budget.toNanos();
    Map<DiscoveryCategory, Future<Group>> tasks = new EnumMap<>(DiscoveryCategory.class);
    try {
      for (DiscoveryCategory category : request.categories()) {
        try {
          tasks.put(
              category,
              executor.submit(
                  RequestDiagnostics.wrap(
                      () ->
                          RequestDiagnostics.measure(
                              "category_" + category.name().toLowerCase(Locale.ROOT),
                              () -> retrieveGroup(request, category)))));
        } catch (RejectedExecutionException overloaded) {
          RequestDiagnostics.mark(
              "category_rejected_" + category.name().toLowerCase(Locale.ROOT), true);
        }
      }
      List<Group> groups = new ArrayList<>();
      for (DiscoveryCategory category : request.categories()) {
        Future<Group> task = tasks.get(category);
        if (task == null) {
          groups.add(error(category, "LOCAL_CATEGORY_OVERLOADED"));
          continue;
        }
        try {
          // A completed future is still harvested after another category exhausted the budget.
          groups.add(task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS));
        } catch (TimeoutException timeout) {
          groups.add(error(category, "LOCAL_CATEGORY_TIMEOUT"));
        } catch (ExecutionException | CancellationException failure) {
          RequestDiagnostics.mark(
              "category_query_failed_" + category.name().toLowerCase(Locale.ROOT), true);
          groups.add(error(category, "LOCAL_CATEGORY_UNAVAILABLE"));
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
          groups.add(error(category, "LOCAL_CATEGORY_INTERRUPTED"));
        }
      }
      RequestDiagnostics.mark(
          "category_completed_groups",
          groups.stream().filter(g -> !g.status().equals("ERROR")).count());
      return new Batch(List.copyOf(groups));
    } finally {
      tasks
          .values()
          .forEach(
              task -> {
                if (!task.isDone()) task.cancel(true);
              });
      executor.purge();
    }
  }

  private Group error(DiscoveryCategory category, String reason) {
    return new Group(category, "ERROR", List.of(), null, List.of(reason));
  }

  private Group retrieveGroup(PlaceCategoryBatchRequest r, DiscoveryCategory c) {
    String key = "discovery-" + DiscoveryCategory.POLICY_VERSION + "|" + c.name();
    String suffix = c.name().toLowerCase(Locale.ROOT);
    RequestDiagnostics.mark("category_" + suffix + "_target", r.targetPerCategory());
    Optional<List<PlaceDto>> cached;
    try {
      cached =
          RequestDiagnostics.measure(
              "category_cache_get_" + suffix,
              () ->
                  cache.getSearchResults(
                      key, r.lat(), r.lng(), r.radiusMeters(), r.targetPerCategory()));
    } catch (RuntimeException ignored) {
      cached = Optional.empty();
    }
    if (Thread.currentThread().isInterrupted()) throw new CancellationException();
    // A mismatched/invalid cached item is not evidence that canonical inventory is empty.
    if (cached.isPresent() && cached.get().stream().anyMatch(p -> !eligible(p, r, c)))
      cached = Optional.empty();
    RequestDiagnostics.mark("category_" + suffix + "_cache_hit", cached.isPresent());
    List<PlaceDto> places;
    if (cached.isPresent()) {
      places =
          cached.get().stream()
              .filter(p -> eligible(p, r, c))
              .limit(r.targetPerCategory())
              .toList();
    } else {
      places =
          RequestDiagnostics.measure(
                  "mongo_category_" + suffix, () -> mongo.find(query(r, c), Place.class))
              .stream()
              .map(mapping::toDto)
              .filter(p -> eligible(p, r, c))
              .limit(r.targetPerCategory())
              .toList();
      // Enqueue only: neither slow Redis writes nor queue saturation can lose this group.
      try {
        RequestDiagnostics.run(
            "category_cache_put_enqueue_" + suffix,
            () ->
                cache.putSearchResults(
                    key, r.lat(), r.lng(), r.radiusMeters(), r.targetPerCategory(), places));
      } catch (RuntimeException ignored) {
        RequestDiagnostics.mark("category_cache_write_failed", true);
      }
    }
    return new Group(
        c,
        places.isEmpty() ? "EMPTY" : "READY",
        places,
        new RetrievalEvidenceDto(
            places.size() >= r.targetPerCategory() ? "SUFFICIENT" : "INSUFFICIENT",
            true,
            places.size(),
            places.size(),
            Map.of(),
            1,
            "UNKNOWN",
            Set.of("LOCAL"),
            Instant.now(),
            "NOT_CALLED",
            false,
            List.of(),
            "discovery-" + DiscoveryCategory.POLICY_VERSION),
        List.of());
  }

  public static Query query(PlaceCategoryBatchRequest r, DiscoveryCategory category) {
    Criteria legacy = Criteria.where("categories").in(category.legacyTypes());
    if (category == DiscoveryCategory.HOMESTAY || category == DiscoveryCategory.STAY)
      legacy =
          new Criteria()
              .orOperator(legacy, Criteria.where("name").regex(DiscoveryCategory.HOMESTAY_NAME));
    Criteria membership =
        new Criteria()
            .orOperator(
                Criteria.where("primaryType").in(category.primaryTypes()),
                new Criteria()
                    .andOperator(
                        Criteria.where("primaryType")
                            .in(
                                Arrays.asList(
                                    null,
                                    "",
                                    "food",
                                    "store",
                                    "point_of_interest",
                                    "establishment",
                                    "lodging")),
                        legacy));
    Criteria geo =
        Criteria.where("location")
            .withinSphere(new Circle(new Point(r.lng(), r.lat()), r.radiusMeters() / 6371000.0));
    // Both predicates execute before limit. Existing location_2dsphere index is reused.
    Query query =
        Query.query(
                new Criteria()
                    .andOperator(
                        geo,
                        membership,
                        Criteria.where("businessStatus")
                            .nin("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED")))
            .limit(Math.min(200, r.targetPerCategory() * 4))
            .maxTime(Duration.ofMillis(400));
    query.fields().exclude("reviews").exclude("sourceData");
    return query;
  }

  private boolean eligible(PlaceDto p, PlaceCategoryBatchRequest r, DiscoveryCategory c) {
    if (p == null
        || p.getId() == null
        || p.getLocation() == null
        || !c.matches(p.getCategories(), p.getName(), p.getPrimaryType())) return false;
    if (Set.of("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED")
        .contains(Objects.toString(p.getBusinessStatus(), ""))) return false;
    double a = Math.toRadians(p.getLocation().getLat() - r.lat()),
        b = Math.toRadians(p.getLocation().getLng() - r.lng());
    double h =
        Math.pow(Math.sin(a / 2), 2)
            + Math.cos(Math.toRadians(r.lat()))
                * Math.cos(Math.toRadians(p.getLocation().getLat()))
                * Math.pow(Math.sin(b / 2), 2);
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) <= r.radiusMeters();
  }

  public record Batch(List<Group> groups) {}

  public record Group(
      DiscoveryCategory category,
      String status,
      List<PlaceDto> places,
      RetrievalEvidenceDto evidence,
      List<String> degradations) {}
}
