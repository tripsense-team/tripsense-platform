package fu.tripsense.placeservice.providers.ziomap.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ZioMapTextSearchPlace {

    private String id;
    private DisplayName displayName;
    private String formattedAddress;
    private Location location;
    private String businessStatus;
    private String nationalPhoneNumber;
    private String internationalPhoneNumber;
    private String websiteUri;
    private Double rating;
    private Integer userRatingCount;
    private List<String> types = new ArrayList<>();
    private String primaryType;
    private RegularOpeningHours regularOpeningHours;
    private List<Photo> photos = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DisplayName {
        private String text;
        private String languageCode;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Location {
        private Double latitude;
        private Double longitude;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegularOpeningHours {
        private Boolean openNow;
        private List<String> weekdayDescriptions = new ArrayList<>();
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Photo {
        private String name;
        private Integer widthPx;
        private Integer heightPx;
        private List<AuthorAttribution> authorAttributions;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AuthorAttribution {
        private String displayName;
        private String uri;
        private String photoUri;
    }
}
