package fu.tripsense.placeservice.providers.ziomap.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ZioMapPhotoDetailsResponse(List<Photo> photos) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Photo(String name, List<Attribution> authorAttributions) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Attribution(String displayName, String uri) {}
}
