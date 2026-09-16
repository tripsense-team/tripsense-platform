package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.UserProfileDto;

import java.util.UUID;

public interface UserService {
    
    UserProfileDto getUserProfile(UUID userId);
    
    UserProfileDto updateProfile(UUID userId, UpdateProfileRequest request);
}
