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
import fu.tripsense.placeservice.dto.RecordKeySuccessRequest;
import fu.tripsense.placeservice.dto.RotateApiKeyRequest;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class InternalApiKeyPoolControllerTest {

  private MockMvc mockMvc;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Mock private ApiKeyPoolService apiKeyPoolService;

  @BeforeEach
  void setUp() {
    InternalApiKeyPoolController controller = new InternalApiKeyPoolController(apiKeyPoolService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void shouldReturnActiveRawKeyFromItem() throws Exception {
    ApiKeyPoolItem item =
        ApiKeyPoolItem.builder()
            .id("key-1")
            .provider(ApiKeyProvider.GEMINI)
            .rawKey("AIzaSyActiveRawKey")
            .keyHash("hash123")
            .maskedKey("AQ.Ab8...owhA")
            .status(ApiKeyStatus.ACTIVE)
            .build();

    when(apiKeyPoolService.getActiveKeyItem(ApiKeyProvider.GEMINI)).thenReturn(Optional.of(item));
    when(apiKeyPoolService.resolveRawKey(item)).thenReturn("AIzaSyActiveRawKey");

    mockMvc
        .perform(get("/api/places/internal/keys/active-raw?provider=GEMINI"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.provider").value("GEMINI"))
        .andExpect(jsonPath("$.data.key").value("AIzaSyActiveRawKey"))
        .andExpect(jsonPath("$.data.keyHash").value("hash123"))
        .andExpect(jsonPath("$.data.maskedKey").value("AQ.Ab8...owhA"))
        .andExpect(jsonPath("$.data.status").value("ACTIVE"));
  }

  @Test
  void shouldFallbackToStaticKeyWhenNoActiveItem() throws Exception {
    when(apiKeyPoolService.getActiveKeyItem(ApiKeyProvider.GEMINI)).thenReturn(Optional.empty());
    when(apiKeyPoolService.getActiveKey(ApiKeyProvider.GEMINI)).thenReturn("AIzaSyFallbackStaticKey");

    mockMvc
        .perform(get("/api/places/internal/keys/active-raw?provider=GEMINI"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.provider").value("GEMINI"))
        .andExpect(jsonPath("$.data.key").value("AIzaSyFallbackStaticKey"));
  }

  @Test
  void shouldRotateKeySuccessfully() throws Exception {
    ApiKeyPoolItem nextKey =
        ApiKeyPoolItem.builder()
            .id("key-2")
            .provider(ApiKeyProvider.GEMINI)
            .rawKey("AIzaSyNewActiveKey")
            .keyHash("hashNext")
            .maskedKey("AQ.Ab8...Walw")
            .status(ApiKeyStatus.ACTIVE)
            .build();

    when(apiKeyPoolService.markExhaustedAndRotate(
            eq(ApiKeyProvider.GEMINI),
            eq("AIzaSyFailedKey"),
            eq(ApiKeyStatus.EXHAUSTED),
            eq("Rate limit 429")))
        .thenReturn(Optional.of(nextKey));
    when(apiKeyPoolService.resolveRawKey(nextKey)).thenReturn("AIzaSyNewActiveKey");

    RotateApiKeyRequest request =
        new RotateApiKeyRequest(
            ApiKeyProvider.GEMINI, "AIzaSyFailedKey", ApiKeyStatus.EXHAUSTED, "Rate limit 429");

    mockMvc
        .perform(
            post("/api/places/internal/keys/rotate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.rotated").value(true))
        .andExpect(jsonPath("$.data.newActiveKey").value("AIzaSyNewActiveKey"))
        .andExpect(jsonPath("$.data.newMaskedKey").value("AQ.Ab8...Walw"));
  }

  @Test
  void shouldRecordSuccessSuccessfully() throws Exception {
    RecordKeySuccessRequest request =
        new RecordKeySuccessRequest(ApiKeyProvider.GEMINI, "AIzaSySuccessKey");

    mockMvc
        .perform(
            post("/api/places/internal/keys/record-success")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.recorded").value(true));

    verify(apiKeyPoolService).recordSuccess(ApiKeyProvider.GEMINI, "AIzaSySuccessKey");
  }
}
