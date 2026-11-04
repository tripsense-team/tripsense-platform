package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Location;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.MutationRequest;
import fu.tripsense.placeservice.exception.PlaceActionException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@ExtendWith(MockitoExtension.class)
class AdminPlaceCatalogServiceTest {
  @Mock MongoTemplate mongo;
  @Mock PlaceRepository repository;
  @Mock PlaceCacheService cache;
  @Mock PlacePersistenceService persistence;
  @Mock RecommendationIndexerClient indexer;
  @Mock PlaceMediaStorage mediaStorage;
  AdminPlaceCatalogService service;

  @BeforeEach
  void setUp() {
    service = new AdminPlaceCatalogService(mongo, repository, cache, persistence, indexer, mediaStorage);
  }

  @Test
  void createsManualPlaceWithServerOwnedIdentityAndRevision() {
    when(repository.findByNormalizedName("cầu rồng")).thenReturn(List.of());
    when(repository.save(any(Place.class))).thenAnswer(invocation -> {
      Place place = invocation.getArgument(0);
      place.setId("place-1"); place.setVersion(0L);
      return place;
    });

    var result = service.create(validRequest(), "admin-1");

    assertThat(result.provider()).isEqualTo("MANUAL");
    assertThat(result.providerPlaceId()).startsWith("manual:");
    assertThat(result.managementSource()).isEqualTo("MANUAL");
    assertThat(result.version()).isZero();
    verify(cache).invalidatePlaceCatalog("place-1");
  }

  @Test
  void rejectsNonHttpsWebsiteBeforePersistence() {
    MutationRequest request = new MutationRequest("Cầu Rồng", "tourist_attraction",
        List.of("tourist_attraction"), new Location(16.0611, 108.2276), "Đà Nẵng", null,
        "Đà Nẵng", null, null, "http://unsafe.example", List.of(), null, "OPERATIONAL", null);
    assertThatThrownBy(() -> service.create(request, "admin-1"))
        .isInstanceOf(PlaceActionException.class).hasMessageContaining("HTTPS");
  }

  @Test
  void rejectsGenericTaxonomy() {
    MutationRequest request = new MutationRequest("Cầu Rồng", "point_of_interest",
        List.of("point_of_interest"), new Location(16.0611, 108.2276), "Đà Nẵng", null,
        "Đà Nẵng", null, null, null, List.of(), null, null, null);
    assertThatThrownBy(() -> service.create(request, "admin-1"))
        .isInstanceOf(PlaceActionException.class).hasMessageContaining("specific primary type");
  }

  @Test
  void updatesLegacyPlaceWithoutRequiringNewTaxonomyOrReplacingExistingWebsite() {
    Place existing = Place.builder().id("legacy-1").name("Han River Walk")
        .categories(List.of("địa điểm khám phá"))
        .location(new GeoJsonPoint(108.2276, 16.0611))
        .address("Đà Nẵng").city("Đà Nẵng")
        .website("http://legacy.example").version(4L).build();
    MutationRequest request = new MutationRequest("Han River Walk", null,
        List.of("địa điểm khám phá"), new Location(16.0611, 108.2276), "Đà Nẵng", null,
        "Đà Nẵng", null, null, "http://legacy.example", List.of(), null, null, "Mô tả mới");
    when(repository.findById("legacy-1")).thenReturn(Optional.of(existing));
    when(mongo.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class),
        eq(Place.class))).thenAnswer(invocation -> {
          Update update = invocation.getArgument(1);
          var fields = update.getUpdateObject().get("$set", org.bson.Document.class);
          assertThat(fields).containsEntry("description", "Mô tả mới");
          assertThat(fields.keySet()).doesNotContain("primaryType", "categories", "website",
              "oldAddress", "phone", "socials");
          assertThat(update.getUpdateObject().get("$addToSet").toString())
              .contains("description").doesNotContain("primaryType", "categories", "website");
          existing.setDescription("Mô tả mới");
          return existing;
        });

    assertThat(service.update("legacy-1", 4, request, "admin-1").description())
        .isEqualTo("Mô tả mới");
    verify(cache).invalidatePlaceCatalog("legacy-1");
  }

  @Test
  void mutationDtoRejectsUnknownMassAssignmentFields() {
    String json = """
        {"name":"Cầu Rồng","primaryType":"tourist_attraction",
         "categories":["tourist_attraction"],"location":{"lat":16.0611,"lng":108.2276},
         "address":"Đà Nẵng","city":"Đà Nẵng","provider":"FORGED"}
        """;
    assertThatThrownBy(() -> new ObjectMapper().readValue(json, MutationRequest.class))
        .hasRootCauseMessage("Unknown place field");
  }

  @Test
  void listUsesApprovedPrimaryMediaForCover() {
    Place place = Place.builder().id("place-1").name("Cầu Rồng").city("Đà Nẵng")
        .primaryMediaAssetId("primary").build();
    PlaceMediaAsset secondary = PlaceMediaAsset.builder().id("secondary").placeId("place-1")
        .storagePublicId("secondary-public").build();
    PlaceMediaAsset primary = PlaceMediaAsset.builder().id("primary").placeId("place-1")
        .storagePublicId("primary-public").build();
    when(mongo.find(any(Query.class), eq(Place.class))).thenReturn(List.of(place));
    when(mongo.find(any(Query.class), eq(PlaceMediaAsset.class)))
        .thenReturn(List.of(secondary, primary));
    when(mediaStorage.deliveryUrl("primary-public")).thenReturn("https://res.cloudinary.com/example/cover.jpg");

    var page = service.list(null, "ACTIVE", "ALL", null, null, null, 24);

    assertThat(page.items()).hasSize(1);
    assertThat(page.items().getFirst().coverPhotoUrl())
        .isEqualTo("https://res.cloudinary.com/example/cover.jpg");
  }

  private MutationRequest validRequest() {
    return new MutationRequest("Cầu Rồng", "tourist_attraction", List.of("tourist_attraction"),
        new Location(16.0611, 108.2276), "Đà Nẵng", null, "Đà Nẵng", null, null,
        "https://example.org", List.of(), null, "OPERATIONAL", null);
  }
}
