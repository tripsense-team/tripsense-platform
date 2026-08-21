package fu.tripsense.placeservice.providers.mapvina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MapVinaPlaceDetailsResponse {

    private String status;

    @JsonProperty("error_message")
    private String errorMessage;

    private Result result;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Result {
        @JsonProperty("place_id")
        private String placeId;

        private String name;

        @JsonProperty("formatted_address")
        private String formattedAddress;

        private String vicinity;
        private Geometry geometry;
        private List<String> types;

        @JsonProperty("class")
        private String placeClass;

        private String subclass;
        private Double rating;

        @JsonProperty("user_ratings_total")
        private Integer userRatingsTotal;

        @JsonProperty("phone_number")
        private String phoneNumber;

        @JsonProperty("formatted_phone_number")
        private String formattedPhoneNumber;

        @JsonProperty("international_phone_number")
        private String internationalPhoneNumber;

        private String website;
        private List<String> socials;

        @JsonProperty("old_formatted_address")
        private String oldFormattedAddress;

        @JsonProperty("opening_hours")
        private OpeningHours openingHours;

        private List<PlacePhoto> photos;
        private String icon;

        @JsonProperty("icon_background_color")
        private String iconBackgroundColor;

        private String url;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Geometry {
        private Location location;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Location {
        private Double lat;
        private Double lng;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OpeningHours {
        @JsonProperty("open_now")
        private Boolean openNow;

        @JsonProperty("weekday_text")
        private List<String> weekdayText;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlacePhoto {
        private String url;

        @JsonProperty("photo_reference")
        private String photoReference;

        private Integer height;
        private Integer width;
    }
}
