package fu.tripsense.placeservice.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "places")
@CompoundIndex(name = "provider_place_unique_idx", def = "{'provider': 1, 'providerPlaceId': 1}", unique = true)
public class Place {

    @Id
    private String id;

    private String provider;
    private String providerPlaceId;

    @TextIndexed(weight = 5)
    private String name;
    private String normalizedName;

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;

    @TextIndexed(weight = 2)
    private String address;
    private String oldAddress;

    private String city;
    private String district;

    @Builder.Default
    @TextIndexed(weight = 3)
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

    @Builder.Default
    private List<PlaceReview> reviews = new ArrayList<>();

    @TextIndexed(weight = 1)
    private String description;

    private Map<String, Object> sourceData;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant lastFetchedAt;
}
