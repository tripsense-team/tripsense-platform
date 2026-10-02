package fu.tripsense.userservice.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AdminUserBootstrapTest {

  @Mock private UserRepository userRepository;
  @Mock private UserProfileRepository userProfileRepository;
  @Mock private PasswordEncoder passwordEncoder;

  @InjectMocks private AdminUserBootstrap adminUserBootstrap;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(adminUserBootstrap, "enabled", true);
    ReflectionTestUtils.setField(adminUserBootstrap, "adminEmail", "admin@tripsense.app");
    ReflectionTestUtils.setField(adminUserBootstrap, "adminPassword", "Admin@123456");
    ReflectionTestUtils.setField(adminUserBootstrap, "adminDisplayName", "System Administrator");
  }

  @Test
  void testBootstrap_whenUserDoesNotExist_createsAdminUserAndProfile() {
    when(userRepository.existsByEmail("admin@tripsense.app")).thenReturn(false);
    when(passwordEncoder.encode("Admin@123456")).thenReturn("$2a$10$encodedPasswordHash");

    UUID generatedId = UUID.randomUUID();
    when(userRepository.save(any(User.class)))
        .thenAnswer(invocation -> {
          User u = invocation.getArgument(0);
          u.setId(generatedId);
          return u;
        });

    adminUserBootstrap.run(null);

    ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
    verify(userRepository, times(1)).save(userCaptor.capture());
    User savedUser = userCaptor.getValue();

    assertThat(savedUser.getEmail()).isEqualTo("admin@tripsense.app");
    assertThat(savedUser.getPassword()).isEqualTo("$2a$10$encodedPasswordHash");
    assertThat(savedUser.getRole()).isEqualTo("ADMIN");
    assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
    assertThat(savedUser.isPartnerEnrolled()).isTrue();

    ArgumentCaptor<UserProfile> profileCaptor = ArgumentCaptor.forClass(UserProfile.class);
    verify(userProfileRepository, times(1)).save(profileCaptor.capture());
    UserProfile savedProfile = profileCaptor.getValue();

    assertThat(savedProfile.getUserId()).isEqualTo(generatedId);
    assertThat(savedProfile.getDisplayName()).isEqualTo("System Administrator");
    assertThat(savedProfile.isOnboardingRequired()).isFalse();
  }

  @Test
  void testBootstrap_whenUserAlreadyExists_skipsCreation() {
    when(userRepository.existsByEmail("admin@tripsense.app")).thenReturn(true);

    adminUserBootstrap.run(null);

    verify(userRepository, never()).save(any());
    verify(userProfileRepository, never()).save(any());
  }

  @Test
  void testBootstrap_whenDisabled_skipsCreation() {
    ReflectionTestUtils.setField(adminUserBootstrap, "enabled", false);

    adminUserBootstrap.run(null);

    verify(userRepository, never()).existsByEmail(any());
    verify(userRepository, never()).save(any());
    verify(userProfileRepository, never()).save(any());
  }
}
