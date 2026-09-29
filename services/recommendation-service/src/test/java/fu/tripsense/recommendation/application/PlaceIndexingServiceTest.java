package fu.tripsense.recommendation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.port.PlaceIndexer;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceIndexingServiceTest {

  @Test
  @DisplayName("Should skip when indexer is not present (semantic disabled)")
  void shouldSkipWhenIndexerNotPresent() {
    PlaceIndexingService service = new PlaceIndexingService(Optional.empty());

    PlaceSnapshot place = samplePlace("p1");
    var outcome = service.indexPlaces(List.of(place));

    assertEquals(1, outcome.submitted());
    assertEquals(0, outcome.indexed());
    assertEquals(1, outcome.skipped());
  }

  @Test
  @DisplayName("Should index place when changed")
  void shouldIndexPlaceWhenChanged() {
    PlaceIndexer mockIndexer = mock(PlaceIndexer.class);
    when(mockIndexer.indexIfChanged(any())).thenReturn(true);

    PlaceIndexingService service = new PlaceIndexingService(Optional.of(mockIndexer));
    PlaceSnapshot place = samplePlace("p1");

    var outcome = service.indexPlaces(List.of(place));

    assertEquals(1, outcome.submitted());
    assertEquals(1, outcome.indexed());
    assertEquals(0, outcome.skipped());
    verify(mockIndexer).indexIfChanged(place);
  }

  @Test
  @DisplayName("Should count as skipped when place is unchanged")
  void shouldSkipWhenPlaceUnchanged() {
    PlaceIndexer mockIndexer = mock(PlaceIndexer.class);
    when(mockIndexer.indexIfChanged(any())).thenReturn(false);

    PlaceIndexingService service = new PlaceIndexingService(Optional.of(mockIndexer));
    PlaceSnapshot place = samplePlace("p1");

    var outcome = service.indexPlaces(List.of(place));

    assertEquals(1, outcome.submitted());
    assertEquals(0, outcome.indexed());
    assertEquals(1, outcome.skipped());
    verify(mockIndexer).indexIfChanged(place);
  }

  @Test
  @DisplayName("Should handle exception gracefully and count as skipped")
  void shouldHandleExceptionGracefully() {
    PlaceIndexer mockIndexer = mock(PlaceIndexer.class);
    when(mockIndexer.indexIfChanged(any())).thenThrow(new RuntimeException("Qdrant unavailable"));

    PlaceIndexingService service = new PlaceIndexingService(Optional.of(mockIndexer));
    PlaceSnapshot place = samplePlace("p1");

    var outcome = service.indexPlaces(List.of(place));

    assertEquals(1, outcome.submitted());
    assertEquals(0, outcome.indexed());
    assertEquals(1, outcome.skipped());
  }

  @Test
  @DisplayName("Should handle empty or null list")
  void shouldHandleEmptyOrNullList() {
    PlaceIndexer mockIndexer = mock(PlaceIndexer.class);
    PlaceIndexingService service = new PlaceIndexingService(Optional.of(mockIndexer));

    assertEquals(0, service.indexPlaces(null).submitted());
    assertEquals(0, service.indexPlaces(List.of()).submitted());
    verify(mockIndexer, never()).indexIfChanged(any());
  }

  private PlaceSnapshot samplePlace(String id) {
    return new PlaceSnapshot(
        id,
        "ZIOMAP",
        "provider-1",
        "Cà Phê Muối",
        new GeoPoint(16.0544, 108.2022),
        "123 Nguyen Van Linh",
        "Da Nang",
        "Hai Chau",
        List.of("cafe"),
        4.5,
        100,
        List.of(),
        "08:00 - 22:00",
        "OPERATIONAL",
        "Quán cà phê ngon",
        Instant.now(),
        "LIVE");
  }
}
