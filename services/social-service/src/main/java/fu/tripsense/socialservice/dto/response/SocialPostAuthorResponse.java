package fu.tripsense.socialservice.dto.response;

import java.util.UUID;

public record SocialPostAuthorResponse(UUID id, String name, String avatar, Boolean isFollowing) {
  public SocialPostAuthorResponse(UUID id, String name, String avatar) {
    this(id, name, avatar, false);
  }
}
