package fu.tripsense.placeservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PlaceDto implements Serializable {

    private String id;
    private String provider;
    private String providerPlaceId;
    private String name;
    private LocationDto location;
    private String address;
    private String oldAddress;
    private String city;
    private String district;

    @Builder.Default
    private List<String> categories = new ArrayList<>();

    private Double rating;
    private Integer userRatingCount;

    @Builder.Default
    private List<String> photos = new ArrayList<>();

    private String phone;
    private String website;

    @Builder.Default
    private List<String> socials = new ArrayList<>();

    private String openingHours;
    private String businessStatus;
    private String description;

    @Builder.Default
    private List<PlaceReviewDto> reviews = new ArrayList<>();
}
