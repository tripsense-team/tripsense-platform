package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.model.PlaceRecommendationIndexJob.Operation;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PlaceRecommendationIndexReconciler {
  private static final int PAGE_SIZE = 100;

  private final PlaceRepository places;
  private final PlaceRecommendationIndexQueue queue;
  private final AtomicInteger nextPage = new AtomicInteger();

  public PlaceRecommendationIndexReconciler(
      PlaceRepository places, PlaceRecommendationIndexQueue queue) {
    this.places = places;
    this.queue = queue;
  }

  @Scheduled(
      initialDelayString =
          "${tripsense.places.recommendation-indexing.reconciliation-delay-ms:21600000}",
      fixedDelayString =
          "${tripsense.places.recommendation-indexing.reconciliation-delay-ms:21600000}")
  public void reconcileNextPage() {
    if (!queue.enabled()) return;
    int pageNumber = nextPage.get();
    var page =
        places.findAll(
            PageRequest.of(
                pageNumber,
                PAGE_SIZE,
                Sort.by(Sort.Order.asc("updatedAt"), Sort.Order.asc("_id"))));
    page.forEach(
        place ->
            queue.enqueue(
                place,
                place.getLifecycleStatus() == PlaceLifecycleStatus.ARCHIVED
                    ? Operation.DELETE
                    : Operation.UPSERT));
    nextPage.set(page.hasNext() ? pageNumber + 1 : 0);
  }
}
