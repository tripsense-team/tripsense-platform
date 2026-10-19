package fu.tripsense.placeservice.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.placeservice.service.PlaceCategoryBatchService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PlaceCategoryBatchControllerTest {
  private final PlaceCategoryBatchService service = mock(PlaceCategoryBatchService.class);
  private MockMvc mvc;

  private String request(String categories, int limit, boolean refresh) {
    return "{\"lat\":16.0544,\"lng\":108.2022,\"radiusMeters\":35000,\"categories\":"
        + categories
        + ",\"targetPerCategory\":"
        + limit
        + ",\"allowExternalRefresh\":"
        + refresh
        + "}";
  }

  @BeforeEach
  void setup() {
    mvc =
        MockMvcBuilders.standaloneSetup(new PlaceCategoryBatchController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    when(service.retrieve(any())).thenReturn(new PlaceCategoryBatchService.Batch(List.of()));
  }

  @Test
  void supportsLocalOnlyBatch() throws Exception {
    mvc.perform(
            post("/api/places/recommendations/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request("[\"CAFE\",\"HOMESTAY\"]", 12, false)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));
    verify(service)
        .retrieve(
            argThat(
                r ->
                    Boolean.FALSE.equals(r.allowExternalRefresh()) && r.targetPerCategory() == 12));
  }

  @Test
  void disallowsProviderDuplicateUnknownCategoriesAndHugeLimits() throws Exception {
    for (String body :
        List.of(
            request("[\"CAFE\"]", 12, true),
            request("[\"CAFE\",\"CAFE\"]", 12, false),
            request("[\"CAFE\"]", 51, false),
            request("[\"PRIVATE_SQL\"]", 12, false)))
      mvc.perform(
              post("/api/places/recommendations/categories")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
    verifyNoInteractions(service);
  }
}
