package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.UserProfileDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserProfile profile = userProfileRepository.findById(userId).orElse(null);

        return UserProfileDto.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .avatarUrl(profile != null ? profile.getAvatarUrl() : null)
                .bio(profile != null ? profile.getBio() : null)
                .location(profile != null ? profile.getLocation() : null)
                .coverUrl(profile != null ? profile.getCoverUrl() : null)
                .socialPorts(profile != null ? profile.getSocialPorts() : null)
                .build();
    }

    @Override
    @Transactional
    public UserProfileDto updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserProfile profile = userProfileRepository.findById(userId).orElseGet(() -> 
            UserProfile.builder().userId(userId).build()
        );

        if (request.avatarUrl() != null) {
            profile.setAvatarUrl(request.avatarUrl());
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
                .bio(profile.getBio())
                .location(profile.getLocation())
                .coverUrl(profile.getCoverUrl())
                .socialPorts(profile.getSocialPorts())
                .build();
    }
}
