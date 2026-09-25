package fu.tripsense.socialservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.socialservice.dto.response.SuggestedCreatorResponse;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialCreatorService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class SocialCreatorControllerTest {

  private MockMvc mockMvc;

  @Mock private SocialCreatorService creatorService;
  @Mock private CurrentUserProvider currentUserProvider;

  @InjectMocks private SocialCreatorController controller;

  private final UUID creatorId = UUID.randomUUID();
  private final UUID currentUserId = UUID.randomUUID();
  private final AuthenticatedUser currentUser =
      new AuthenticatedUser(currentUserId, "user@tripsense.app", "ROLE_USER");

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void getSuggestedCreators_withDefaultLimit_returnsSuccess() throws Exception {
    when(currentUserProvider.optionalUser()).thenReturn(Optional.of(currentUser));

    SuggestedCreatorResponse item =
        new SuggestedCreatorResponse(
            creatorId,
            "John Wanderer",
            "https://img.com/avatar.jpg",
            "Trekking & Camping",
            "nicheTrekking",
            120L,
            false,
            5);

    when(creatorService.getSuggestedCreators(eq(currentUser), eq(4))).thenReturn(List.of(item));

    mockMvc
        .perform(get("/api/social/creators/suggested").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].id").value(creatorId.toString()))
        .andExpect(jsonPath("$.data[0].name").value("John Wanderer"))
        .andExpect(jsonPath("$.data[0].avatar").value("https://img.com/avatar.jpg"))
        .andExpect(jsonPath("$.data[0].niche").value("Trekking & Camping"))
        .andExpect(jsonPath("$.data[0].followerCount").value(120))
        .andExpect(jsonPath("$.data[0].isFollowing").value(false))
        .andExpect(jsonPath("$.data[0].tripCount").value(5));

    verify(creatorService).getSuggestedCreators(eq(currentUser), eq(4));
  }

  @Test
  void getSuggestedCreators_withCustomLimitAndAlias_returnsSuccess() throws Exception {
    when(currentUserProvider.optionalUser()).thenReturn(Optional.empty());

    when(creatorService.getSuggestedCreators(eq(null), eq(8))).thenReturn(List.of());

    mockMvc
        .perform(
            get("/api/social/creator-suggestions")
                .param("limit", "8")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data").isArray());

    verify(creatorService).getSuggestedCreators(eq(null), eq(8));
  }
}
