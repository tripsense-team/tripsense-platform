package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.OnboardingGateDto;
import fu.tripsense.userservice.dto.response.PublicProfileDto;
import fu.tripsense.userservice.dto.response.UserProfileDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.UserService;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

  private final UserRepository userRepository;
  private final UserProfileRepository userProfileRepository;

  @Override
  @Transactional(readOnly = true)
  public UserProfileDto getUserProfile(UUID userId) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    UserProfile profile = userProfileRepository.findById(userId).orElse(null);

    return UserProfileDto.builder()
        .userId(user.getId())
        .email(user.getEmail())
        .avatarUrl(profile != null ? profile.getAvatarUrl() : null)
        .displayName(profile != null ? profile.getDisplayName() : null)
        .onboardingRequired(profile != null && profile.isOnboardingRequired())
        .bio(profile != null ? profile.getBio() : null)
        .location(profile != null ? profile.getLocation() : null)
        .coverUrl(profile != null ? profile.getCoverUrl() : null)
        .socialPorts(profile != null ? profile.getSocialPorts() : null)
        .build();
  }

  @Override
  @Transactional
  public UserProfileDto updateProfile(UUID userId, UpdateProfileRequest request) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    UserProfile profile =
        userProfileRepository
            .findById(userId)
            .orElseGet(() -> UserProfile.builder().userId(userId).build());

    if (request.avatarUrl() != null) {
      profile.setAvatarUrl(request.avatarUrl());
    }
    if (request.displayName() != null) {
      profile.setDisplayName(normalizeDisplayName(request.displayName()));
    }
    if (request.bio() != null) {
      profile.setBio(request.bio());
    }
    if (request.location() != null) {
      profile.setLocation(request.location());
    }
    if (request.coverUrl() != null) {
      profile.setCoverUrl(request.coverUrl());
    }
    if (request.socialPorts() != null) {
      profile.setSocialPorts(request.socialPorts());
    }

    userProfileRepository.save(profile);

    return UserProfileDto.builder()
        .userId(user.getId())
        .email(user.getEmail())
        .avatarUrl(profile.getAvatarUrl())
        .displayName(profile.getDisplayName())
        .onboardingRequired(profile.isOnboardingRequired())
        .bio(profile.getBio())
        .location(profile.getLocation())
        .coverUrl(profile.getCoverUrl())
        .socialPorts(profile.getSocialPorts())
        .build();
  }

  @Override
  @Transactional
  public void markOnboardingComplete(UUID userId) {
    userProfileRepository
        .findById(userId)
        .ifPresent(profile -> profile.setOnboardingRequired(false));
  }

  @Override
  @Transactional(readOnly = true)
  public OnboardingGateDto getOnboardingGate(UUID userId) {
    return new OnboardingGateDto(
        userProfileRepository
            .findById(userId)
            .map(UserProfile::isOnboardingRequired)
            .orElse(false));
  }

  @Override
  @Transactional(readOnly = true)
  public PublicProfileDto getPublicProfile(UUID userId) {
    User user =
        userRepository
            .findById(userId)
            .filter(candidate -> candidate.isEnabled())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    UserProfile profile = userProfileRepository.findById(userId).orElse(null);
    return new PublicProfileDto(
        userId,
        publicDisplayName(profile, userId),
        profile != null ? profile.getAvatarUrl() : null);
  }

  @Override
  @Transactional(readOnly = true)
  public List<PublicProfileDto> getPublicProfiles(List<UUID> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return Collections.emptyList();
    }
    List<UUID> distinctIds = userIds.stream().filter(Objects::nonNull).distinct().toList();
    if (distinctIds.isEmpty()) {
      return Collections.emptyList();
    }

    Set<UUID> enabledUserIds =
        userRepository.findAllById(distinctIds).stream()
            .filter(User::isEnabled)
            .map(User::getId)
            .collect(Collectors.toSet());

    if (enabledUserIds.isEmpty()) {
      return Collections.emptyList();
    }

    Map<UUID, UserProfile> profilesById =
        userProfileRepository.findAllById(enabledUserIds).stream()
            .collect(Collectors.toMap(UserProfile::getUserId, Function.identity(), (a, b) -> a));

    return distinctIds.stream()
        .filter(enabledUserIds::contains)
        .map(
            id -> {
              UserProfile profile = profilesById.get(id);
              return new PublicProfileDto(
                  id,
                  publicDisplayName(profile, id),
                  profile != null ? profile.getAvatarUrl() : null);
            })
        .toList();
  }

  private String publicDisplayName(UserProfile profile, UUID userId) {
    if (profile != null
        && profile.getDisplayName() != null
        && !profile.getDisplayName().isBlank()) {
      return profile.getDisplayName();
    }
    return "TripSense traveler " + userId.toString().substring(0, 8).toUpperCase(Locale.ROOT);
  }

  private String normalizeDisplayName(String value) {
    String result = value.trim().replaceAll("\\s+", " ");
    if (result.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name must not be blank");
    }
    return result;
  }
}
