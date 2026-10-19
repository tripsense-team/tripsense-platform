package fu.tripsense.recommendation.api;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.recommendation.application.*;
import fu.tripsense.recommendation.domain.*;
import fu.tripsense.recommendation.security.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SectionFeedControllerTest {
  private final SectionFeedService service = mock(SectionFeedService.class);
  private final CurrentUserProvider identity = mock(CurrentUserProvider.class);
  private MockMvc mvc;

  @BeforeEach
  void setup() {
    mvc =
        MockMvcBuilders.standaloneSetup(new SectionFeedController(service, identity))
            .setControllerAdvice(new RecommendationExceptionHandler())
            .build();
    when(identity.user()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), "USER"));
    var recommendation =
        new RecommendationResult(
            UUID.randomUUID(),
            UUID.randomUUID(),
            List.of(),
            new AlgorithmVersions("r", "f", "e", "x", "s", "d"),
            List.of(),
            16,
            List.of(),
            0,
            Map.of());
    when(service.recommend(any(), any(), any()))
        .thenReturn(
            new SectionFeedResult(
                null,
                Instant.now().plusSeconds(300),
                false,
                false,
                "danang",
                "GENERIC_DESTINATION",
                new ExploreRecommendationResult.Personalization(true, false, 0),
                false,
                recommendation,
                List.of()));
  }

  @Test
  void validPreviewIsAdditiveAndUsesTrustedIdentity() throws Exception {
    mvc.perform(
            post("/api/recommendations/explore-for-you/sections")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"destinationId\":\"danang\",\"limit\":4}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.requestedCount").value(16));
    verify(service)
        .recommend(
            eq(identity.user()),
            isNull(),
            argThat(r -> r.section() == null && r.effectiveLimit() == 4));
  }

  @Test
  void invalidCategoryAndPreviewLimitAreSafeBadRequests() throws Exception {
    for (String body :
        List.of(
            "{\"destinationId\":\"danang\",\"limit\":5}",
            "{\"destinationId\":\"danang\",\"section\":\"SQL_PRIVATE\"}",
            "{\"destinationId\":\"danang\",\"seedId\":\"not-a-uuid\"}"))
      mvc.perform(
              post("/api/recommendations/explore-for-you/sections")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.error.code").value("INVALID_RECOMMENDATION_REQUEST"));
    verifyNoInteractions(service);
  }

  @Test
  void authenticationIsNotBypassedByNewController() throws Exception {
    when(identity.user()).thenThrow(new UnauthenticatedException());
    mvc.perform(
            post("/api/recommendations/explore-for-you/sections")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"destinationId\":\"danang\",\"limit\":4}"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(service);
  }
}
