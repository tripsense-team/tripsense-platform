package fu.tripsense.userservice.dto.response;

import fu.tripsense.userservice.enums.UserStatus;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record UserDto(
    UUID id,
    String email,
    String role,
    List<String> roles,
    boolean partnerEnrolled,
    UserStatus status,
    boolean hasPassword) {

  public UserDto {
    if (roles == null) {
      roles = role != null ? List.of(role) : List.of("ROLE_USER");
    }
  }

  public UserDto(UUID id, String email, String role, UserStatus status) {
    this(id, email, role, role != null ? List.of(role) : List.of("ROLE_USER"), false, status, true);
  }
}
