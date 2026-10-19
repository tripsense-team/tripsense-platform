package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import java.util.*;
import org.junit.jupiter.api.Test;

class PlacePrimaryTypeTest {
  private final PlaceRepository repository = mock(PlaceRepository.class);
  private final PlacePersistenceServiceImpl service =
      new PlacePersistenceServiceImpl(repository, new TripSensePlaceProperties());

  @Test
  void searchSaveNormalizesAndRoundTripsExplicitPrimary() {
    when(repository.save(any()))
        .thenAnswer(
            i -> {
              Place p = i.getArgument(0);
              p.setId("canonical");
              return p;
            });
    var dto =
        PlaceDto.builder()
            .providerPlaceId("provider")
            .name("Cafe")
            .categories(List.of("food", "cafe"))
            .primaryType(" COFFEE_SHOP ")
            .build();
    var result = service.upsertProviderPlace(dto, "ziomap");
    assertThat(result.getId()).isEqualTo("canonical");
    assertThat(result.getPrimaryType()).isEqualTo("coffee_shop");
    assertThat(result.getCategories()).containsExactly("food", "cafe");
  }

  @Test
  void missingBlankOrInvalidDetailsNeverEraseStoredPrimaryAndStillUpdateTypes() {
    when(repository.save(any())).thenAnswer(i -> i.getArgument(0));
    for (String incoming : Arrays.asList(null, "", "  ", "bad type", "x".repeat(81))) {
      var place =
          Place.builder()
              .id("canonical")
              .primaryType("coffee_shop")
              .categories(List.of("coffee_shop"))
              .build();
      var result =
          service.enrichExistingPlace(
              place,
              PlaceDto.builder()
                  .primaryType(incoming)
                  .categories(List.of("cafe", "food", "store"))
                  .build());
      assertThat(result.getPrimaryType()).isEqualTo("coffee_shop");
      assertThat(place.getPrimaryType()).isEqualTo("coffee_shop");
      assertThat(result.getCategories()).containsExactly("cafe", "food", "store");
    }
  }

  @Test
  void missingPrimaryDuringSearchUpsertAlsoPreservesExistingValue() {
    var place = Place.builder().id("canonical").primaryType("museum").build();
    when(repository.findByProviderAndProviderPlaceId(anyString(), anyString()))
        .thenReturn(Optional.of(place));
    when(repository.save(any())).thenAnswer(i -> i.getArgument(0));
    var result =
        service.upsertProviderPlace(
            PlaceDto.builder()
                .providerPlaceId("provider")
                .categories(List.of("museum", "cafe"))
                .build(),
            "ziomap");
    assertThat(result.getPrimaryType()).isEqualTo("museum");
  }

  @Test
  void legacyCategoryOrderIsNotFabricatedAsPrimary() {
    var place = Place.builder().id("legacy").categories(List.of("cafe", "food")).build();
    assertThat(service.toDto(place).getPrimaryType()).isNull();
  }
}
