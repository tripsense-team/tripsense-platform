package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.*;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import java.time.Instant;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.*;

class CuratedPricePersistenceTest {
  @Test void providerRefreshDoesNotWriteCuratedFieldsEvenFromAnOutdatedSnapshot() {
    var repository = mock(PlaceRepository.class);
    var mongo = mock(MongoTemplate.class);
    var converter = mock(MongoConverter.class);
    when(mongo.getConverter()).thenReturn(converter);
    var price = new PriceEvidence(120000L, "PER_PERSON_VISIT", "https://example.org/tariff", Instant.now());
    var entity = Place.builder().id("p1").provider("ziomap").providerPlaceId("source1")
        .priceEvidence(price).build();
    when(repository.findByProviderAndProviderPlaceId("ziomap", "source1")).thenReturn(Optional.of(entity));
    doAnswer(call -> {
      Document document = call.getArgument(1);
      document.put("_id", "p1"); document.put("name", "Museum");
      document.put("priceEvidence", price); document.put("priceEvidenceEditedBy", "old-editor");
      return null;
    }).when(converter).write(any(Place.class), any(Document.class));
    when(mongo.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(Place.class)))
        .thenReturn(entity);
    var service = new PlacePersistenceServiceImpl(repository, new TripSensePlaceProperties(), mongo);
    var dto = service.upsertProviderPlace(PlaceDto.builder().providerPlaceId("source1").name("Museum").build(), "ziomap");
    assertThat(dto.getPriceEvidence()).isEqualTo(price);
    var update = ArgumentCaptor.forClass(Update.class);
    verify(mongo).findAndModify(any(Query.class), update.capture(), any(FindAndModifyOptions.class), eq(Place.class));
    assertThat(update.getValue().getUpdateObject().get("$set", Document.class).keySet())
        .contains("name").doesNotContain("_id", "priceEvidence", "priceEvidenceEditedAt", "priceEvidenceEditedBy");
    verify(repository, never()).save(any());
  }
}
