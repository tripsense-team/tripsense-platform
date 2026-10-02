package fu.tripsense.userservice.bootstrap;

import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class AdminUserBootstrap implements ApplicationRunner {

  private final UserRepository userRepository;
  private final UserProfileRepository userProfileRepository;
  private final PasswordEncoder passwordEncoder;

  @Value("${tripsense.bootstrap.admin.enabled:true}")
  private boolean enabled;

  @Value("${tripsense.bootstrap.admin.email:admin@tripsense.app}")
  private String adminEmail;

  @Value("${tripsense.bootstrap.admin.password:Admin@123456}")
  private String adminPassword;

  @Value("${tripsense.bootstrap.admin.display-name:System Administrator}")
  private String adminDisplayName;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!enabled) {
      log.debug("Admin user bootstrap is disabled via configuration.");
      return;
    }

    if (!StringUtils.hasText(adminEmail) || !StringUtils.hasText(adminPassword)) {
      log.warn("Admin user bootstrap skipped: email or password configuration is missing.");
      return;
    }

    String normalizedEmail = adminEmail.trim().toLowerCase();

    if (userRepository.existsByEmail(normalizedEmail)) {
      log.info("Admin user [{}] already exists in database. Skipping creation.", normalizedEmail);
      return;
    }

    try {
      log.info("Bootstrapping initial system admin account [{}]...", normalizedEmail);

      User adminUser =
          User.builder()
              .email(normalizedEmail)
              .password(passwordEncoder.encode(adminPassword.trim()))
              .role("ADMIN")
              .status(UserStatus.ACTIVE)
              .authProvider("LOCAL")
              .partnerEnrolled(true)
              .partnerEnrolledAt(LocalDateTime.now())
              .partnerTermsVersion("1.0")
              .build();

      User savedUser = userRepository.save(adminUser);

      UserProfile profile =
          UserProfile.builder()
              .userId(savedUser.getId())
              .displayName(StringUtils.hasText(adminDisplayName) ? adminDisplayName.trim() : "System Administrator")
              .onboardingRequired(false)
              .bio("TripSense Platform System Administrator")
              .build();

      userProfileRepository.save(profile);

      log.info(
          "System admin account [{}] bootstrapped successfully with ID: {}",
          normalizedEmail,
          savedUser.getId());
    } catch (Exception ex) {
      log.error("Failed to bootstrap admin user [{}]: {}", normalizedEmail, ex.getMessage(), ex);
    }
  }
}
