package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PublicProfileClientResponse(UUID userId, String displayName, String avatarUrl) {}
