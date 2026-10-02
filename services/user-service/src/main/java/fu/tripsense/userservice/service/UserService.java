package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.request.PartnerEnrollmentRequest;
import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.OnboardingGateDto;
import fu.tripsense.userservice.dto.response.PublicProfileDto;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.dto.response.UserProfileDto;
import java.util.List;
import java.util.UUID;

public interface UserService {

  UserDto getMe(UUID userId);

  UserDto enrollPartner(UUID userId, PartnerEnrollmentRequest request);

  UserProfileDto getUserProfile(UUID userId);

  void markOnboardingComplete(UUID userId);

  OnboardingGateDto getOnboardingGate(UUID userId);

  UserProfileDto updateProfile(UUID userId, UpdateProfileRequest request);

  PublicProfileDto getPublicProfile(UUID userId);

  List<PublicProfileDto> getPublicProfiles(List<UUID> userIds);

  List<PublicProfileDto> searchPublicProfiles(String query, int limit);
}
