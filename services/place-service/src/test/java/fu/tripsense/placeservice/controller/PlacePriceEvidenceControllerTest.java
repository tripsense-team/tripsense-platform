package fu.tripsense.placeservice.controller;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import fu.tripsense.placeservice.config.SecurityConfig;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.security.JwtAuthenticationFilter;
import fu.tripsense.placeservice.security.JwtService;
import fu.tripsense.placeservice.service.PlaceCacheService;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

class PlacePriceEvidenceControllerTest {
  private AnnotationConfigWebApplicationContext context;
  private MockMvc mvc;
  private MongoTemplate mongo;

  @BeforeEach void setUp() {
    context = new AnnotationConfigWebApplicationContext();
    context.setServletContext(new MockServletContext());
    context.register(Config.class); context.refresh();
    mongo = context.getBean(MongoTemplate.class);
    clearInvocations(mongo); // Ignore ApplicationContextAware initialization of the template mock.
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }
  @AfterEach void close() { context.close(); }

  @Test void rejectsUnauthenticatedAndNonAdminWrites() throws Exception {
    mvc.perform(delete("/api/places/admin/p1/price-evidence")).andExpect(status().isUnauthorized());
    mvc.perform(delete("/api/places/admin/p1/price-evidence").with(user("traveler").roles("USER")))
        .andExpect(status().isForbidden());
    verifyNoInteractions(mongo);
  }

  @Test void writesOnlyCuratedFieldsAndInvalidatesCache() throws Exception {
    when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Place.class)))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    mvc.perform(put("/api/places/admin/p1/price-evidence").with(user("admin").roles("ADMIN"))
        .contentType("application/json").content(body("120000", "https://example.org/tariff", "PER_PERSON_VISIT")))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.amountVnd").value(120000));
    var update = ArgumentCaptor.forClass(Update.class);
    verify(mongo).updateFirst(any(Query.class), update.capture(), eq(Place.class));
    assertThat(update.getValue().getUpdateObject().get("$set", org.bson.Document.class).keySet())
        .contains("priceEvidence", "priceEvidenceEditedBy")
        .doesNotContain("categories", "rating", "description");
    verify(context.getBean(PlaceCacheService.class)).invalidatePriceEvidence("p1");
  }

  @Test void invalidPriceIsRejectedAndMissingPlaceIs404() throws Exception {
    for (String body : java.util.List.of(body("1.5", "https://example.org/tariff", "PER_PERSON_VISIT"),
        body("100", "javascript:alert(1)", "PER_PERSON_VISIT"),
        body("100", "https://example.org/tariff", "PER_ROOM_NIGHT"))) {
      mvc.perform(put("/api/places/admin/p1/price-evidence").with(user("admin").roles("ADMIN"))
          .contentType("application/json").content(body)).andExpect(status().isBadRequest());
    }
    verifyNoInteractions(mongo);
    when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Place.class)))
        .thenReturn(UpdateResult.acknowledged(0, 0L, null));
    mvc.perform(delete("/api/places/admin/missing/price-evidence").with(user("admin").roles("ADMIN")))
        .andExpect(status().isNotFound());
  }

  private static String body(String amount, String url, String basis) {
    return "{\"amountVnd\":" + amount + ",\"basis\":\"" + basis + "\",\"sourceUrl\":\"" + url
        + "\",\"observedAt\":\"2026-01-01T00:00:00Z\"}";
  }

  @Configuration @EnableWebMvc
  @Import({SecurityConfig.class, PlacePriceEvidenceController.class, GlobalExceptionHandler.class})
  static class Config {
    @Bean MongoTemplate mongo() { return mock(MongoTemplate.class); }
    @Bean PlaceCacheService cache() { return mock(PlaceCacheService.class); }
    @Bean JwtAuthenticationFilter jwtFilter() { return new JwtAuthenticationFilter(mock(JwtService.class)); }
  }
}
