package fu.tripsense.placeservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob.Status;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class PlaceRecommendationIndexQueueTest {
  private static final Instant NOW = Instant.parse("2026-11-12T00:00:00Z");

  @Test
  void completionOnlyRemovesTheClaimedRevisionAndLease() {
    MongoTemplate mongo = mock(MongoTemplate.class);
    PlaceRecommendationIndexQueue queue = queue(mongo, 8);
    PlaceRecommendationIndexJob job = claimedJob(12L, "lease-12", 0);

    queue.complete(job);

    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    verify(mongo).remove(query.capture(), eq(PlaceRecommendationIndexJob.class));
    Document criteria = query.getValue().getQueryObject();
    assertEquals("place-1", criteria.getString("_id"));
    assertEquals(12L, ((Number) criteria.get("desiredVersion")).longValue());
    assertEquals("lease-12", criteria.getString("leaseToken"));
  }

  @Test
  void retryUsesSafeCodeAndReturnsJobToPending() {
    MongoTemplate mongo = mock(MongoTemplate.class);
    PlaceRecommendationIndexQueue queue = queue(mongo, 8);

    queue.fail(claimedJob(3L, "lease-3", 0), "raw downstream error: token=secret", false);

    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    verify(mongo)
        .updateFirst(
            query.capture(), update.capture(), eq(PlaceRecommendationIndexJob.class));
    Document values = update.getValue().getUpdateObject();
    Document set = values.get("$set", Document.class);
    Document unset = values.get("$unset", Document.class);
    assertEquals(Status.PENDING.name(), String.valueOf(set.get("status")));
    assertEquals(1, ((Number) set.get("attempts")).intValue());
    assertTrue(String.valueOf(set.get("lastErrorCode")).matches("[A-Z0-9_]+"));
    assertFalse(String.valueOf(set.get("lastErrorCode")).contains("="));
    assertTrue(set.containsKey("nextAttemptAt"));
    assertTrue(unset.containsKey("leaseToken"));
    assertTrue(unset.containsKey("leaseUntil"));
  }

  @Test
  void retryMovesJobToDeadLetterAtAttemptLimit() {
    MongoTemplate mongo = mock(MongoTemplate.class);
    PlaceRecommendationIndexQueue queue = queue(mongo, 2);

    queue.fail(claimedJob(4L, "lease-4", 1), "INDEX_UNAVAILABLE", false);

    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    verify(mongo)
        .updateFirst(
            org.mockito.ArgumentMatchers.any(Query.class),
            update.capture(),
            eq(PlaceRecommendationIndexJob.class));
    Document set = update.getValue().getUpdateObject().get("$set", Document.class);
    assertEquals(Status.DEAD_LETTER.name(), String.valueOf(set.get("status")));
    assertFalse(set.containsKey("nextAttemptAt"));
  }

  private PlaceRecommendationIndexQueue queue(MongoTemplate mongo, int maxAttempts) {
    var settings = new TripSensePlaceProperties.RecommendationIndexingProperties();
    settings.setEnabled(true);
    settings.setMaxAttempts(maxAttempts);
    return new PlaceRecommendationIndexQueue(
        mongo, settings, Clock.fixed(NOW, ZoneOffset.UTC));
  }

  private PlaceRecommendationIndexJob claimedJob(long version, String lease, int attempts) {
    return PlaceRecommendationIndexJob.builder()
        .placeId("place-1")
        .desiredVersion(version)
        .status(Status.IN_PROGRESS)
        .leaseToken(lease)
        .attempts(attempts)
        .build();
  }
}
