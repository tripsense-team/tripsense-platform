package fu.tripsense.placeservice.providers.ziomap.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ZioMapPlaceResult {

    @JsonProperty("place_id")
    private String placeId;

    private String name;

    @JsonProperty("formatted_address")
    private String formattedAddress;

    private Geometry geometry;

    private Double rating;

    @JsonProperty("user_ratings_total")
    private Integer userRatingsTotal;

    private List<String> types = new ArrayList<>();

    @JsonProperty("formatted_phone_number")
    private String formattedPhoneNumber;

    @JsonProperty("international_phone_number")
    private String internationalPhoneNumber;

    @JsonProperty("business_status")
    private String businessStatus;

    private String website;

    @JsonProperty("opening_hours")
    private OpeningHours openingHours;

    @JsonProperty("secondary_opening_hours")
    private List<OpeningHours> secondaryOpeningHours = new ArrayList<>();

    private List<PlacePhoto> photos = new ArrayList<>();

    private List<PlaceReview> reviews = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Geometry {
        private LatLng location;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LatLng {
        private Double lat;
        private Double lng;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OpeningHours {
        @JsonProperty("open_now")
        private Boolean openNow;

        @JsonProperty("weekday_text")
        private List<String> weekdayText = new ArrayList<>();
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlacePhoto {
        @JsonProperty("photo_reference")
        private String photoReference;

        @JsonProperty("raw_reference")
        private RawReference rawReference;

        private Integer height;
        private Integer width;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RawReference {
        @JsonProperty("media_key")
        private String mediaKey;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlaceReview {
        @JsonProperty("author_name")
        private String authorName;

        @JsonProperty("profile_photo_url")
        private String profilePhotoUrl;

        private Integer rating;

        private String text;

        @JsonProperty("relative_time_description")
        private String relativeTimeDescription;

        private Long time;
    }
}
