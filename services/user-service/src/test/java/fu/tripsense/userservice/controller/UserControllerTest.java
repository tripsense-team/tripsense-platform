package fu.tripsense.userservice.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.userservice.dto.response.PublicProfileDto;
import fu.tripsense.userservice.service.TravelPreferenceService;
import fu.tripsense.userservice.service.UserService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

  private MockMvc mockMvc;

  @Mock private UserService userService;
  @Mock private TravelPreferenceService travelPreferenceService;

  @InjectMocks private UserController userController;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(userController).build();
  }

  @Test
  @DisplayName("searchPublicProfiles returns 200 and search results")
  void searchPublicProfiles_Success() throws Exception {
    UUID id = UUID.randomUUID();
    PublicProfileDto dto = new PublicProfileDto(id, "Khánh Linh", "https://img.com/avatar.jpg");
    when(userService.searchPublicProfiles("Linh", 10)).thenReturn(List.of(dto));

    mockMvc
        .perform(get("/api/users/public-profiles/search")
            .param("query", "Linh")
            .param("limit", "10")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].userId").value(id.toString()))
        .andExpect(jsonPath("$.data[0].displayName").value("Khánh Linh"))
        .andExpect(jsonPath("$.data[0].avatarUrl").value("https://img.com/avatar.jpg"));

    verify(userService).searchPublicProfiles("Linh", 10);
  }

  @Test
  @DisplayName("getPublicProfile returns 200 and public profile")
  void getPublicProfile_Success() throws Exception {
    UUID id = UUID.randomUUID();
    PublicProfileDto dto = new PublicProfileDto(id, "Khánh Linh", "https://img.com/avatar.jpg");
    when(userService.getPublicProfile(id)).thenReturn(dto);

    mockMvc
        .perform(get("/api/users/public-profiles/" + id)
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.userId").value(id.toString()))
        .andExpect(jsonPath("$.data.displayName").value("Khánh Linh"));

    verify(userService).getPublicProfile(id);
  }
}
