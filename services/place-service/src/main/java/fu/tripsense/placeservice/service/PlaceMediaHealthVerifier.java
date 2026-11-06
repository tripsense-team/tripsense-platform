package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import fu.tripsense.placeservice.domain.repository.PlaceMediaAssetRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
    name = "tripsense.places.media.health-check-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class PlaceMediaHealthVerifier {
  private final PlaceMediaAssetRepository assets;
  private final PlaceMediaStorage storage;
  private final MongoTemplate mongo;

  public PlaceMediaHealthVerifier(
      PlaceMediaAssetRepository assets, PlaceMediaStorage storage, MongoTemplate mongo) {
    this.assets = assets;
    this.storage = storage;
    this.mongo = mongo;
  }

  @Scheduled(
      initialDelayString = "${tripsense.places.media.health-check-initial-delay-ms:120000}",
      fixedDelayString = "${tripsense.places.media.health-check-delay-ms:3600000}")
  public void verify() {
    if (!storage.configured()) return;
    int pageNumber = 0;
    Page<PlaceMediaAsset> page;
    do {
      page =
          assets.findByHealthStatusInAndDeletedAtIsNull(
              List.of(
                  PlaceMediaAsset.HealthStatus.HEALTHY,
                  PlaceMediaAsset.HealthStatus.DEGRADED),
              PageRequest.of(pageNumber++, 200));
      page.stream()
          .filter(asset -> asset.getModerationStatus() == PlaceMediaAsset.ModerationStatus.APPROVED)
          .forEach(this::verifyAsset);
    } while (page.hasNext());
  }

  private void verifyAsset(PlaceMediaAsset asset) {
    boolean healthy = storage.healthy(asset.getStoragePublicId());
    PlaceMediaAsset.HealthStatus next =
        healthy
            ? PlaceMediaAsset.HealthStatus.HEALTHY
            : PlaceMediaAsset.HealthStatus.DEGRADED;
    if (next != asset.getHealthStatus()) {
      asset.setHealthStatus(next);
      asset.setVerifiedAt(Instant.now());
      assets.save(asset);
    }
    Query primary =
        Query.query(
            Criteria.where("_id")
                .is(asset.getPlaceId())
                .and("primaryMediaAssetId")
                .is(asset.getId()));
    mongo.updateFirst(
        primary,
        new Update()
            .set("mediaState", healthy ? PlaceMediaState.READY : PlaceMediaState.DEGRADED)
            .set("mediaStateReason", healthy ? null : "DELIVERY_FAILED")
            .set("mediaLastVerifiedAt", Instant.now()),
        Place.class);
  }
}
