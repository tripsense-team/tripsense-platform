package fu.tripsense.placeservice.dto;

import java.time.Instant;
import java.util.List;

/** Ephemeral, attributed provider image. Never persist provider photo names or media URLs. */
public record PlacePhotoDto(
        String url,
        String source,
        List<Attribution> attribution,
        Instant fetchedAt,
        boolean displayApproved
) {
    public record Attribution(String displayName, String uri) {}
}
