package fu.tripsense.placeservice.providers.ziomap;

import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ZioMapProviderTest {

  private ZioMapProvider provider;

  @BeforeEach
  void setUp() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    provider = new ZioMapProvider(props, RestClient.builder().baseUrl(props.getBaseUrl()).build());
  }

  @Test
  void shouldReturnEmptyListWhenSearchQueryIsBlank() {
    List<PlaceDto> results = provider.textSearch("", null, null, null, 10);
    assertNotNull(results);
    assertTrue(results.isEmpty());
  }

  @Test
  void shouldReturnEmptyListWhenAutocompleteQueryIsBlank() {
    List<AutocompleteSuggestionDto> results = provider.autocomplete("   ", null, null, null, 5);
    assertNotNull(results);
    assertTrue(results.isEmpty());
  }

  @Test
  void shouldReturnCorrectProviderName() {
    assertEquals("ziomap", provider.getProviderName());
  }

  @Test
  void doesNotCallPaidPhotoEndpointsWithoutDisplayApproval() {
    assertTrue(provider.getPrimaryPhoto("provider-1").isEmpty());
  }

  @Test
  void textSearchMapsStructuredVietnameseAdministrativeAreas() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    RestClient.Builder builder = RestClient.builder().baseUrl(props.getBaseUrl());
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    provider = new ZioMapProvider(props, builder.build());
    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/place/text-search")))
        .andRespond(
            withSuccess(
                "{\"places\":[{\"id\":\"cafe-1\",\"displayName\":{\"text\":\"Gé Cafe\"},"
                    + "\"formattedAddress\":\"66 Đỗ Quang, Thanh Khê, Đà Nẵng 550000\","
                    + "\"addressComponents\":["
                    + "{\"longText\":\"Quận Thanh Khê\",\"types\":[\"administrative_area_level_2\"]},"
                    + "{\"longText\":\"Thành phố Đà Nẵng\",\"types\":[\"administrative_area_level_1\"]}]}]}",
                MediaType.APPLICATION_JSON));

    PlaceDto place = provider.textSearch("cafe Thanh Khê", 16.05, 108.20, 5000, 5).get(0);

    assertEquals("Thanh Khê", place.getDistrict());
    assertEquals("Đà Nẵng", place.getCity());
    server.verify();
  }

  @Test
  void textSearchUsesExactAddressSegmentsWhenStructuredAreasAreUnavailable() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    RestClient.Builder builder = RestClient.builder().baseUrl(props.getBaseUrl());
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    provider = new ZioMapProvider(props, builder.build());
    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/place/text-search")))
        .andRespond(
            withSuccess(
                "{\"places\":[{\"id\":\"cafe-2\",\"displayName\":{\"text\":\"Cafe 35\"},"
                    + "\"formattedAddress\":\"35 Hoàng Hoa Thám, Thanh Khê, Đà Nẵng 550000\"}]}",
                MediaType.APPLICATION_JSON));

    PlaceDto place = provider.textSearch("cafe Thanh Khê", 16.05, 108.20, 5000, 5).get(0);

    assertEquals("Thanh Khê", place.getDistrict());
    assertEquals("Đà Nẵng", place.getCity());
    server.verify();
  }

  @Test
  void resolvesOneAttributedPhotoWhenExplicitlyEnabled() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    props.setPhotoDisplayApproved(true);
    RestClient.Builder builder = RestClient.builder().baseUrl(props.getBaseUrl());
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    provider = new ZioMapProvider(props, builder.build());
    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/v1/places/provider-1")))
        .andRespond(
            withSuccess(
                "{\"photos\":[{\"name\":\"places/provider-1/photos/photo-1\",\"authorAttributions\":[{\"displayName\":\"Photo"
                    + " author\",\"uri\":\"https://ziomap-api.socibi.com/author\"}]}]}",
                MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/place/photos")))
        .andRespond(
            withSuccess(
                "{\"name\":\"places/provider-1/photos/photo-1\",\"photoUri\":\"https://lh3.googleusercontent.com/photo-1\"}",
                MediaType.APPLICATION_JSON));

    var photo = provider.getPrimaryPhoto("provider-1").orElseThrow();
    assertEquals("https://lh3.googleusercontent.com/photo-1", photo.url());
    assertEquals("Photo author", photo.attribution().get(0).displayName());
    server.verify();
  }

  @Test
  void galleryResolvesAtMostFiveImagesForTheSamePlace() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    props.setPhotoDisplayApproved(true);
    RestClient.Builder builder = RestClient.builder().baseUrl(props.getBaseUrl());
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    provider = new ZioMapProvider(props, builder.build());
    StringBuilder photos = new StringBuilder();
    for (int index = 1; index <= 7; index++) {
      if (index > 1) photos.append(',');
      photos.append("{\"name\":\"places/provider-1/photos/photo-").append(index).append("\"}");
    }
    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/v1/places/provider-1")))
        .andRespond(withSuccess("{\"photos\":[" + photos + "]}", MediaType.APPLICATION_JSON));
    for (int index = 1; index <= 5; index++) {
      server
          .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/place/photos")))
          .andRespond(
              withSuccess(
                  "{\"photoUri\":\"https://lh3.googleusercontent.com/photo-" + index + "\"}",
                  MediaType.APPLICATION_JSON));
    }

    var gallery = provider.getPhotoGallery("provider-1", 5);

    assertEquals(5, gallery.size());
    assertEquals("https://lh3.googleusercontent.com/photo-1", gallery.get(0).url());
    server.verify();
  }

  @Test
  void getPlaceDetailsParsesDetailsSuccessfully() {
    ZioMapProperties props = new ZioMapProperties();
    props.setBaseUrl("https://ziomap-api.socibi.com");
    props.setApiKey("test-key");
    RestClient.Builder builder = RestClient.builder().baseUrl(props.getBaseUrl());
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    provider = new ZioMapProvider(props, builder.build());

    String mockJson =
        "{"
            + "\"place_id\":\"ChIJcf3AFV8bQjERfAAOOHRbWu4\","
            + "\"name\":\"DỊCH VỤ VẬN CHUYỂN\","
            + "\"formatted_address\":\"11 Phú Lộc 5, Đà Nẵng\","
            + "\"rating\":3.4,"
            + "\"user_ratings_total\":5,"
            + "\"reviews\":[{"
            + "\"author_name\":\"Doanh Nghiệp\","
            + "\"profile_photo_url\":\"https://lh3.googleusercontent.com/test\","
            + "\"rating\":5,"
            + "\"relative_time_description\":\"3 năm trước\","
            + "\"text\":\"DỊCH VỤ TỐT\","
            + "\"time\":1666666283"
            + "}]"
            + "}";

    server
        .expect(requestTo(startsWith("https://ziomap-api.socibi.com/api/place/details")))
        .andRespond(withSuccess(mockJson, MediaType.APPLICATION_JSON));

    var result = provider.getPlaceDetails("ChIJcf3AFV8bQjERfAAOOHRbWu4");
    assertTrue(result.isPresent());
    PlaceDto dto = result.get();
    assertEquals("ChIJcf3AFV8bQjERfAAOOHRbWu4", dto.getProviderPlaceId());
    assertEquals(3.4, dto.getRating());
    assertEquals(5, dto.getUserRatingCount());
    assertEquals(1, dto.getReviews().size());
    assertEquals("Doanh Nghiệp", dto.getReviews().get(0).getAuthorName());
    server.verify();
  }
}
