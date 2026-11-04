package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.providers.mapvina.config.MapVinaProperties;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AdminPlaceReverseGeocodeServiceTest {
  private final ApiKeyPoolService keyPool = mock(ApiKeyPoolService.class);
  private final MapVinaProperties properties = new MapVinaProperties();
  private AdminPlaceReverseGeocodeService service;
  private MockRestServiceServer server;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder().baseUrl("https://maps.mapvina.com");
    server = MockRestServiceServer.bindTo(builder).build();
    service = new AdminPlaceReverseGeocodeService(builder.build(), keyPool, properties);
    when(keyPool.getActiveKey(ApiKeyProvider.MAPVINA)).thenReturn("server-key");
  }

  @Test
  void returnsNearestStreetAddressWithinOneHundredMeters() {
    server.expect(requestTo(org.hamcrest.Matchers.containsString("/api/v2/geocode/json")))
        .andExpect(queryParam("result_type", "street_address"))
        .andExpect(queryParam("radius", "100"))
        .andRespond(withSuccess("""
            {"status":"OK","results":[
              {"formatted_address":"Near road, Da Nang","types":["street_address"],"geometry":{"location":{"lat":16.0502,"lng":108.2}}},
              {"formatted_address":"Far road, Da Nang","types":["street_address"],"geometry":{"location":{"lat":16.06,"lng":108.2}}}
            ]}
            """, MediaType.APPLICATION_JSON));
    var result = service.lookup(16.05, 108.2);
    assertThat(result.matched()).isTrue();
    assertThat(result.address()).isEqualTo("Near road, Da Nang");
    assertThat(result.distanceMeters()).isLessThan(100);
    server.verify();
  }

  @Test
  void doesNotUseDistantOrPoiAddress() {
    server.expect(requestTo(org.hamcrest.Matchers.anything())).andRespond(withSuccess("""
        {"status":"OK","results":[
          {"formatted_address":"Nearby cafe","types":["cafe"],"geometry":{"location":{"lat":16.05,"lng":108.2}}},
          {"formatted_address":"Far road","types":["street_address"],"geometry":{"location":{"lat":16.06,"lng":108.2}}}
        ]}
        """, MediaType.APPLICATION_JSON));
    assertThat(service.lookup(16.05, 108.2).matched()).isFalse();
  }

  @Test
  void doesNotUsePartialStreetAddress() {
    server.expect(requestTo(org.hamcrest.Matchers.anything())).andRespond(withSuccess("""
        {"status":"OK","results":[
          {"formatted_address":"Approximate road","partial_match":true,"types":["street_address"],"geometry":{"location":{"lat":16.05,"lng":108.2}}}
        ]}
        """, MediaType.APPLICATION_JSON));
    assertThat(service.lookup(16.05, 108.2).matched()).isFalse();
  }

  @Test
  void usesServerEnvironmentKeyWhenPoolIsEmpty() {
    when(keyPool.getActiveKey(ApiKeyProvider.MAPVINA)).thenReturn(null);
    when(keyPool.listKeys(ApiKeyProvider.MAPVINA)).thenReturn(List.of());
    properties.setApiKey("environment-key");
    server.expect(requestTo(org.hamcrest.Matchers.anything()))
        .andExpect(queryParam("key", "environment-key"))
        .andRespond(withSuccess("{\"status\":\"ZERO_RESULTS\",\"results\":[]}", MediaType.APPLICATION_JSON));
    assertThat(service.lookup(16.05, 108.2).matched()).isFalse();
    server.verify();
  }

  @Test
  void zeroResultsIsNotAnError() {
    server.expect(requestTo(org.hamcrest.Matchers.anything()))
        .andRespond(withSuccess("{\"status\":\"ZERO_RESULTS\",\"results\":[]}", MediaType.APPLICATION_JSON));
    assertThat(service.lookup(16.05, 108.2).matched()).isFalse();
  }

  @Test
  void failsClosedWithoutKeyAndRejectsInvalidCoordinates() {
    assertThatThrownBy(() -> service.lookup(Double.NaN, 108.2)).isInstanceOf(PlaceActionException.class);
    when(keyPool.getActiveKey(ApiKeyProvider.MAPVINA)).thenReturn(null);
    when(keyPool.listKeys(ApiKeyProvider.MAPVINA)).thenReturn(List.of());
    assertThatThrownBy(() -> service.lookup(16.05, 108.2)).isInstanceOf(PlaceActionException.class)
        .hasMessageContaining("Address lookup unavailable");
  }

  @Test
  void providerFailureHasSafeMessage() {
    server.expect(requestTo(org.hamcrest.Matchers.anything())).andRespond(withServerError());
    assertThatThrownBy(() -> service.lookup(16.05, 108.2)).isInstanceOf(PlaceActionException.class)
        .hasMessageContaining("Address lookup unavailable");
  }
}
