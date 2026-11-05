package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PlaceProviderManualOverrideTest {
  @Test
  void providerRefreshPreservesAdminFieldsButRefreshesProviderEvidence() {
    PlacePersistenceServiceImpl persistence = new PlacePersistenceServiceImpl(
        mock(PlaceRepository.class), new TripSensePlaceProperties());
    Place place = Place.builder().name("Tên quản trị").address("Địa chỉ quản trị")
        .manualOverrideFields(Set.of("name", "address")).build();
    PlaceDto provider = PlaceDto.builder().name("Provider name").address("Provider address")
        .rating(4.8).userRatingCount(120).build();

    ReflectionTestUtils.invokeMethod(persistence, "applyProviderData", place, provider);

    assertThat(place.getName()).isEqualTo("Tên quản trị");
    assertThat(place.getAddress()).isEqualTo("Địa chỉ quản trị");
    assertThat(place.getRating()).isEqualTo(4.8);
    assertThat(place.getUserRatingCount()).isEqualTo(120);
  }
}
