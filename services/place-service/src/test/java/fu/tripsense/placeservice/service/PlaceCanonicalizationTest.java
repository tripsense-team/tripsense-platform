package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PlaceCanonicalizationTest {
    @Test
    void derivesMissingAdministrativeAreasFromExactProviderAddressSegments() {
        PlaceRepository repository = mock(PlaceRepository.class);
        PlacePersistenceServiceImpl service =
                new PlacePersistenceServiceImpl(repository, new TripSensePlaceProperties());
        Place stored = Place.builder()
                .id("cafe-1")
                .provider("ziomap")
                .providerPlaceId("cafe-1")
                .name("Gé Cafe")
                .address("66 Đỗ Quang, Thanh Khê, Đà Nẵng 550000")
                .build();

        PlaceDto result = service.toDto(stored);

        assertThat(result.getDistrict()).isEqualTo("Thanh Khê");
        assertThat(result.getCity()).isEqualTo("Đà Nẵng");
    }

    @Test
    void sharesCanonicalIdOnlyForUnambiguousNearbyNameAndAddress() {
        PlaceRepository repository = mock(PlaceRepository.class);
        TripSensePlaceProperties properties = new TripSensePlaceProperties();
        PlacePersistenceServiceImpl service = new PlacePersistenceServiceImpl(repository, properties);
        Place existing = Place.builder().id("canonical-1").provider("first")
                .providerPlaceId("first-1").name("Old Town").normalizedName("old town")
                .address("1 River St").location(new GeoJsonPoint(108.33, 15.88)).build();
        when(repository.findByProviderAndProviderPlaceId("second", "second-2"))
                .thenReturn(Optional.empty());
        when(repository.findByNormalizedName("old town")).thenReturn(List.of(existing));
        PlaceDto incoming = PlaceDto.builder().provider("second").providerPlaceId("second-2")
                .name("Old Town").address("1 River St")
                .location(LocationDto.builder().lat(15.8802).lng(108.3302).build()).build();

        assertThat(service.upsertProviderPlace(incoming, "second").getId()).isEqualTo("canonical-1");
        verify(repository, never()).save(any());

        incoming.setLocation(LocationDto.builder().lat(15.9).lng(108.35).build());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(service.upsertProviderPlace(incoming, "second").getId()).isNull();
        verify(repository).save(any());
    }
}
