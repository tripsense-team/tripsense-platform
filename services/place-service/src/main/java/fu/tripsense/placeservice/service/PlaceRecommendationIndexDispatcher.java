package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.client.RecommendationIndexerClient.ItemResult;
import fu.tripsense.placeservice.client.RecommendationIndexerClient.Status;
import fu.tripsense.placeservice.client.dto.PlaceIndexingPayload;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob.Operation;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PlaceRecommendationIndexDispatcher {
  private final PlaceRecommendationIndexQueue queue;
  private final PlaceRepository places;
  private final PlacePersistenceService persistence;
  private final RecommendationIndexerClient client;
  private final TripSensePlaceProperties properties;
  private final ExecutorService executor;
  private final AtomicBoolean running = new AtomicBoolean();

  public PlaceRecommendationIndexDispatcher(
      PlaceRecommendationIndexQueue queue,
      PlaceRepository places,
      PlacePersistenceService persistence,
      RecommendationIndexerClient client,
      TripSensePlaceProperties properties,
      @Qualifier("placeRecommendationIndexExecutor") ExecutorService executor) {
    this.queue = queue;
    this.places = places;
    this.persistence = persistence;
    this.client = client;
    this.properties = properties;
    this.executor = executor;
    validateConfiguration();
  }

  @Scheduled(
      initialDelayString = "${tripsense.places.recommendation-indexing.dispatch-delay-ms:5000}",
      fixedDelayString = "${tripsense.places.recommendation-indexing.dispatch-delay-ms:5000}")
  public void schedule() {
    if (!queue.enabled() || !running.compareAndSet(false, true)) return;
    try {
      executor.execute(
          () -> {
            try {
              dispatchOnce();
            } finally {
              running.set(false);
            }
          });
    } catch (RejectedExecutionException saturated) {
      running.set(false);
    }
  }

  void dispatchOnce() {
    int batchSize = Math.max(1, Math.min(100, properties.getRecommendationIndexing().getBatchSize()));
    List<PlaceRecommendationIndexJob> jobs = queue.claimDue(batchSize);
    if (jobs.isEmpty()) return;
    Map<String, PlaceRecommendationIndexJob> byId = new HashMap<>();
    jobs.forEach(job -> byId.put(job.getPlaceId(), job));
    Map<String, Place> canonical = new HashMap<>();
    places.findAllById(byId.keySet()).forEach(place -> canonical.put(place.getId(), place));

    List<PlaceIndexingPayload> upserts = new ArrayList<>();
    List<PlaceRecommendationIndexJob> deletes = new ArrayList<>();
    for (PlaceRecommendationIndexJob job : jobs) {
      Place place = canonical.get(job.getPlaceId());
      if (place == null || place.getLifecycleStatus() == PlaceLifecycleStatus.ARCHIVED) {
        deletes.add(job);
      } else {
        var dto = persistence.toDto(place);
        if (dto == null) {
          queue.fail(job, "PLACE_SNAPSHOT_UNAVAILABLE", false);
        } else {
          upserts.add(
              PlaceIndexingPayload.from(dto, place.getVersion(), place.getUpdatedAt()));
        }
      }
    }

    dispatchUpserts(upserts, byId);
    for (PlaceRecommendationIndexJob job : deletes) {
      try {
        client.delete(job.getPlaceId());
        queue.complete(job);
      } catch (RuntimeException failure) {
        queue.fail(job, classify(failure), false);
      }
    }
  }

  private void dispatchUpserts(
      List<PlaceIndexingPayload> payloads, Map<String, PlaceRecommendationIndexJob> jobs) {
    if (payloads.isEmpty()) return;
    try {
      Map<String, ItemResult> results = new HashMap<>();
      client.index(payloads).results().forEach(result -> results.put(result.placeId(), result));
      for (PlaceIndexingPayload payload : payloads) {
        PlaceRecommendationIndexJob job = jobs.get(payload.id());
        ItemResult result = results.get(payload.id());
        if (result == null) {
          queue.fail(job, "INDEX_RESULT_MISSING", false);
        } else if (result.status() == Status.INDEXED || result.status() == Status.UNCHANGED) {
          queue.complete(job);
        } else {
          queue.fail(
              job,
              result.errorCode(),
              result.status() == Status.PERMANENT_FAILURE);
        }
      }
    } catch (RuntimeException failure) {
      String code = classify(failure);
      payloads.forEach(payload -> queue.fail(jobs.get(payload.id()), code, false));
    }
  }

  private String classify(RuntimeException failure) {
    String message = failure.getMessage() == null ? "" : failure.getMessage();
    if (message.contains("401") || message.contains("403")) return "INTERNAL_AUTH_FAILED";
    if (message.contains("429")) return "INDEX_RATE_LIMITED";
    if (failure.getClass().getSimpleName().toLowerCase(java.util.Locale.ROOT).contains("timeout")) {
      return "INDEX_TIMEOUT";
    }
    return "RECOMMENDATION_UNAVAILABLE";
  }

  private void validateConfiguration() {
    if (!queue.enabled()) return;
    if (properties.getRecommendationInternalApiKey() == null
        || properties.getRecommendationInternalApiKey().isBlank()) {
      throw new IllegalStateException(
          "RECOMMENDATION_INTERNAL_API_KEY is required when recommendation indexing is enabled");
    }
    if (properties.getRecommendationServiceUrl() == null
        || properties.getRecommendationServiceUrl().isBlank()) {
      throw new IllegalStateException(
          "RECOMMENDATION_SERVICE_URL is required when recommendation indexing is enabled");
    }
  }
}
