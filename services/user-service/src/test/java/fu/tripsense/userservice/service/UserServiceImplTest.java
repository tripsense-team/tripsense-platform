package fu.tripsense.userservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import fu.tripsense.userservice.dto.response.PublicProfileDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.impl.UserServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

  @Mock private UserRepository userRepository;
  @Mock private UserProfileRepository userProfileRepository;

  @InjectMocks private UserServiceImpl userService;

  @Test
  @DisplayName("getPublicProfiles returns empty list when given null or empty IDs")
  void getPublicProfiles_EmptyOrNullInput() {
    assertThat(userService.getPublicProfiles(null)).isEmpty();
    assertThat(userService.getPublicProfiles(List.of())).isEmpty();
    verifyNoInteractions(userRepository, userProfileRepository);
  }

  @Test
  @DisplayName("getPublicProfiles uses batch findAllById and maps results correctly")
  void getPublicProfiles_BatchFetchSuccess() {
    UUID id1 = UUID.randomUUID();
    UUID id2 = UUID.randomUUID();

    User u1 = User.builder().id(id1).status(UserStatus.ACTIVE).build();
    User u2 = User.builder().id(id2).status(UserStatus.ACTIVE).build();

    UserProfile p1 = UserProfile.builder().userId(id1).displayName("Alice").avatarUrl("alice.png").build();
    UserProfile p2 = UserProfile.builder().userId(id2).displayName("Bob").avatarUrl("bob.png").build();

    when(userRepository.findAllById(List.of(id1, id2))).thenReturn(List.of(u1, u2));
    when(userProfileRepository.findAllById(anySet())).thenReturn(List.of(p1, p2));

    List<PublicProfileDto> results = userService.getPublicProfiles(List.of(id1, id2));

    assertThat(results).hasSize(2);
    assertThat(results.get(0).userId()).isEqualTo(id1);
    assertThat(results.get(0).displayName()).isEqualTo("Alice");
    assertThat(results.get(0).avatarUrl()).isEqualTo("alice.png");

    assertThat(results.get(1).userId()).isEqualTo(id2);
    assertThat(results.get(1).displayName()).isEqualTo("Bob");
    assertThat(results.get(1).avatarUrl()).isEqualTo("bob.png");

    verify(userRepository, times(1)).findAllById(List.of(id1, id2));
    verify(userProfileRepository, times(1)).findAllById(anySet());
  }

  @Test
  @DisplayName("getPublicProfiles gracefully skips missing or disabled users without fast-failing")
  void getPublicProfiles_SkipsMissingOrDisabledUsers() {
    UUID validId = UUID.randomUUID();
    UUID disabledId = UUID.randomUUID();
    UUID missingId = UUID.randomUUID();

    User validUser = User.builder().id(validId).status(UserStatus.ACTIVE).build();
    User disabledUser = User.builder().id(disabledId).status(UserStatus.INACTIVE).build();

    UserProfile validProfile =
        UserProfile.builder().userId(validId).displayName("Valid User").avatarUrl("valid.png").build();

    when(userRepository.findAllById(List.of(validId, disabledId, missingId)))
        .thenReturn(List.of(validUser, disabledUser)); // missingId is not returned by DB
    when(userProfileRepository.findAllById(anySet())).thenReturn(List.of(validProfile));

    List<PublicProfileDto> results =
        userService.getPublicProfiles(List.of(validId, disabledId, missingId));

    assertThat(results).hasSize(1);
    assertThat(results.get(0).userId()).isEqualTo(validId);
    assertThat(results.get(0).displayName()).isEqualTo("Valid User");
  }

  @Test
  @DisplayName("getPublicProfile throws 404 when user is not found or disabled")
  void getPublicProfile_NotFound() {
    UUID id = UUID.randomUUID();
    when(userRepository.findById(id)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> userService.getPublicProfile(id))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("User not found");
  }

  @Test
  @DisplayName("searchPublicProfiles returns mapped public profiles and escapes wildcard characters")
  void searchPublicProfiles_ValidQuerySuccess() {
    UUID id = UUID.randomUUID();
    Object[] row = new Object[] {id, "Khánh Linh", "avatar.jpg"};
    when(userProfileRepository.searchEnabledPublicNames("khánh!%linh%", 10))
        .thenReturn(List.<Object[]>of(row));

    List<PublicProfileDto> results = userService.searchPublicProfiles("Khánh%Linh", 10);

    assertThat(results).hasSize(1);
    assertThat(results.get(0).userId()).isEqualTo(id);
    assertThat(results.get(0).displayName()).isEqualTo("Khánh Linh");
    assertThat(results.get(0).avatarUrl()).isEqualTo("avatar.jpg");
    verify(userProfileRepository).searchEnabledPublicNames("khánh!%linh%", 10);
  }

  @Test
  @DisplayName("searchPublicProfiles throws 400 when query is less than 2 characters or null")
  void searchPublicProfiles_ShortQueryThrows400() {
    assertThatThrownBy(() -> userService.searchPublicProfiles("a", 10))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Invalid search query");

    assertThatThrownBy(() -> userService.searchPublicProfiles(null, 10))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Invalid search query");
  }

  @Test
  @DisplayName("searchPublicProfiles throws 400 when query contains control characters")
  void searchPublicProfiles_ControlCharsThrows400() {
    assertThatThrownBy(() -> userService.searchPublicProfiles("ab\u0000cd", 10))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Invalid search query");
  }

  @Test
  @DisplayName("searchPublicProfiles throws 400 when limit is out of 1..20 bounds")
  void searchPublicProfiles_InvalidLimitThrows400() {
    assertThatThrownBy(() -> userService.searchPublicProfiles("linh", 0))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Invalid search query");

    assertThatThrownBy(() -> userService.searchPublicProfiles("linh", 21))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Invalid search query");
  }
}
