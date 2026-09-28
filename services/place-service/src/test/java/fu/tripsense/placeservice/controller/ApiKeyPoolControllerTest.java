package fu.tripsense.placeservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import fu.tripsense.placeservice.dto.AddApiKeysRequest;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ApiKeyPoolControllerTest {

  private MockMvc mockMvc;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Mock private ApiKeyPoolService apiKeyPoolService;

  @BeforeEach
  void setUp() {
    ApiKeyPoolController controller = new ApiKeyPoolController(apiKeyPoolService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void shouldListKeysForProvider() throws Exception {
    ApiKeyPoolItem item = ApiKeyPoolItem.builder()
        .id("key-1")
        .provider(ApiKeyProvider.ZIOMAP)
        .maskedKey("eyJ1c...hub")
        .status(ApiKeyStatus.ACTIVE)
        .build();

    when(apiKeyPoolService.listKeys(ApiKeyProvider.ZIOMAP)).thenReturn(List.of(item));

    mockMvc
        .perform(get("/api/places/internal/keys?provider=ZIOMAP"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].id").value("key-1"))
        .andExpect(jsonPath("$.data[0].maskedKey").value("eyJ1c...hub"))
        .andExpect(jsonPath("$.data[0].status").value("ACTIVE"));
  }

  @Test
  void shouldAddKeys() throws Exception {
    AddApiKeysRequest request = new AddApiKeysRequest(ApiKeyProvider.ZIOMAP, List.of("key-abc-123"));
    ApiKeyPoolItem savedItem = ApiKeyPoolItem.builder()
        .id("key-2")
        .provider(ApiKeyProvider.ZIOMAP)
        .maskedKey("key-ab...-123")
        .status(ApiKeyStatus.ACTIVE)
        .build();

    when(apiKeyPoolService.addKeys(eq(ApiKeyProvider.ZIOMAP), any())).thenReturn(List.of(savedItem));

    mockMvc
        .perform(
            post("/api/places/internal/keys")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].id").value("key-2"));
  }

  @Test
  void shouldResetQuota() throws Exception {
    when(apiKeyPoolService.resetQuotaAll(ApiKeyProvider.ZIOMAP)).thenReturn(3);

    mockMvc
        .perform(post("/api/places/internal/keys/reset-quota?provider=ZIOMAP"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.resetCount").value(3));
  }
}
