package fu.tripsense.userservice.dto.response;

import java.util.UUID;

/** Deliberately allowlisted Community identity; never add private profile fields here. */
public record PublicProfileDto(UUID userId, String displayName, String avatarUrl) {}
